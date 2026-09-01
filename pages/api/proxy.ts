import http from "http";
import https from "https";
import zlib from "zlib";
import { promisify } from "util";
import { lookup } from "dns/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ADBLOCK_COSMETIC_CSS, isAdUrl } from "utils/adblock";
import {
  EphemeralCsrfCookieJar,
  proxyCookieSessionKey,
} from "utils/proxyCookieJar";

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
 *    we then force no-store + no-referrer. The general proxy is cookie-less. A
 *    narrow server-memory bridge keeps only ZUPT's CSRF cookie inside a random
 *    app+isolation session; it is never returned to the browser or sent elsewhere.
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
// Downloads (attachments / generic binary content-types) get a budget well above
// the 25 MiB HTML cap so real shared files transfer in full — but BELOW the media
// budget, because a download is fully buffered (and Buffer.concat transiently
// doubles it at the end), whereas media streams as Range/206 partials. This keeps a
// single download's peak memory bounded.
const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;
// Global ceiling on bytes buffered across ALL in-flight upstream RESPONSES. Without
// it, a hostile proxied page referencing many large sub-resources (each labeled as a
// download/binary type) could buffer enough concurrent responses to exceed the
// container's memory limit and OOM-kill it (remote DoS). Once the running total
// passes this, further large responses are aborted ("server-busy") instead of
// allocated, so total buffered RESPONSE memory stays bounded regardless of
// concurrency. (Request/upload bodies are a separate pool, bounded per-request by
// MAX_UPLOAD_BYTES below and not counted here: they carry no amplification — a client
// must actually send every byte it makes us buffer, so peak upload memory is capped
// by the client's own bandwidth rather than by a cheap reference in a hostile page.)
const MAX_TOTAL_BUFFER_BYTES = 640 * 1024 * 1024;
let inFlightBuffered = 0;
// Cap on the REQUEST body we will buffer + forward upstream for non-GET methods
// (file uploads via the embedded Vaptvupt share, POST forms, etc.). Bounds memory
// per upload so a hostile/buggy client can't OOM the route. Raised to 256 MiB so
// real file-share uploads (the common cause of "upload failed") aren't rejected as
// 413; it's a self-hosted single-user OS, so a larger transient buffer is fine. A
// body over the cap is still rejected (413) rather than partially forwarded.
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const MAX_REDIRECTS = 5;
// HTTP methods we forward upstream. GET/HEAD carry no body; the rest may carry one
// (read + forwarded byte-for-byte). Anything else is rejected before we touch Tor.
const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);
// Body-less methods: never read or forward a request body for these.
const BODYLESS_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const TOR_PROXY = process.env.TOR_PROXY || "";
// Keep-alive / socket pooling for the SOCKS (Tor) agents. Reusing warm Tor circuits
// instead of doing a fresh SOCKS handshake + circuit build per request is the single
// biggest perf win here. Stream isolation is UNAFFECTED: each iso token already gets
// its OWN agent instance (distinct SOCKS userinfo => distinct circuit), so a pooled
// free socket is only ever reused within the same token's pool — never across tokens.
const AGENT_OPTS = {
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: FETCH_TIMEOUT_MS,
};
// Never let a malformed TOR_PROXY value take down the whole proxy route at module
// load. A bad/absent agent degrades to "Tor unreachable", reported clearly below.
let socksAgent: SocksProxyAgent | undefined;
try {
  socksAgent = TOR_PROXY
    ? new SocksProxyAgent(TOR_PROXY, AGENT_OPTS)
    : undefined;
} catch {
  socksAgent = undefined;
}

// Tor STREAM ISOLATION (the exact mechanism Tor Browser uses per-site/per-tab).
// Tor's SocksPort enables IsolateSOCKSAuth by default: two SOCKS connections that
// present DIFFERENT username:password pairs are placed on SEPARATE circuits (and
// thus, in general, exit through different relays / IPs). This costs nothing — it
// only changes which circuit Tor picks; the bytes still flow over the same Tor.
//
// When a request carries an opaque per-tab token (&iso=<token>), we route it
// through a SocksProxyAgent whose URL embeds <token>:<token> as the SOCKS creds,
// so each tab/token gets its own circuit (site-correlation resistance), and the
// "New Tor circuit" button just rotates the token to get a fresh exit IP. With no
// token we use the shared global `socksAgent` above, unchanged.
//
// Per-token agents are cached (never rebuilt per request) in an LRU-ish Map capped
// at MAX_ISO_AGENTS — inserting past the cap evicts the oldest entry, so a long
// session with many tab rotations can't grow memory without bound.
const MAX_ISO_AGENTS = 256;
const isoAgents = new Map<string, SocksProxyAgent>();
const ZUPT_WEB_ORIGIN = "https://share.securityops.co";

// ZUPT's multipart tools bind the hidden CSRF form field to an HttpOnly cookie.
// Because the privacy proxy intentionally strips browser cookies, that otherwise
// makes every operation fail with 403. Preserve ONLY that one cookie, ONLY for the
// exact first-party tool host, and ONLY inside a valid app+iso session. The store is
// bounded, in-memory, mode-separated (Tor/direct), and never forwards Set-Cookie to
// the browser. The general browser proxy remains entirely credential-less.
const zuptCsrfCookies = new EphemeralCsrfCookieJar({
  allowedOrigins: [ZUPT_WEB_ORIGIN],
});

// Build the per-token SOCKS proxy URL from TOR_PROXY, injecting <token>:<token> as
// userinfo so Tor isolates the stream. Returns undefined if TOR_PROXY is unset or
// unparseable (callers then fall back to the global agent / fail-closed path).
const torProxyUrlWithAuth = (token: string): string | undefined => {
  try {
    const url = new URL(TOR_PROXY);

    url.username = encodeURIComponent(token);
    url.password = encodeURIComponent(token);

    return url.href;
  } catch {
    return undefined;
  }
};

// Resolve the SOCKS agent for a request. An isolation token yields a cached
// per-token agent (separate Tor circuit); no token yields the shared global agent.
// Returns undefined only when Tor isn't configured at all — callers MUST treat that
// as fail-closed (never a direct connection), exactly like the global agent path.
const agentForToken = (token?: string): SocksProxyAgent | undefined => {
  if (!token || !socksAgent) return socksAgent;

  const cached = isoAgents.get(token);

  if (cached) {
    // Refresh recency so the cap evicts genuinely-cold tokens first.
    isoAgents.delete(token);
    isoAgents.set(token, cached);

    return cached;
  }

  const proxyUrl = torProxyUrlWithAuth(token);

  // If we can't build a per-token URL, fall back to the global Tor agent (still
  // Tor, just shares the default circuit) rather than leaking via a direct path.
  if (!proxyUrl) return socksAgent;

  let agent: SocksProxyAgent;

  try {
    // Same keep-alive pooling as the global agent; this token's pool is private to
    // its own circuit (distinct SOCKS userinfo), so isolation is preserved.
    agent = new SocksProxyAgent(proxyUrl, AGENT_OPTS);
  } catch {
    return socksAgent;
  }

  isoAgents.set(token, agent);
  if (isoAgents.size > MAX_ISO_AGENTS) {
    const oldest = isoAgents.keys().next().value;

    if (oldest !== undefined) isoAgents.delete(oldest);
  }

  return agent;
};

// Accept only opaque, fixed-length hex/alphanumeric tokens (the client generates
// 128-bit hex). This keeps the value Tor sees bounded and free of anything that
// could matter to the SOCKS layer; anything else is ignored (no isolation).
const sanitizeIsoToken = (raw: string | string[] | undefined): string => {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === "string" && /^[\da-f]{32}$/.test(value) ? value : "";
};

// Optional memory-safe Rust sidecar (see sidecar/). When PROXY_SIDECAR_URL is set,
// non-extension requests are delegated to it — it performs the untrusted work
// (Tor fetch, SSRF guard, streaming HTML rewriting) in a memory-safe language.
// Any sidecar failure transparently falls back to this Node implementation.
const PROXY_SIDECAR_URL = process.env.PROXY_SIDECAR_URL || "";

const BROWSER_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,video/*,audio/*,*/*;q=0.8",
  // Request COMPRESSION. Bytes-over-Tor is the dominant cost (a cold circuit plus
  // CryptPad's multi-MB JS/CSS is the "too slow" complaint), and text assets shrink
  // ~3-5x with gzip/br. Node's http/https don't auto-decompress, but decodeBody()
  // below gunzip/inflate/brotli-decodes every response (size-capped anti-bomb, raw
  // fallback on error) BEFORE the HTML rewriter / asset passthrough see the bytes.
  // Advertise ONLY the three encodings decodeBody actually handles (no zstd).
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// ALLOWLIST: only these upstream response headers are forwarded. content-range and
// accept-ranges let <video>/<audio> seek (HTTP Range -> 206 Partial Content); we
// deliberately do NOT forward content-length (we may decompress, and Node derives
// the correct length from the buffer we actually send).
const FORWARD_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-language",
  "content-disposition",
  "accept-ranges",
  "content-range",
]);

// REQUEST-header ALLOWLIST for the body we forward upstream (non-GET methods).
// STRICTLY the bytes needed to interpret the body: the content-type (with its
// multipart boundary), and content-language. We deliberately do NOT forward
// cookies, authorization, referer, origin, the real user-agent or ANY other client
// header. The caller may separately add the server-owned ZUPT CSRF cookie for an
// exact, isolated app session; no browser cookie is ever accepted. content-length
// is recomputed in httpRequest from the buffer we actually send (never trusted from
// the client). content-encoding is NOT forwarded: we send the body verbatim and
// label it as-is.
const FORWARD_REQUEST_HEADERS = new Set(["content-type", "content-language"]);

// Build the upstream request headers for a forwarded body from the allowlist above.
const pickRequestHeaders = (req: NextApiRequest): Record<string, string> => {
  const out: Record<string, string> = {};

  FORWARD_REQUEST_HEADERS.forEach((name) => {
    const value = req.headers[name];

    if (typeof value === "string" && value) out[name] = value;
    else if (Array.isArray(value) && value[0]) out[name] = value[0];
  });

  return out;
};

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

    // NAT64 hex form (64:ff9b::WWXX:YYZZ) and 6to4 (2002:WWXX:YYZZ::) both embed an
    // IPv4 (WW.XX.YY.ZZ) in hextets — block when that IPv4 is private, so neither can
    // be used to smuggle a request to localhost/internal hosts past the guard.
    const nat64 = ip.match(/^64:ff9b::([0-9a-f]{1,4}):[0-9a-f]{1,4}$/);

    if (nat64) {
      const hi = Number.parseInt(nat64[1], 16);

      return isPrivateV4((hi >> 8) & 255, hi & 255);
    }

    const sixToFour = ip.match(/^2002:([0-9a-f]{1,4}):/);

    if (sixToFour) {
      const hi = Number.parseInt(sixToFour[1], 16);

      if (isPrivateV4((hi >> 8) & 255, hi & 255)) return true;
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
  if (!forceCheck && u.hostname.toLowerCase().endsWith(".onion"))
    return undefined;

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

// Read the raw, undecoded request body for a non-GET method off the Next stream.
// bodyParser is disabled (see `config` below), so `req` is the raw IncomingMessage
// and we own the stream. We buffer (not stream) because forwarding over a SOCKS/Tor
// agent with a precise content-length is simplest and correctness comes first; the
// buffer is hard-capped at MAX_UPLOAD_BYTES so it can never grow unbounded. Rejects
// (resolves { tooLarge:true }) the instant the cap is exceeded — we stop reading.
const readRequestBody = (
  req: NextApiRequest,
  maxBytes: number = MAX_UPLOAD_BYTES
): Promise<{ body: Buffer; tooLarge: boolean }> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > maxBytes) {
        aborted = true;
        // Stop consuming and tear down the stream so we don't buffer past the cap.
        req.destroy();
        resolve({ body: Buffer.alloc(0), tooLarge: true });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      resolve({ body: Buffer.concat(chunks), tooLarge: false });
    });
    req.on("error", (err) => {
      if (aborted) return;
      reject(err);
    });
  });

type ProxyResponse = {
  body: Buffer;
  headers: http.IncomingHttpHeaders;
  status: number;
};

// Options for a single upstream request hop. `method` defaults to GET; `body` is
// the raw bytes to write for non-GET methods (undefined for body-less methods).
type HttpRequestOptions = {
  maxBytes?: number;
  useTor?: boolean;
  pinnedIp?: string;
  extraHeaders?: Record<string, string>;
  // The SOCKS agent to use in Tor mode. Defaults to the shared global agent; an
  // isolation token (see agentForToken) supplies a per-token agent on a separate
  // circuit. Fail-closed is still gated on the GLOBAL socksAgent below: if Tor
  // isn't configured at all, we never open a direct connection.
  torAgent?: SocksProxyAgent | undefined;
  method?: string;
  body?: Buffer;
};

// One upstream request hop via Node http/https so we can route through a SOCKS
// (Tor) agent. Method-aware: GET (default) and HEAD carry no body; POST/PUT/PATCH/
// DELETE/OPTIONS forward `body` byte-for-byte with the caller's content-type. Caps
// the RESPONSE body size and never auto-follows redirects (the caller revalidates
// each hop and decides method/body preservation per the 3xx status code).
const httpRequest = (
  urlStr: string,
  {
    maxBytes = MAX_RESPONSE_BYTES,
    useTor = true,
    pinnedIp,
    extraHeaders = {},
    torAgent = socksAgent,
    method = "GET",
    body,
  }: HttpRequestOptions = {}
): Promise<ProxyResponse> =>
  new Promise((resolve, reject) => {
    // Fail CLOSED: in Tor mode, never fall back to a direct (clearnet) connection
    // just because the SOCKS agent is missing/broken — that would silently leak the
    // real IP while the user believes they are on Tor. Surface it as a Tor error.
    // Gate on the GLOBAL socksAgent (configuration), not the per-token agent, so an
    // isolation request still fails closed exactly like a non-isolated one.
    if (useTor && !socksAgent) {
      reject(new Error("tor-not-configured"));
      return;
    }

    const upperMethod = method.toUpperCase();
    // Only write a body for methods that may carry one; GET/HEAD/OPTIONS never do.
    // `bodyToSend` is the definite Buffer to write (undefined => no body), which also
    // lets TypeScript narrow it cleanly at both use sites below.
    const bodyToSend =
      body !== undefined &&
      body.length > 0 &&
      !BODYLESS_METHODS.has(upperMethod)
        ? body
        : undefined;
    // Global buffered-bytes accounting for THIS request: subtract exactly what we
    // added back, exactly once, whether the request ends, errors, times out, or is
    // aborted — otherwise inFlightBuffered would leak and eventually reject all
    // traffic. Defined here (not in the response callback) so the request-level
    // error/timeout handlers below can release too.
    let counted = 0;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      inFlightBuffered -= counted;
    };
    const lib = new URL(urlStr).protocol === "https:" ? https : http;
    const request = lib.request(
      urlStr,
      {
        // Tor by default; the Clearnet Browser passes ?direct=1 (useTor=false) to
        // fetch over the normal connection. SSRF guard still applies either way.
        // In Tor mode an isolation token routes via a per-circuit agent; otherwise
        // the shared global agent. Either way it is ALWAYS a Tor SOCKS agent here.
        agent: useTor ? torAgent : undefined,
        // Per-request extras win over the browser defaults; for non-GET this carries
        // the forwarded content-type (multipart boundary / urlencoded / octet-stream)
        // and content-length. The header allowlist that builds extraHeaders never
        // forwards cookies/auth, so the proxy stays cookie-less in BOTH directions.
        headers: {
          ...BROWSER_HEADERS,
          ...extraHeaders,
          ...(bodyToSend
            ? { "Content-Length": String(bodyToSend.length) }
            : {}),
        },
        method: upperMethod,
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

        // Pick the per-response byte budget. Media (video/audio) + 206 partials keep
        // the large media budget for smooth playback/seeking; file DOWNLOADS
        // (attachments / generic binary content-types) get the smaller download
        // budget so a shared file over 25 MiB transfers in full without granting the
        // full media buffer. REDIRECT (3xx) bodies never need a large buffer, so they
        // are excluded — this also preserves the loop's cumulative-redirect budget
        // (an attacker can't use a 3xx + binary content-type to bypass `maxBytes`).
        const status = response.statusCode || 0;
        const isRedirect = status >= 300 && status < 400;
        const responseType = String(response.headers["content-type"] || "");
        const disposition = String(
          response.headers["content-disposition"] || ""
        );
        // Anchored to the disposition TOKEN so an inline resource whose *filename*
        // merely contains "attachment" doesn't get the larger budget.
        const isAttachment = /^\s*attachment\b/i.test(disposition);
        const isMedia = /^(?:video|audio)\//i.test(responseType);
        const isBinaryDownloadType =
          /^application\/(?:octet-stream|zip|x-zip|gzip|x-gzip|x-tar|x-7z|x-rar|x-bzip|pdf|epub|x-iso|vnd|x-msdownload|x-debian|x-redhat|java-archive)\b/i.test(
            responseType
          );
        let cap = maxBytes;

        if (!isRedirect) {
          if (status === 206 || isMedia)
            cap = Math.max(maxBytes, MAX_BIN_BYTES);
          else if (isAttachment || isBinaryDownloadType) {
            cap = Math.max(maxBytes, MAX_DOWNLOAD_BYTES);
          }
        }

        response.on("data", (chunk: Buffer) => {
          // Once we've released (aborted) this request, ignore any late chunk so it
          // can't re-inflate the global counter after it was subtracted.
          if (released) return;
          total += chunk.length;
          inFlightBuffered += chunk.length;
          counted += chunk.length;
          // Per-response cap: this single response is too big.
          if (total > cap) {
            release();
            request.destroy(new Error("too-large"));
            return;
          }
          // Global cap: total buffered across ALL in-flight responses would exceed
          // the safe memory ceiling — abort rather than risk OOM-killing the route.
          if (inFlightBuffered > MAX_TOTAL_BUFFER_BYTES) {
            release();
            request.destroy(new Error("server-busy"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          release();
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            status: response.statusCode || 502,
          });
        });
        response.on("error", (error) => {
          release();
          reject(error);
        });
      }
    );

    request.setTimeout(FETCH_TIMEOUT_MS, () =>
      request.destroy(new Error("timeout"))
    );
    request.on("error", (error) => {
      // Release any bytes this request counted before failing (timeout/abort/socket
      // error) so the global buffer accounting can't leak and starve later requests.
      release();
      reject(error);
    });
    // Forward the request body byte-for-byte for non-GET methods, then close. The
    // body is already capped at MAX_UPLOAD_BYTES by readRequestBody, so this buffer
    // is bounded. multipart bodies are written verbatim (no re-encoding) so the
    // boundary and binary file parts pass through unchanged.
    if (bodyToSend) request.end(bodyToSend);
    else request.end();
  });

// Promisified zlib so decompression runs ASYNCHRONOUSLY (on the libuv threadpool)
// instead of blocking the event loop with the *Sync variants. We also pass a hard
// `maxOutputLength` so a small "gzip bomb" can't expand to gigabytes in RAM: zlib
// aborts the inflate once the decoded size would exceed the cap (it errors, which we
// treat as a decode failure below — i.e. serve raw bytes, never the unbounded blob).
const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const inflateRawAsync = promisify(zlib.inflateRaw);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

// Node's http/https never auto-decompress. We request gzip/deflate/br (bytes over Tor
// are the dominant cost), so servers now actually send compressed bodies — decode here
// so the HTML rewriter and the asset passthrough see real bytes (otherwise the page is
// blank/garbled). A 206 partial is never decoded (a sliced compressed stream can't
// stand alone) and any decode error falls back to the raw body rather than failing the
// whole page.
const decodeBody = async (response: ProxyResponse): Promise<Buffer> => {
  const encodingHeader = response.headers["content-encoding"];
  const encoding = (
    Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader || ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (!encoding || encoding === "identity" || response.status === 206) {
    return response.body;
  }

  // Bound the DECOMPRESSED size (anti-bomb): a compressed body already passed the
  // on-the-wire cap in httpRequest, but its inflated form could be far larger. Cap the
  // decoded output at MAX_RESPONSE_BYTES so a tiny gzip bomb can't OOM the process.
  try {
    if (encoding === "gzip" || encoding === "x-gzip") {
      return await gunzipAsync(response.body, {
        maxOutputLength: MAX_RESPONSE_BYTES,
      });
    }
    if (encoding === "deflate") {
      // "deflate" may be zlib-wrapped (RFC 1950) OR raw (RFC 1951) in the wild.
      // zlib.inflate handles the former; fall back to inflateRaw for the latter so a
      // raw-deflate response isn't served as garbled, still-compressed bytes.
      try {
        return await inflateAsync(response.body, {
          maxOutputLength: MAX_RESPONSE_BYTES,
        });
      } catch {
        return await inflateRawAsync(response.body, {
          maxOutputLength: MAX_RESPONSE_BYTES,
        });
      }
    }
    if (encoding === "br") {
      return await brotliDecompressAsync(response.body, {
        maxOutputLength: MAX_RESPONSE_BYTES,
      });
    }
  } catch {
    // Corrupt/truncated stream, OR a body that inflates past MAX_RESPONSE_BYTES
    // (gzip bomb): serve the raw bytes rather than failing the page or blowing up
    // memory. The raw body is already capped on the wire by httpRequest.
  }

  return response.body;
};

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
const KEYWAVE_ORIGINS = new Set(["https://chat.securityops.co"]);
const isKeywaveUrl = (url: URL): boolean => KEYWAVE_ORIGINS.has(url.origin);

// CSP for proxied HTML.
//
// NO-JS ("Safest") mode is the anonymity mode: nothing dynamic runs, so pin every
// loadable resource to 'self' (our /api/proxy) + data:/blob:. Any URL the rewriter
// MISSED then still cannot reach a remote host (a leaked request would reveal the
// real IP and defeat Tor).
//
// JS mode is the Clearnet Browser's "usability first" mode: the page's own scripts
// run and lazy-load resources at runtime. The page renders in an OPAQUE-origin
// sandbox and the clientShim re-proxies fetch/XHR/beacon/EventSource (and now the
// WebSocket tunnel) to the OS origin — a `connect-src 'self'` would match the opaque
// origin and BREAK those, so we keep connect-src open here and rely on the shim.
// The real deanonymization vector, WebRTC (not covered by CSP at all), is
// neutralized in the clientShim alongside WebSocket. Full anonymity remains the
// no-JS / Tor Browser path (the strict policy below).
const proxiedCsp = (
  noJs: boolean,
  confinedApp = false,
  origin = "'self'",
  isDirect = false
): string =>
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
    : confinedApp || !isDirect
    ? [
        // The document has an opaque sandbox origin, so use the concrete SecurityOS
        // origin instead of 'self'. Every executable/network-capable resource must
        // return through the proxy. This applies to Tor browsing and to embedded
        // apps (including direct ZUPT): a dynamically-created raw remote URL fails
        // closed instead of bypassing the rewriting shim or leaking an IP.
        `default-src ${origin} data: blob:`,
        `script-src ${origin} 'unsafe-inline' 'unsafe-eval' blob:`,
        `style-src ${origin} 'unsafe-inline'`,
        `img-src ${origin} data: blob:`,
        `media-src ${origin} data: blob:`,
        `font-src ${origin} data:`,
        `connect-src ${origin}`,
        `frame-src ${origin} blob: data:`,
        `child-src ${origin} blob:`,
        `worker-src ${origin} blob:`,
        "object-src 'none'",
        `form-action ${origin}`,
      ].join("; ")
    : "object-src 'none'";

// Mode flags carried on every rewritten URL so that navigating a link/resource
// keeps the exact same proxy mode (no-JS, extension, adblock, LibreJS, direct/Tor).
type ProxyFlags = {
  adblock: boolean;
  // Embedded-app mode (&app=1, set by CryptPad/WhatsApp/Telegram): forces the Node
  // path so the clientShim is injected (the Rust sidecar injects none), and turns on
  // the extra in-memory IndexedDB shim. Carried on every rewritten URL so the app's
  // own sub-resources/sub-iframes stay on the shimmed Node path too. Does NOT change
  // circuit selection / SSRF / fail-closed — only sidecar-bypass + shim injection.
  app: boolean;
  injectExt: boolean;
  isDirect: boolean;
  // Per-tab Tor stream-isolation token: carried on every rewritten URL so links,
  // sub-resources and GET-form submits stay on the SAME tab circuit. Empty -> none.
  iso: string;
  // Exact-host Keywave compatibility: preserve the Tor text/control route on
  // rewritten assets and give its same-origin Socket.IO client the real upstream
  // origin. This never enables WebRTC, direct egress, or a generic relay.
  keywave: boolean;
  libreJs: boolean;
  noJs: boolean;
  // Exact-origin ZUPT mode: forces the Node path and carries the isolated,
  // server-owned CSRF session across rewritten forms/resources.
  zupt: boolean;
};

const flagQuery = (f: ProxyFlags): string =>
  `${f.noJs ? "&nojs=1" : ""}${f.injectExt ? "&ext=1" : ""}${
    f.adblock ? "&adblock=1" : ""
  }${f.libreJs ? "&librejs=1" : ""}${f.isDirect ? "&direct=1" : ""}${
    f.app ? "&app=1" : ""
  }${f.keywave ? "&keywave=1" : ""}${f.zupt ? "&zupt=1" : ""}${
    f.iso ? `&iso=${f.iso}` : ""
  }`;

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

const clientShim = (
  proxyPrefix: string,
  base: string,
  flags: ProxyFlags
): string =>
  `<script>(function(){if(window.__sosShimmed)return;window.__sosShimmed=1;var P=${JSON.stringify(
    proxyPrefix
  )},B=${JSON.stringify(base)},F=${JSON.stringify(
    flagQuery(flags)
  )};function abs(u){try{return new URL(u,B).href}catch(e){return u}}function px(u){if(u==null)return u;var s=String(u);if(/^(data:|blob:|javascript:|about:|#|mailto:|tel:)/i.test(s))return u;if(s.indexOf(P)===0)return u;var a=abs(s);if(!/^https?:/i.test(a))return u;return P+encodeURIComponent(a)+F}try{var of=window.fetch;if(of)window.fetch=function(i,init){try{if(typeof i==="string")i=px(i);else if(i&&i.url)i=new Request(px(i.url),i)}catch(e){}return of.call(this,i,init)};var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){var a=[].slice.call(arguments);try{a[1]=px(u)}catch(e){}return xo.apply(this,a)};if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=px(u)}catch(e){}return sb(u,d)}}var ES=window.EventSource;if(ES){window.EventSource=function(u,c){try{u=px(u)}catch(e){}return new ES(u,c)};window.EventSource.prototype=ES.prototype}window.open=function(u){try{if(u)parent.postMessage({__sosNewTab:px(String(u))},"*")}catch(e){}return null};document.addEventListener("click",function(e){var t=e.target;while(t&&t.tagName!=="A")t=t.parentNode;if(t&&t.href&&(e.ctrlKey||e.metaKey||e.button===1)){e.preventDefault();try{parent.postMessage({__sosNewTab:t.href},"*")}catch(x){}}},true);function _pt(){try{parent.postMessage({__sosTitle:document.title||"",__sosHref:location.href},"*")}catch(e){}}document.addEventListener("DOMContentLoaded",_pt);addEventListener("load",_pt);setTimeout(_pt,1200);var _D=${
    flags.isDirect ? "1" : "0"
  };var _I=${JSON.stringify(
    flags.iso
  )};var _OWS=window.WebSocket;var _WSP=(location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/ws?url=";function _SWS(u,p){try{var s=String(u);if(/^wss?:/i.test(s)){var t=_WSP+encodeURIComponent(s)+(_D?"&direct=1":"")+(_I?"&iso="+encodeURIComponent(_I):"");return p!==undefined?new _OWS(t,p):new _OWS(t)}}catch(e){}return p!==undefined?new _OWS(u,p):new _OWS(u)}try{_SWS.prototype=_OWS.prototype;_SWS.CONNECTING=0;_SWS.OPEN=1;_SWS.CLOSING=2;_SWS.CLOSED=3;window.WebSocket=_SWS}catch(e){}var _rtc=function(){throw new Error("WebRTC blocked by SecurityOS privacy proxy (would leak your real IP, bypassing Tor)")};try{window.RTCPeerConnection=_rtc;window.webkitRTCPeerConnection=_rtc;window.mozRTCPeerConnection=_rtc;window.RTCDataChannel=_rtc;if(navigator.mediaDevices){navigator.mediaDevices.getUserMedia=function(){return Promise.reject(new Error("blocked"))}}}catch(e){}var _MEM=function(){var d={};var o={getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){for(var k in d){delete d[k]}},key:function(i){return Object.keys(d)[i]||null}};try{Object.defineProperty(o,"length",{get:function(){return Object.keys(d).length}})}catch(e){}return o};function _shimStore(n){try{void window[n].length}catch(e){try{Object.defineProperty(window,n,{configurable:true,value:_MEM()})}catch(e2){}}}_shimStore("localStorage");_shimStore("sessionStorage");${
    flags.app
      ? 'try{try{void navigator.serviceWorker}catch(e){try{Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{controller:null,oncontrollerchange:null,onmessage:null,ready:new Promise(function(){}),register:function(){return Promise.reject(new Error("SecurityOS: service workers are disabled in the privacy sandbox"))},getRegistration:function(){return Promise.resolve(undefined)},getRegistrations:function(){return Promise.resolve([])},startMessages:function(){},addEventListener:function(){},removeEventListener:function(){}}})}catch(e2){}}}catch(x){}try{try{void window.caches}catch(e){try{var _nc={match:function(){return Promise.resolve(undefined)},add:function(){return Promise.resolve()},addAll:function(){return Promise.resolve()},put:function(){return Promise.resolve()},"delete":function(){return Promise.resolve(false)},keys:function(){return Promise.resolve([])}};Object.defineProperty(window,"caches",{configurable:true,value:{open:function(){return Promise.resolve(_nc)},match:function(){return Promise.resolve(undefined)},has:function(){return Promise.resolve(false)},"delete":function(){return Promise.resolve(false)},keys:function(){return Promise.resolve([])}}})}catch(e2){}}}catch(x){}function _idbShim(){var S={};function dsl(a){a.contains=function(x){return a.indexOf(x)>-1};a.item=function(i){return a[i]};return a}function rq(v){return{result:v,error:null,onsuccess:null,onerror:null,onupgradeneeded:null,readyState:"pending",addEventListener:function(t,f){this["on"+t]=f},removeEventListener:function(){}}}function done(r,e){setTimeout(function(){r.readyState="done";var h=r["on"+e];if(h){try{h.call(r,{target:r,type:e})}catch(x){}}},0);return r}function res(v){return done(rq(v),"success")}function idx(){return{get:function(){return res(undefined)},getAll:function(){return res([])},getAllKeys:function(){return res([])},count:function(){return res(0)},openCursor:function(){return res(null)},openKeyCursor:function(){return res(null)}}}function st(n){if(!S[n])S[n]=new Map();var m=S[n];var s={name:n,keyPath:null,autoIncrement:false,indexNames:dsl([]),get:function(k){return res(m.has(k)?m.get(k):undefined)},getAll:function(){return res(Array.from(m.values()))},getAllKeys:function(){return res(Array.from(m.keys()))},put:function(v,k){var key=k!==undefined?k:v&&v.key;m.set(key,v);return res(key)},add:function(v,k){var key=k!==undefined?k:v&&v.key;m.set(key,v);return res(key)},delete:function(k){m.delete(k);return res(undefined)},clear:function(){m.clear();return res(undefined)},count:function(){return res(m.size)},openCursor:function(){return res(null)},openKeyCursor:function(){return res(null)},index:function(){return idx()},createIndex:function(){return idx()},deleteIndex:function(){}};return s}function tx(){var t={objectStore:function(n){return st(n)},abort:function(){},oncomplete:null,onerror:null,onabort:null,addEventListener:function(e,f){this["on"+e]=f},removeEventListener:function(){}};setTimeout(function(){if(t.oncomplete){try{t.oncomplete({target:t,type:"complete"})}catch(x){}}},0);return t}function db(n){var d={name:n,version:1,objectStoreNames:dsl(Object.keys(S)),createObjectStore:function(nm){var s=st(nm);d.objectStoreNames=dsl(Object.keys(S));return s},deleteObjectStore:function(nm){delete S[nm];d.objectStoreNames=dsl(Object.keys(S))},transaction:function(){return tx()},close:function(){},addEventListener:function(){},removeEventListener:function(){},onversionchange:null,onerror:null,onabort:null,onclose:null};return d}var F={open:function(n,v){var r=rq(null);setTimeout(function(){var d=db(n);r.result=d;if(r.onupgradeneeded){r.transaction=tx();try{r.onupgradeneeded({target:r,type:"upgradeneeded",oldVersion:0,newVersion:v||1})}catch(x){}}r.readyState="done";if(r.onsuccess){try{r.onsuccess({target:r,type:"success"})}catch(x){}}},0);return r},deleteDatabase:function(){return res(undefined)},databases:function(){return Promise.resolve([])},cmp:function(a,b){return a<b?-1:a>b?1:0}};try{Object.defineProperty(window,"indexedDB",{configurable:true,value:F})}catch(x){try{window.indexedDB=F}catch(y){}}var KR={bound:function(){return{}},lowerBound:function(){return{}},upperBound:function(){return{}},only:function(){return{}}};try{if(!window.IDBKeyRange)window.IDBKeyRange=KR}catch(x){}try{console.warn("SecurityOS: in-memory IndexedDB shim active (amnesic) - non-persistent in this sandbox.")}catch(x){}}try{var _ni=false;try{if(!window.indexedDB)_ni=true;else void window.indexedDB.cmp}catch(x){_ni=true}if(_ni)_idbShim()}catch(x){}'
      : ""
  }}catch(e){}})();</script>`;

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
const FREE_LICENSE_RE = /@licstart|@license/i;
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
  isDirect: boolean,
  app: boolean,
  keywave: boolean,
  zupt: boolean,
  iso: string
): string => {
  const proxyPrefix = `${origin}/api/proxy?url=`;
  const flags: ProxyFlags = {
    adblock,
    app,
    injectExt,
    isDirect,
    iso,
    keywave,
    libreJs,
    noJs,
    zupt,
  };
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
  out = out.replace(
    /\starget\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    ' target="_self"'
  );

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
  // srcset is comma-separated "URL [descriptor]" pairs, so the single-URL pass
  // above can't touch it — responsive <img>/<picture><source> would then fetch
  // direct (IP leak) or just fail. Rewrite each candidate URL, keep its descriptor.
  out = out.replace(
    /(\s(?:srcset|data-srcset)\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (_m, pre: string, _q: string, dq: string, sq: string) => {
      const value = dq ?? sq ?? "";
      const rewritten = value
        .split(",")
        .map((candidate) => {
          const seg = candidate.trim();

          if (!seg) return "";

          const space = seg.search(/\s/);
          const rawUrl = space === -1 ? seg : seg.slice(0, space);
          const descriptor = space === -1 ? "" : seg.slice(space);

          return `${px(rawUrl).replace(/"/g, "%22")}${descriptor}`;
        })
        .filter(Boolean)
        .join(", ");

      return `${pre}"${rewritten}"`;
    }
  );
  // FORM submission, by method:
  //
  // POST (and other body methods): the generic attribute pass above already
  // rewrote `action` to `${origin}/api/proxy?url=<resolved action>&flags` (relative
  // or absolute actions are resolved against the page base by proxify). A POST does
  // NOT replace the action's query string — it sends the fields in the BODY — so our
  // injected ?url=<target> survives, and the handler reads it + forwards the body
  // byte-for-byte (multipart/urlencoded/octet-stream) upstream over Tor with
  // method=POST. So POST forms need NO further rewriting here; we leave the body
  // untouched (do NOT inject hidden inputs — that would mutate a multipart field
  // set) and fall through. An action-less POST form submits to the page's own
  // proxied URL (the iframe location), which is the correct HTML default.
  //
  // GET: a GET submit REPLACES the action's query string with the form fields,
  // which drops our injected ?url=<target> (and the mode flags) -> the request
  // reaches the proxy with no url and 400s ("internal error" when a page's search
  // box is used). Move the target + flags into hidden inputs (which survive as query
  // params) and bare the action; the handler's __pxurl path reassembles the real URL
  // + appends the form fields.
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

    // Non-GET (POST/PUT/...) forms: action already proxified; body forwarded by the
    // handler. Nothing to rewrite here.
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
      s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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
      (isDirect ? `<input type="hidden" name="direct" value="1">` : "") +
      (app ? `<input type="hidden" name="app" value="1">` : "") +
      (zupt ? `<input type="hidden" name="zupt" value="1">` : "") +
      (iso ? `<input type="hidden" name="iso" value="${esc(iso)}">` : "");

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
  // Lazy-load + async-decode images that don't already opt in: defer off-screen
  // fetches (each one is a Tor round-trip) so the page paints sooner and idle images
  // never hit the network. Only touch <img> tags lacking a loading= attribute, so an
  // author's explicit loading="eager" is respected. Safe in all JS/no-JS modes.
  out = out.replace(
    /<img\b(?![^>]*\bloading=)/gi,
    '<img loading="lazy" decoding="async"'
  );

  out = out.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (m, _q: string, u: string) => {
      const proxied = px(u);

      return proxied === u ? m : `url('${proxied.replace(/'/g, "%27")}')`;
    }
  );
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

  // Keywave calls `io({...})` without an origin because its normal document lives
  // at chat.securityops.co. A rewritten document lives at /api/proxy instead, so
  // Socket.IO would otherwise target the SecurityOS origin and never reach the
  // service. Rewrite only that exact assignment, and only for the exact-host,
  // Tor-only `keywave` mode validated by the request handler below. XHR then goes
  // back through /api/proxy and WebSocket through the narrow /api/ws allowlist.
  if (keywave) {
    const signalingOrigin = new URL(base).origin;
    let signalingRewritten = false;

    out = out.replace(
      /(\bS\.socket\s*=\s*io)\(\s*{\s*transports\s*:/,
      (_match, assignment: string) => {
        signalingRewritten = true;

        return `${assignment}(${JSON.stringify(
          signalingOrigin
        )}, { transports:`;
      }
    );

    if (!signalingRewritten) {
      const notice =
        '<div role="alert" style="background:#19090d;border:2px solid #ff4d6d;color:#ffe8ed;' +
        'font:600 14px/1.5 system-ui,sans-serif;inset:16px;padding:18px;position:fixed;z-index:2147483647">' +
        "Keywave compatibility check failed: its signaling bootstrap changed. " +
        "SecurityOS stopped the Tor integration instead of silently showing a disconnected client. " +
        "Use the explicitly marked direct full-client action while the proxy adapter is updated.</div>";

      out = /<body\b[^>]*>/i.test(out)
        ? out.replace(/(<body\b[^>]*>)/i, `$1${notice}`)
        : `${notice}${out}`;
    }
  }

  const head = `${
    noJs ? "" : clientShim(proxyPrefix, base, flags)
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
  // The forwarded method. GET by default; the embedded Vaptvupt share (and other
  // proxied pages) submit POST forms / file uploads, which we now forward instead
  // of letting the upstream Flask/onion reject everything as 405. An unknown method
  // is refused before we touch Tor (no SSRF / open-relay surface widening).
  const method = (req.method || "GET").toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    res
      .status(405)
      .setHeader("Allow", [...ALLOWED_METHODS].join(", "))
      .setHeader("Content-Type", "text/plain")
      .end("Method Not Allowed");
    return;
  }

  const hasBody = !BODYLESS_METHODS.has(method);

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
  // Embedded-app mode (CryptPad/WhatsApp/Telegram): force the Node clientShim path
  // (the Rust sidecar injects none) and enable the in-memory IndexedDB shim. Strict
  // "1" equality like every other flag — never a truthy coercion.
  const isApp =
    req.query.app === "1" ||
    (Array.isArray(req.query.app) && req.query.app.includes("1"));
  const requestedKeywave =
    req.query.keywave === "1" ||
    (Array.isArray(req.query.keywave) && req.query.keywave.includes("1"));
  const requestedZupt =
    req.query.zupt === "1" ||
    (Array.isArray(req.query.zupt) && req.query.zupt.includes("1"));
  // Tor stream isolation: an opaque per-tab token (&iso=<token>) routes this fetch
  // through its own Tor circuit (separate exit IP), so different tabs can't be
  // correlated by a shared exit and "New Tor circuit" rotates a tab's token for a
  // fresh exit. Empty/invalid -> the shared default circuit (no behavior change).
  // This ONLY affects circuit selection; SSRF guard, pinning, fail-closed, header
  // allowlist and timeouts are all unchanged.
  const isoToken = sanitizeIsoToken(req.query.iso);
  const torAgent = agentForToken(isoToken);

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
        "app",
        "keywave",
        "zupt",
        "iso",
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

  // The signaling rewrite is accepted only for the live first-party Keywave
  // origin and never on direct egress. A forged `keywave=1` elsewhere is inert.
  const isKeywave = requestedKeywave && !isDirect && isKeywaveUrl(target);
  // ZUPT's privileged compatibility mode is exact-origin only. A forged zupt=1
  // on any other target is inert and receives neither cookies nor special routing.
  const isZupt = requestedZupt && target.origin === ZUPT_WEB_ORIGIN && !isBin;
  const cookieSession =
    isZupt && isoToken ? proxyCookieSessionKey(isoToken, isDirect) : "";

  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Read + buffer the request body for non-GET methods (file uploads, POST forms).
  // bodyParser is disabled, so we own the raw stream. Hard-capped at
  // MAX_UPLOAD_BYTES — an over-cap upload is refused with 413 (no partial forward).
  // GET/HEAD/OPTIONS never read a body.
  let requestBody: Buffer | undefined;

  if (hasBody) {
    let read: { body: Buffer; tooLarge: boolean };

    try {
      read = await readRequestBody(req, MAX_UPLOAD_BYTES);
    } catch {
      res
        .status(400)
        .setHeader("Content-Type", "text/plain")
        .end("Could not read request body");
      return;
    }

    if (read.tooLarge) {
      res
        .status(413)
        .setHeader("Content-Type", "text/plain")
        .end("Upload too large");
      return;
    }

    requestBody = read.body;
  }

  // Per-request upstream headers. Range (media seeking) is forwarded for any method;
  // for a body-carrying method we ALSO forward the allowlisted request headers
  // (content-type with its multipart boundary, content-language) so the upstream can
  // interpret the body. NO cookies/auth/referer/user-agent are ever forwarded.
  const range = req.headers.range;
  const extraHeaders: Record<string, string> = {
    ...(typeof range === "string" ? { Range: range } : {}),
    ...(hasBody ? pickRequestHeaders(req) : {}),
  };

  // Delegate to the memory-safe Rust sidecar when configured. Extension-injection
  // requests stay on the Node path (that feature lives here). On ANY sidecar error
  // we fall through to the built-in proxy below, so browsing never hard-fails.
  if (
    PROXY_SIDECAR_URL &&
    // The sidecar is GET-only (no body forwarding); non-GET methods (uploads, POST
    // forms) must use the Node path below so the body is forwarded over Tor.
    !hasBody &&
    !injectExt &&
    !isBin &&
    !isDirect &&
    !libreJs &&
    !adblock &&
    // Embedded apps (CryptPad/WhatsApp/Telegram, &app=1) need the Node clientShim —
    // the in-memory storage + IndexedDB shim and the fetch/XHR/WebSocket re-proxy —
    // which the Rust sidecar does NOT inject. Keep them on the Node path.
    !isApp &&
    !isKeywave &&
    !isZupt &&
    // Stream-isolation requests must use the Node path so they route through the
    // per-token Tor circuit (the sidecar has its own non-isolated circuit).
    !isoToken &&
    // Range requests (media seeking) need the Range-aware Node path below.
    !req.headers.range
  ) {
    try {
      const sidecar = `${PROXY_SIDECAR_URL.replace(
        /\/+$/,
        ""
      )}/proxy?url=${encodeURIComponent(target.href)}${noJs ? "&nojs=1" : ""}`;
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
    const isZuptCookieSession = Boolean(cookieSession);
    // Byte budget is CUMULATIVE across redirect hops, so a redirect chain can't
    // multiply the per-hop cap (6 hops * 512 MB) into an OOM. Each hop is capped at
    // whatever budget remains.
    let budget = isBin ? MAX_BIN_BYTES : MAX_RESPONSE_BYTES;
    // The method/body for THIS hop. A redirect may downgrade them (303 / legacy
    // 301-302 POST -> GET) before the next hop; 307/308 preserve both.
    let hopMethod = method;
    let hopBody = requestBody;
    // The forwarded request headers for THIS hop. When a redirect downgrades the
    // method to GET we drop the body-describing headers (content-type) — there is no
    // longer a body to describe — while keeping any Range header.
    let hopHeaders = extraHeaders;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      const pinnedIp = await assertAllowedUrl(current, isDirect);
      // Recompute the server-owned cookie for EVERY hop. The jar itself requires
      // exact share.securityops.co + HTTPS, so a redirect can never carry ZUPT's
      // CSRF credential onto another host (or onto plaintext HTTP).
      const csrfCookie = isZuptCookieSession
        ? zuptCsrfCookies.getCookieHeader(cookieSession, current)
        : undefined;
      // eslint-disable-next-line no-await-in-loop
      response = await httpRequest(current.href, {
        maxBytes: budget,
        useTor: !isDirect,
        pinnedIp,
        extraHeaders: {
          ...hopHeaders,
          ...(csrfCookie ? { Cookie: csrfCookie } : {}),
        },
        torAgent,
        method: hopMethod,
        body: hopBody,
      });

      // Capture a rotated/new CSRF cookie before processing a redirect or returning
      // the body. Set-Cookie is still absent from FORWARD_RESPONSE_HEADERS, so this
      // value remains server-side and inaccessible to the sandboxed page.
      if (isZuptCookieSession) {
        zuptCsrfCookies.storeSetCookie(
          cookieSession,
          current,
          response.headers["set-cookie"]
        );
      }

      budget -= response.body.length;
      if (budget <= 0 && response.status >= 300 && response.status < 400) {
        throw new Error("too-large");
      }

      const location = response.headers.location;

      if (response.status >= 300 && response.status < 400 && location) {
        if (hop === MAX_REDIRECTS) throw new Error("too-many-redirects");
        // Re-validate EVERY hop (the new URL is run through assertAllowedUrl at the
        // top of the next iteration), so a redirect can't bounce a POST onto a
        // private/loopback/metadata host (SSRF) any more than a GET can.
        const next = new URL(location, current);

        // A credentialed ZUPT operation may redirect only within the exact HTTPS
        // origin. This is stricter than ordinary cookie rules and removes even the
        // possibility of cross-origin redirect confusion in jar mode.
        if (isZuptCookieSession && next.origin !== ZUPT_WEB_ORIGIN) {
          throw new Error("credentialed-cross-origin-redirect");
        }

        current = next;

        // Method/body preservation per RFC 7231 / browser behaviour:
        //   • 307 / 308 — repeat the request UNCHANGED (same method + body): we
        //                 leave hopMethod/hopBody/hopHeaders as-is.
        //   • 303       — always switch to GET and drop the body.
        //   • 301 / 302 — a POST (any body method) is re-issued as a bodyless GET,
        //                 matching long-standing browser behaviour; GET/HEAD stay.
        const status = response.status;
        const downgradeToGet =
          status === 303 || ((status === 301 || status === 302) && hasBody);

        if (downgradeToGet) {
          hopMethod = "GET";
          hopBody = undefined;
          // Drop the body-describing request headers; keep Range (if any).
          hopHeaders = typeof range === "string" ? { Range: range } : {};
        }

        continue;
      }

      break;
    }

    if (!response) throw new Error("no-response");

    const contentTypeHeader = response.headers["content-type"];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader || "";
    // Decompress once (gzip/br/deflate) so HTML rewriting and asset passthrough
    // both operate on real bytes; Node then sets a matching content-length. Async +
    // size-bounded so it neither blocks the event loop nor lets a gzip bomb OOM us.
    const body = await decodeBody(response);

    Object.entries(response.headers).forEach(([key, value]) => {
      if (
        value !== undefined &&
        FORWARD_RESPONSE_HEADERS.has(key.toLowerCase())
      ) {
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
      // Confined app modes pin every active resource to our concrete origin so a
      // dynamically-created remote request fails closed instead of leaking.
      res.setHeader(
        "Content-Security-Policy",
        proxiedCsp(noJs, isApp || isZupt, ourOrigin(req), isDirect)
      );
      res.end(
        rewriteHtml(
          body.toString("utf8"),
          current.href,
          ourOrigin(req),
          noJs,
          injectExt,
          libreJs,
          adblock,
          isDirect,
          isApp,
          isKeywave && isKeywaveUrl(current),
          isZupt && current.origin === ZUPT_WEB_ORIGIN,
          isoToken
        )
      );
    } else {
      // Defense in depth on non-HTML/binary bodies: even if a body is mislabeled or
      // content-sniffed, an empty default-src + sandbox means it can't execute or
      // pull in anything. X-Content-Type-Options: nosniff is already set above.
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

      // Immutable sub-resources (images, fonts, CSS, JS) are safe to keep in the
      // BROWSER's memory cache: a short private max-age lets back/forward and revisits
      // reuse them instead of re-fetching over Tor (a big perf + circuit-load win),
      // while staying amnesic — NO disk cache, only this response header. Strictly
      // scoped to a full (200, non-Range) success so partial/seekable media, HTML and
      // anything credentialed keep the no-store default set above.
      const isCacheableType =
        /^(?:image\/|font\/|text\/css\b|text\/javascript\b|application\/(?:javascript|x-javascript|ecmascript|wasm)\b)/i.test(
          contentType
        );

      if (
        response.status === 200 &&
        !req.headers.range &&
        !response.headers["content-range"] &&
        isCacheableType
      ) {
        res.setHeader("Cache-Control", "private, max-age=600");
      }

      res.end(body);
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
