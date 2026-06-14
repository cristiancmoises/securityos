import http from "http";
import https from "https";
import { lookup } from "dns/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ADBLOCK_COSMETIC_CSS, isAdUrl } from "utils/adblock";

/**
 * SecurityOS privacy proxy.
 *
 * Fetches a remote page server-side and serves it back from our own origin with
 * framing-blocking headers (X-Frame-Options, CSP frame-ancestors) stripped, so
 * sites that refuse to be embedded load in the in-OS Browser.
 *
 * Tor: when TOR_PROXY is set (e.g. socks5h://tor:9050 via deploy/docker-compose),
 * every request is routed through Tor's SOCKS5h proxy. The `h` means DNS is
 * resolved AT Tor, so .onion hidden services work and clearnet hostnames never
 * leak to a local resolver. No iptables / transparent-proxy hacks.
 *
 * Hardening (see the proxy review):
 *  - SSRF: in NON-Tor mode every redirect hop is DNS-resolved and rejected if it
 *    lands on a loopback/private/link-local/metadata/IPv6-mapped address. In Tor
 *    mode Tor itself cannot reach the LAN, so the (leaky) local lookup is skipped.
 *    .onion is always allowed (a hidden service is never a private IP).
 *  - Response headers use an ALLOWLIST (only content-type/-language/-disposition);
 *    we then force no-store + no-referrer. No cookies forwarded either direction.
 *  - HTML is rewritten so sub-resources/links route back through the proxy, and a
 *    runtime shim wraps fetch/XHR/EventSource/sendBeacon + blocks raw WebSocket so
 *    script-generated requests also go through Tor. Residual JS edge cases remain
 *    (see docs/TOR.md) — for strong anonymity use the v86 VM via Tor or Tor Browser.
 *  - No logging, no caching. The CALLER renders this in an opaque-origin sandbox.
 *
 * Server-only: exists under `next start` (Docker default); absent in static export.
 */

export const config = {
  api: { bodyParser: false, responseLimit: false },
};

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
// Larger cap for explicit binary fetches (?bin=1), e.g. the V86 app pulling a
// live ISO it will boot. Self-hosted single-user OS, so a bigger buffer is fine.
const MAX_BIN_BYTES = 512 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const TOR_PROXY = process.env.TOR_PROXY || "";
// Never let a malformed TOR_PROXY value take down the whole proxy route at module
// load. A bad/absent agent degrades to "Tor unreachable", reported clearly below.
let socksAgent: SocksProxyAgent | undefined;
try {
  socksAgent = TOR_PROXY ? new SocksProxyAgent(TOR_PROXY) : undefined;
} catch {
  socksAgent = undefined;
}

// Optional memory-safe Rust sidecar (see sidecar/). When PROXY_SIDECAR_URL is set,
// non-extension requests are delegated to it — it performs the untrusted work
// (Tor fetch, SSRF guard, streaming HTML rewriting) in a memory-safe language.
// Any sidecar failure transparently falls back to this Node implementation.
const PROXY_SIDECAR_URL = process.env.PROXY_SIDECAR_URL || "";

const BROWSER_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// ALLOWLIST: only these upstream response headers are forwarded.
const FORWARD_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-language",
  "content-disposition",
]);

const isPrivateV4 = (a: number, b: number): boolean =>
  a === 0 ||
  a === 127 ||
  a === 10 ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 169 && b === 254) ||
  (a === 100 && b >= 64 && b <= 127) ||
  a >= 224;

const isPrivateIp = (ipRaw: string): boolean => {
  let ip = ipRaw.toLowerCase().replace(/^\[|\]$/g, "");
  const dottedEmbed = ip.match(
    /^(?:::ffff:|64:ff9b::|::)?((?:\d{1,3}\.){3}\d{1,3})$/
  );

  if (dottedEmbed) ip = dottedEmbed[1];

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (v4) return isPrivateV4(Number(v4[1]), Number(v4[2]));

  if (ip.includes(":")) {
    if (ip === "::1" || ip === "::") return true;
    if (/^fe[89abcdef]/.test(ip)) return true;
    if (/^f[cd]/.test(ip)) return true;
    if (/^ff/.test(ip)) return true;

    const hexEmbed = ip.match(/^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/);

    if (hexEmbed) {
      const hi = Number.parseInt(hexEmbed[1], 16);

      return isPrivateV4((hi >> 8) & 255, hi & 255);
    }
  }

  return false;
};

const isBlockedHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  return (
    host === "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    isPrivateIp(host)
  );
};

// Returns the validated IP to PIN for the actual connection (direct mode only), so
// a low-TTL domain can't rebind public->private between this check and the socket
// (DNS rebinding SSRF). Returns undefined when no local resolve happened (Tor mode
// / .onion — Tor resolves at the exit and can't reach the LAN anyway).
const assertAllowedUrl = async (
  u: URL,
  forceCheck = false
): Promise<string | undefined> => {
  if (!/^https?:$/.test(u.protocol)) throw new Error("scheme");

  // Tor hidden services resolve/route only inside Tor and are never a LAN IP.
  // (In direct/clearnet mode an .onion can't be reached anyway — fall through so
  // the DNS lookup fails it.)
  if (!forceCheck && u.hostname.toLowerCase().endsWith(".onion")) return undefined;

  // In Tor mode Tor cannot reach the LAN/metadata, and a local DNS lookup would
  // leak the hostname — so skip the local resolve and let Tor handle it. BUT a
  // clearnet (direct=1) fetch CAN reach the LAN, so it must run the full guard.
  // Gate on socksAgent (NOT TOR_PROXY): if TOR_PROXY is set but the agent failed
  // to build, the fetch would connect DIRECT, so we must still run the SSRF guard
  // rather than skip it on the false assumption that Tor will contain the request.
  if (socksAgent && !forceCheck) return undefined;

  if (isBlockedHostname(u.hostname)) throw new Error("blocked-host");

  const addresses = await lookup(u.hostname, { all: true }).catch(
    () => [] as { address: string; family: number }[]
  );

  if (addresses.length === 0) throw new Error("dns");

  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error("private-ip");
  }

  return addresses[0].address;
};

type ProxyResponse = {
  body: Buffer;
  headers: http.IncomingHttpHeaders;
  status: number;
};

// GET via Node http/https so we can route through a SOCKS (Tor) agent. Caps the
// body size and never auto-follows redirects (the caller revalidates each hop).
const httpGet = (
  urlStr: string,
  maxBytes: number = MAX_RESPONSE_BYTES,
  useTor = true,
  pinnedIp?: string
): Promise<ProxyResponse> =>
  new Promise((resolve, reject) => {
    // Fail CLOSED: in Tor mode, never fall back to a direct (clearnet) connection
    // just because the SOCKS agent is missing/broken — that would silently leak the
    // real IP while the user believes they are on Tor. Surface it as a Tor error.
    if (useTor && !socksAgent) {
      reject(new Error("tor-not-configured"));
      return;
    }

    const lib = new URL(urlStr).protocol === "https:" ? https : http;
    const request = lib.request(
      urlStr,
      {
        // Tor by default; the Clearnet Browser passes ?direct=1 (useTor=false) to
        // fetch over the normal connection. SSRF guard still applies either way.
        agent: useTor ? socksAgent : undefined,
        headers: BROWSER_HEADERS,
        method: "GET",
        // Pin the IP the SSRF guard already validated so DNS can't rebind to a
        // private address between the check and connect (direct mode only; Tor
        // resolves at the exit). Host/SNI/cert still use the URL hostname.
        ...(pinnedIp
          ? {
              lookup: (
                _h: string,
                o: { all?: boolean } | number,
                cb: (
                  e: null,
                  a: string | { address: string; family: number }[],
                  f?: number
                ) => void
              ): void => {
                const family = pinnedIp.includes(":") ? 6 : 4;

                // Node's happy-eyeballs calls lookup with { all: true } and expects
                // an array; the legacy form expects (address, family).
                if (o && typeof o === "object" && o.all) {
                  cb(null, [{ address: pinnedIp, family }]);
                } else {
                  cb(null, pinnedIp, family);
                }
              },
            }
          : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let total = 0;

        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            request.destroy(new Error("too-large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            status: response.statusCode || 502,
          })
        );
        response.on("error", reject);
      }
    );

    request.setTimeout(FETCH_TIMEOUT_MS, () =>
      request.destroy(new Error("timeout"))
    );
    request.on("error", reject);
    request.end();
  });

const PINNED_ORIGIN = (process.env.SECURITYOS_ORIGIN || "").replace(/\/+$/, "");

const ourOrigin = (req: NextApiRequest): string => {
  // Prefer an explicit pinned origin so a spoofed/poisoned Host header can't point
  // the injected clientShim / extension URLs (and thus the page's re-proxied
  // fetch/XHR/beacon) at an attacker host. Falls back to the request host (Node
  // already rejects CRLF/garbage Hosts) with the scheme constrained to http/https.
  if (PINNED_ORIGIN) return PINNED_ORIGIN;

  const proto =
    (req.headers["x-forwarded-proto"] as string) === "https" ? "https" : "http";

  return `${proto}://${req.headers.host || ""}`;
};

const SKIP_URL =
  /^(?:#|data:|blob:|javascript:|vbscript:|view-source:|mhtml:|mailto:|tel:|about:|\{)/i;

// CSP for proxied HTML.
//
// NO-JS ("Safest") mode is the anonymity mode: nothing dynamic runs, so pin every
// loadable resource to 'self' (our /api/proxy) + data:/blob:. Any URL the rewriter
// MISSED then still cannot reach a remote host (a leaked request would reveal the
// real IP and defeat Tor).
//
// JS mode is the Clearnet Browser's "usability first" mode: the page's own scripts
// run and lazy-load images/embeds/resources at runtime, which a strict CSP would
// break ("refused to connect", broken images). So we only block plugins; the
// rewriter (static URLs) + clientShim (re-proxies fetch/XHR/beacon, blocks
// WebSocket) still reduce leaks. Full anonymity is the no-JS / Tor Browser path.
const proxiedCsp = (noJs: boolean): string =>
  noJs
    ? [
        "default-src 'self' data: blob:",
        "script-src 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'self'",
        "object-src 'none'",
        "form-action 'self'",
      ].join("; ")
    : "object-src 'none'";

// Mode flags carried on every rewritten URL so that navigating a link/resource
// keeps the exact same proxy mode (no-JS, extension, adblock, LibreJS, direct/Tor).
type ProxyFlags = {
  noJs: boolean;
  injectExt: boolean;
  adblock: boolean;
  libreJs: boolean;
  isDirect: boolean;
};

const flagQuery = (f: ProxyFlags): string =>
  `${f.noJs ? "&nojs=1" : ""}${f.injectExt ? "&ext=1" : ""}${
    f.adblock ? "&adblock=1" : ""
  }${f.libreJs ? "&librejs=1" : ""}${f.isDirect ? "&direct=1" : ""}`;

const proxify = (
  rawUrl: string,
  base: string,
  origin: string,
  flags: ProxyFlags
): string => {
  if (!rawUrl || SKIP_URL.test(rawUrl.trim())) return rawUrl;

  try {
    const absolute = new URL(rawUrl.trim(), base).href;

    if (!/^https?:$/i.test(new URL(absolute).protocol)) return rawUrl;

    // Ad/tracker host: neutralize the URL so the resource never loads (no script,
    // beacon or pixel). `data:,` is an inert empty resource for src/href alike.
    if (flags.adblock && isAdUrl(absolute)) return "data:,";

    // Carry all mode flags so navigation keeps the same mode (incl. direct/Tor and
    // LibreJS — previously dropped, which silently switched mode on every click).
    return `${origin}/api/proxy?url=${encodeURIComponent(absolute)}${flagQuery(
      flags
    )}`;
  } catch {
    return rawUrl;
  }
};

const clientShim = (proxyPrefix: string, base: string): string =>
  `<script>(function(){var P=${JSON.stringify(proxyPrefix)},B=${JSON.stringify(
    base
  )};function abs(u){try{return new URL(u,B).href}catch(e){return u}}function px(u){if(u==null)return u;var s=String(u);if(/^(data:|blob:|javascript:|about:|#|mailto:|tel:)/i.test(s))return u;if(s.indexOf(P)===0)return u;var a=abs(s);if(!/^https?:/i.test(a))return u;return P+encodeURIComponent(a)}try{var of=window.fetch;if(of)window.fetch=function(i,init){try{if(typeof i==="string")i=px(i);else if(i&&i.url)i=new Request(px(i.url),i)}catch(e){}return of.call(this,i,init)};var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);try{a[1]=px(u)}catch(e){}return xo.apply(this,a)};if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=px(u)}catch(e){}return sb(u,d)}}var ES=window.EventSource;if(ES){window.EventSource=function(u,c){try{u=px(u)}catch(e){}return new ES(u,c)};window.EventSource.prototype=ES.prototype}window.open=function(u){try{if(u)parent.postMessage({__sosNewTab:px(String(u))},"*")}catch(e){}return null};document.addEventListener("click",function(e){var t=e.target;while(t&&t.tagName!=="A")t=t.parentNode;if(t&&t.href&&(e.ctrlKey||e.metaKey||e.button===1)){e.preventDefault();try{parent.postMessage({__sosNewTab:t.href},"*")}catch(x){}}},true);function _pt(){try{parent.postMessage({__sosTitle:document.title||"",__sosHref:location.href},"*")}catch(e){}}document.addEventListener("DOMContentLoaded",_pt);addEventListener("load",_pt);setTimeout(_pt,1200);window.WebSocket=function(){throw new Error("WebSocket blocked by SecurityOS privacy proxy (would bypass Tor)")}}catch(e){}})();</script>`;

// LibreJS-style "good JavaScript only" filter. GNU LibreJS lets a script run only
// when it is either trivial or carries a recognized free-software license. We apply
// a pragmatic, fully synchronous variant (no extra network round-trips) tuned to
// make the Clearnet Browser usable while still blocking the nonfree JS that powers
// tracking/ads/fingerprinting:
//   - third-party (cross-origin) <script src> is removed outright;
//   - first-party (same-origin) <script src> is kept (the site's own code);
//   - inline <script> is kept only when trivial OR free-licensed, else removed;
//   - inline on*= event handlers are removed (nonfree-by-default per LibreJS).
// A site whose JS is fully free-licensed (e.g. our own *.securityops.co apps) keeps
// working; commercial sites load but with their nonfree JS disabled. Users can opt
// out per page with the browser's "Allow all JS" toggle (drops &librejs=1).
const FREE_LICENSE_RE =
  /@licstart|@license/i;
const FREE_LICENSE_NAME_RE =
  /\b(GPL|AGPL|LGPL|MIT|Expat|X11|BSD|ISC|Apache(?:[-\s]?2)?|MPL|Mozilla Public|CC0|CC[-\s]?0|Public Domain|Unlicense|WTFPL|Boost|zlib|Artistic)\b/i;
// LibreJS only ever emits magnet links for genuinely free licenses.
const FREE_LICENSE_MAGNET_RE = /@license\s+magnet:\?xt=urn:btih:/i;
// "Trivial" ≈ short and free of dynamic/AJAX constructs that LibreJS treats as
// nonfree-by-default.
const NONTRIVIAL_JS_RE =
  /\b(eval|new\s+Function|Function\s*\(|XMLHttpRequest|fetch\s*\(|import\s*\(|require\s*\(|WebSocket|document\.write|innerHTML|insertAdjacentHTML)\b/i;

const isFreeLicensedScript = (body: string): boolean =>
  FREE_LICENSE_MAGNET_RE.test(body) ||
  (FREE_LICENSE_RE.test(body) && FREE_LICENSE_NAME_RE.test(body));

const isTrivialScript = (body: string): boolean => {
  const trimmed = body.trim();

  return trimmed.length <= 1000 && !NONTRIVIAL_JS_RE.test(trimmed);
};

const sameOrigin = (rawSrc: string, base: string): boolean => {
  try {
    return new URL(rawSrc.trim(), base).host === new URL(base).host;
  } catch {
    return false;
  }
};

const applyLibreJs = (html: string, base: string): string => {
  let out = html;

  // Drop inline event-handler attributes (onclick=, onload=, …) — nonfree by
  // default under LibreJS.
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Filter every <script> element.
  out = out.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (match, attrs: string, body: string) => {
      // Leave non-JS script blocks (JSON-LD, importmap, templates) untouched.
      const typeMatch = /\stype\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
        attrs
      );
      const type = (
        typeMatch?.[2] ??
        typeMatch?.[3] ??
        typeMatch?.[4] ??
        ""
      ).toLowerCase();
      const isJs =
        type === "" ||
        type === "text/javascript" ||
        type === "application/javascript" ||
        type === "module";

      if (!isJs) return match;

      const srcMatch = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
        attrs
      );

      if (srcMatch) {
        const src = srcMatch[2] ?? srcMatch[3] ?? srcMatch[4] ?? "";

        // Keep first-party scripts; strip third-party (tracking/ad) scripts.
        return sameOrigin(src, base) ? match : "";
      }

      // Inline script: keep only if trivial or free-licensed.
      return isTrivialScript(body) || isFreeLicensedScript(body) ? match : "";
    }
  );

  // Self-closing external scripts: keep first-party only.
  out = out.replace(/<script\b([^>]*)\/>/gi, (match, attrs: string) => {
    const srcMatch = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);

    if (!srcMatch) return "";

    const src = srcMatch[2] ?? srcMatch[3] ?? srcMatch[4] ?? "";

    return sameOrigin(src, base) ? match : "";
  });

  return out;
};

const rewriteHtml = (
  html: string,
  base: string,
  origin: string,
  noJs: boolean,
  injectExt: boolean,
  libreJs: boolean,
  adblock: boolean,
  isDirect: boolean
): string => {
  const proxyPrefix = `${origin}/api/proxy?url=`;
  const flags: ProxyFlags = { noJs, injectExt, adblock, libreJs, isDirect };
  const px = (u: string): string => proxify(u, base, origin, flags);
  let out = html;

  out = out.replace(/\sintegrity\s*=\s*("[^"]*"|'[^']*')/gi, "");
  out = out.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?(?:content-security-policy|refresh)["']?[^>]*>/gi,
    ""
  );
  // Keep "new tab" links INSIDE the in-OS browser: force target=_blank (and any
  // other target) to _self so they navigate this iframe instead of opening a real
  // browser tab.
  out = out.replace(/\starget\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' target="_self"');

  if (noJs) {
    // Tor-Browser-"Safest" style: remove all scripts, inline handlers and
    // javascript: URLs, and reveal <noscript> fallbacks. The response also gets
    // CSP script-src 'none' and the iframe drops allow-scripts (triple defense).
    out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<script\b[^>]*\/>/gi, "");
    out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/<\/?noscript[^>]*>/gi, "");
  } else if (libreJs) {
    // LibreJS-style filter: keep only first-party + trivial/free-licensed JS.
    out = applyLibreJs(out, base);
  }

  // Proxify every URL-bearing attribute, INCLUDING unquoted values (e.g.
  // `<img src=//attacker/x>`) and the older leak-prone attributes (background,
  // cite, manifest, usemap, longdesc). An unrewritten URL makes the browser fire a
  // direct request, leaking the real IP and defeating Tor — the opaque-origin
  // sandbox does NOT stop the outbound request, so this must catch them all.
  out = out.replace(
    /(\s(?:href|src|action|poster|formaction|data-src|data|ping|background|cite|manifest|usemap|longdesc)\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi,
    (_m, pre: string, _q: string, dq: string, sq: string, unq: string) => {
      const url = dq ?? sq ?? unq ?? "";

      // Always re-emit double-quoted (also normalizes unquoted values safely).
      return `${pre}"${px(url).replace(/"/g, "%22")}"`;
    }
  );
  // GET forms: a GET submit REPLACES the action's query string with the form
  // fields, which drops our injected ?url=<target> (and the mode flags) -> the
  // request reaches the proxy with no url and 400s ("internal error" when a page's
  // search box is used). Move the target + flags into hidden inputs (which survive
  // as query params) and bare the action; the handler's __pxurl path reassembles
  // the real URL + appends the form fields. POST forms keep their body untouched.
  out = out.replace(/<form\b([^>]*)>/gi, (whole: string, attrs: string) => {
    const methodMatch = /\smethod\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      attrs
    );
    const method = (
      methodMatch?.[2] ??
      methodMatch?.[3] ??
      methodMatch?.[4] ??
      "get"
    )
      .trim()
      .toLowerCase();

    if (method !== "get") return whole;

    const actionMatch = /\saction\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);

    if (!actionMatch) return whole;

    const action = actionMatch[2] ?? actionMatch[3] ?? "";
    let pxTarget = "";

    try {
      const au = new URL(action);

      // Only touch actions WE rewrote to this proxy.
      if (!au.pathname.endsWith("/api/proxy")) return whole;
      pxTarget = au.searchParams.get("url") || "";
    } catch {
      return whole;
    }

    if (!pxTarget) return whole;

    const esc = (s: string): string =>
      s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
    const newAttrs = attrs.replace(
      /\saction\s*=\s*("[^"]*"|'[^']*')/i,
      ` action="${origin}/api/proxy"`
    );
    const hidden =
      `<input type="hidden" name="__pxurl" value="${esc(pxTarget)}">` +
      (noJs ? `<input type="hidden" name="nojs" value="1">` : "") +
      (injectExt ? `<input type="hidden" name="ext" value="1">` : "") +
      (libreJs ? `<input type="hidden" name="librejs" value="1">` : "") +
      (adblock ? `<input type="hidden" name="adblock" value="1">` : "") +
      (isDirect ? `<input type="hidden" name="direct" value="1">` : "");

    return `<form${newAttrs}>${hidden}`;
  });

  out = out.replace(
    /(\sxlink:href\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (_m, pre: string, _q: string, dq: string, sq: string) => {
      const url = dq ?? sq ?? "";

      return `${pre}${dq == null ? "'" : '"'}${px(url)}${
        dq == null ? "'" : '"'
      }`;
    }
  );
  out = out.replace(
    /(\ssrcset\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (_m, pre: string, _q: string, dq: string, sq: string) => {
      const val = dq ?? sq ?? "";
      const quote = dq == null ? "'" : '"';
      const rewritten = val
        .split(",")
        .map((part) => {
          const seg = part.trim();
          const sp = seg.indexOf(" ");
          const u = sp === -1 ? seg : seg.slice(0, sp);

          return `${px(u)}${sp === -1 ? "" : seg.slice(sp)}`;
        })
        .join(", ");

      return `${pre}${quote}${rewritten}${quote}`;
    }
  );
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, _q: string, u: string) => {
    const proxied = px(u);

    return proxied === u ? m : `url('${proxied.replace(/'/g, "%27")}')`;
  });
  out = out.replace(
    /(@import\s+)("([^"]*)"|'([^']*)')/gi,
    (_m, pre: string, _q: string, dq: string, sq: string) =>
      `${pre}"${px(dq ?? sq ?? "")}"`
  );

  // Inject the Security Ops extension's content layer into proxied pages: the
  // dark theme (CSS, works even with JS off) + content scripts (dark theme/JS,
  // tracking-param stripping) + the YouTube ad-block on YouTube hosts. The
  // WebExtension `browser.*` surface is provided by secops-ext-shim.js.
  const ext = `${origin}/Program%20Files/SecurityOpsExtension`;
  let isYouTube = false;

  try {
    isYouTube = /(^|\.)youtube(-nocookie)?\.com$/i.test(new URL(base).hostname);
  } catch {
    isYouTube = false;
  }

  // Only inject the Security Ops extension when explicitly enabled (&ext=1 from
  // the browser's extension toggle). Off by default so it never mangles pages.
  const extension = !injectExt
    ? ""
    : `<link rel="stylesheet" href="${ext}/dark-theme.css">` +
      (noJs
        ? ""
        : `<script src="${ext}/secops-ext-shim.js"></script>` +
          `<script src="${ext}/stable-content.js"></script>` +
          `<script src="${ext}/secops-reporter.js"></script>` +
          (isYouTube
            ? `<link rel="stylesheet" href="${ext}/youtube-adblock.css">` +
              `<script src="${ext}/youtube-adblock-page.js"></script>` +
              `<script src="${ext}/youtube-adblock.js"></script>`
            : ""));

  // Cosmetic ad-hiding stylesheet (hides ad containers left behind once their
  // network requests are blocked). Works even with scripts stripped.
  const adblockStyle = adblock ? `<style>${ADBLOCK_COSMETIC_CSS}</style>` : "";

  const head = `${
    noJs ? "" : clientShim(proxyPrefix, base)
  }<base href="${base.replace(
    /"/g,
    "&quot;"
  )}"><meta name="referrer" content="no-referrer">${extension}${adblockStyle}`;

  return /<head[^>]*>/i.test(out)
    ? out.replace(/(<head[^>]*>)/i, `$1${head}`)
    : `${head}${out}`;
};

type ErrorKind = "tor-down" | "onion-down" | "load-failed";

const errorPage = (targetHost: string, kind: ErrorKind): string =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">` +
  `<style>html{color-scheme:dark}body{background:#150f1b;color:#e8e2ee;font:14px/1.6 system-ui,sans-serif;` +
  `display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}` +
  `div{max-width:460px;padding:24px}h1{font-size:18px;color:#b98be0}code{color:#d7c2ec}</style></head><body><div>` +
  (kind === "tor-down"
    ? `<h1>🧅 Tor is unreachable</h1>` +
      `<p>Couldn't reach the Tor SOCKS proxy, so <code>${targetHost}</code> (and any <code>.onion</code>) can't load.</p>` +
      `<p>The <b>tor</b> service may not be running. Check <b>Tor Control</b>, or bring the Tor container up ` +
      `(<code>docker compose up -d tor</code>). Onion routing resumes automatically once Tor is back.</p>`
    : kind === "onion-down"
      ? `<h1>🧅 This .onion looks offline</h1>` +
        `<p><b>Tor is working</b>, but the hidden service <code>${targetHost}</code> didn't answer ` +
        `(Tor replied <code>Host unreachable</code>). The service is most likely down, or its address changed.</p>` +
        `<p>Try another bookmark, or make sure the hidden service is published and running on its host.</p>`
      : `<h1>🧅 Couldn't load <code>${targetHost}</code> through the privacy proxy</h1>` +
        `<p>The site may block proxies, require JavaScript/login, or be temporarily down.</p>` +
        `<p>For interactive or logged-in sites, toggle the <b>shield</b> in the toolbar to load directly. ` +
        `For serious anonymous browsing, use the Linux VM via Tor Control.</p>`) +
  `</div></body></html>`;

const sendError = (
  res: NextApiResponse,
  status: number,
  host: string,
  kind: ErrorKind = "load-failed"
): void => {
  res
    .status(status)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .end(errorPage(host || "that address", kind));
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  let raw = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const noJs =
    req.query.nojs === "1" ||
    (Array.isArray(req.query.nojs) && req.query.nojs.includes("1"));
  const injectExt =
    req.query.ext === "1" ||
    (Array.isArray(req.query.ext) && req.query.ext.includes("1"));
  // Binary passthrough (e.g. the V86 app fetching a live ISO to boot): no HTML
  // rewriting, no sidecar, a larger size cap. Still Tor-routed + SSRF-guarded.
  const isBin =
    req.query.bin === "1" ||
    (Array.isArray(req.query.bin) && req.query.bin.includes("1"));
  // Clearnet Browser: fetch over the normal connection (no Tor), framing stripped
  // so any site embeds. Still SSRF-guarded. (The Tor Browser omits this.)
  const isDirect =
    req.query.direct === "1" ||
    (Array.isArray(req.query.direct) && req.query.direct.includes("1"));
  // LibreJS-style filter: keep only first-party + trivial/free-licensed JS, strip
  // third-party/nonfree scripts (the Clearnet Browser enables this by default).
  const libreJs =
    req.query.librejs === "1" ||
    (Array.isArray(req.query.librejs) && req.query.librejs.includes("1"));
  // Ad/tracker blocking: drop requests to known ad/tracking hosts and hide the
  // leftover ad containers (the Clearnet Browser enables this by default).
  const adblock =
    req.query.adblock === "1" ||
    (Array.isArray(req.query.adblock) && req.query.adblock.includes("1"));

  // GET-form support: rewritten forms submit to /api/proxy with the real target in
  // __pxurl plus the form fields as normal query params (a GET submit drops the
  // action's own ?url=). Reconstruct the target by merging those fields back in, so
  // an on-page search box (e.g. the .onion's) actually searches.
  if (!raw && req.query.__pxurl) {
    const pxurl = Array.isArray(req.query.__pxurl)
      ? req.query.__pxurl[0]
      : req.query.__pxurl;

    try {
      const merged = new URL(pxurl);
      const reserved = new Set([
        "url",
        "__pxurl",
        "nojs",
        "ext",
        "origin",
        "direct",
        "bin",
        "librejs",
        "adblock",
      ]);

      Object.entries(req.query).forEach(([key, value]) => {
        if (reserved.has(key)) return;
        (Array.isArray(value) ? value : [value]).forEach((entry) => {
          if (typeof entry === "string") merged.searchParams.append(key, entry);
        });
      });
      raw = merged.href;
    } catch {
      // Leave raw empty; the target parse below rejects it cleanly.
    }
  }

  let target: URL;

  try {
    target = new URL(raw || "");
  } catch {
    res.status(400).setHeader("Content-Type", "text/plain").end("Invalid url");
    return;
  }

  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Delegate to the memory-safe Rust sidecar when configured. Extension-injection
  // requests stay on the Node path (that feature lives here). On ANY sidecar error
  // we fall through to the built-in proxy below, so browsing never hard-fails.
  if (
    PROXY_SIDECAR_URL &&
    !injectExt &&
    !isBin &&
    !isDirect &&
    !libreJs &&
    !adblock
  ) {
    try {
      const sidecar = `${PROXY_SIDECAR_URL.replace(/\/+$/, "")}/proxy?url=${encodeURIComponent(
        target.href
      )}${noJs ? "&nojs=1" : ""}`;
      const upstream = await fetch(sidecar);
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get("content-type");

      res.status(upstream.status);
      // Forward only content-type; enforce our OWN security headers at the boundary
      // rather than trusting anything the sidecar returns (defense in depth — a
      // compromised/misconfigured sidecar must not be able to relax them).
      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (/\b(text\/html|application\/xhtml\+xml)\b/i.test(contentType || "")) {
        res.setHeader("Content-Security-Policy", proxiedCsp(noJs));
      }
      res.end(buffer);
      return;
    } catch {
      // Sidecar unreachable — fall through to the built-in Node proxy.
    }
  }

  try {
    let current = target;
    let response: ProxyResponse | undefined;
    // Byte budget is CUMULATIVE across redirect hops, so a redirect chain can't
    // multiply the per-hop cap (6 hops * 512 MB) into an OOM. Each hop is capped at
    // whatever budget remains.
    let budget = isBin ? MAX_BIN_BYTES : MAX_RESPONSE_BYTES;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      const pinnedIp = await assertAllowedUrl(current, isDirect);
      // eslint-disable-next-line no-await-in-loop
      response = await httpGet(current.href, budget, !isDirect, pinnedIp);

      budget -= response.body.length;
      if (budget <= 0 && response.status >= 300 && response.status < 400) {
        throw new Error("too-large");
      }

      const location = response.headers.location;

      if (response.status >= 300 && response.status < 400 && location) {
        if (hop === MAX_REDIRECTS) throw new Error("too-many-redirects");
        current = new URL(location, current);
        continue;
      }

      break;
    }

    if (!response) throw new Error("no-response");

    const contentTypeHeader = response.headers["content-type"];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader || "";

    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined && FORWARD_RESPONSE_HEADERS.has(key.toLowerCase())) {
        try {
          res.setHeader(key, value);
        } catch {
          // Ignore headers Node refuses to set.
        }
      }
    });

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(response.status);

    if (/\b(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Same-origin CSP so anything the rewriter missed still can't reach a remote
      // host (no-JS also gets script-src 'none'; the iframe drops allow-scripts).
      res.setHeader("Content-Security-Policy", proxiedCsp(noJs));
      res.end(
        rewriteHtml(
          response.body.toString("utf8"),
          current.href,
          ourOrigin(req),
          noJs,
          injectExt,
          libreJs,
          adblock,
          isDirect
        )
      );
    } else {
      res.end(response.body);
    }
  } catch (error) {
    // Classify the failure so the message is actionable instead of always blaming
    // Tor — that mislabeling is what made a simply-offline .onion look like
    // "Tor won't start":
    //   • tor-down    — the SOCKS hop itself failed (only possible when we routed
    //                   through Tor, i.e. NOT ?direct=1).
    //   • onion-down  — Tor IS up and answered, but the .onion didn't: the socks
    //                   library reports "Socks5 proxy rejected connection - …"
    //                   (Host unreachable) when the hidden service is offline.
    //   • load-failed — any other upstream failure (clearnet host down/blocking).
    const message = (error as Error)?.message?.toLowerCase() || "";
    const isOnion = target.hostname.endsWith(".onion");
    // "socks5 proxy rejected connection - …" means Tor accepted the request and
    // tried to connect: Tor is UP, the destination is what failed. A genuine Tor
    // outage is a failure to reach the SOCKS endpoint itself (ECONNREFUSED on the
    // proxy, no agent configured) and can only happen on the Tor (non-direct) path.
    const torAnswered = /proxy rejected connection/.test(message);
    const torDown =
      !isDirect &&
      !torAnswered &&
      (!socksAgent ||
        /econnrefused|etimedout|ehostunreach|enetunreach|getaddrinfo|socks/.test(
          message
        ));
    const kind: ErrorKind = torDown
      ? "tor-down"
      : isOnion
        ? "onion-down"
        : "load-failed";

    sendError(res, 502, target.hostname, kind);
  }
};

export default handler;
