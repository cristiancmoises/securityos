// @ts-check
/**
 * Single source of truth for SecurityOS HTTP security headers.
 *
 * Consumed by:
 *   - next.config.js          -> headers()  (ENFORCED when served via `next start` / Node)
 *   - scripts/genHeaders.js   -> public/_headers  (Netlify / Cloudflare Pages static hosting)
 *   - pages/_document.tsx     -> <meta http-equiv="Content-Security-Policy"> + referrer
 *                                (fallback for pure `next export` / dumb CDN hosting)
 *   - deploy/nginx.conf, deploy/Caddyfile  (reverse-proxy examples — keep in sync)
 *
 * CSP notes (VERIFIED against the codebase, not guessed — see deploy/SECURITY-HEADERS.md):
 *   - script-src uses 'wasm-unsafe-eval', NOT 'unsafe-eval', by default. SecurityOS's
 *     own code and the WASM emulators (v86, BoxedWine, js-dos, ffmpeg, Quake3) only call
 *     WebAssembly.instantiate, and Monaco/Next.js/styled-components work with no eval —
 *     so the default policy blocks injected eval-based XSS, the single most important win.
 *     EXCEPTION: three Emscripten-based apps DO call eval()/new Function() at runtime and
 *     are therefore DISABLED under the default policy: Pyodide (Terminal `python`), Ruffle
 *     (Flash), and SpaceCadet (pinball). Operators who need them can set the env var
 *     SECURITYOS_ALLOW_EVAL=1 to add 'unsafe-eval' — at the cost of weaker XSS protection.
 *   - style-src needs 'unsafe-inline': styled-components v5 injects runtime <style> tags
 *     and React renders inline style="" attributes; v5 has no clean nonce support.
 *   - worker-src / child-src need blob:: v86 spawns a blob-URL worker (libv86.js); the
 *     clock/wallpaper workers are same-origin chunks already covered by 'self'.
 *   - img/media/connect need blob: + data: for emulator FS, screenshots and canvas exports.
 *   - frame-src 'self' (jspaint/kiwiirc local iframes) + https: (in-OS Browser remote sites).
 *   - connect-src allows https:/wss: so the in-OS Browser, IRC and the *user-configurable*
 *     Tor relay all work. Operators who do NOT need user-set endpoints can tighten this to
 *     an explicit host allowlist — see deploy/SECURITY-HEADERS.md.
 *   - COEP is intentionally OMITTED: require-corp/credentialless breaks the v86 wss relay
 *     and cross-origin images. frame-ancestors / HSTS / COOP / CORP are header-only
 *     (silently ignored in <meta>), which is why the static-export fallback is weaker.
 */

// OPT-IN, off by default. Re-enables eval()/new Function() so the three
// Emscripten apps that need them (Pyodide / Ruffle / SpaceCadet) can run, at the
// cost of weaker XSS protection. Keep this UNSET on hardened/public deployments.
const ALLOW_EVAL = process.env.SECURITYOS_ALLOW_EVAL === "1";

/** @type {Record<string, string[]>} */
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "script-src": [
    "'self'",
    "'wasm-unsafe-eval'",
    "blob:",
    ...(ALLOW_EVAL ? ["'unsafe-eval'"] : []),
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": ["'self'", "data:", "blob:", "https:", "wss:"],
  "worker-src": ["'self'", "blob:"],
  "child-src": ["'self'", "blob:"],
  "frame-src": ["'self'", "https:", "blob:"],
  "manifest-src": ["'self'"],
  "upgrade-insecure-requests": [],
};

/** @param {Record<string, string[]>} directives */
const buildCsp = (directives) =>
  Object.entries(directives)
    .map(([key, values]) => (values.length > 0 ? `${key} ${values.join(" ")}` : key))
    .join("; ");

/** Full policy (HTTP header form) — includes header-only directives. */
const CSP_HEADER_VALUE = buildCsp(CSP_DIRECTIVES);

/** Directives the spec ignores inside <meta http-equiv="Content-Security-Policy">. */
const META_IGNORED = new Set(["frame-ancestors", "report-uri", "report-to", "sandbox"]);

/** Meta-tag form — used only as a fallback when no server/host can set real headers. */
const CSP_META_CONTENT = buildCsp(
  Object.fromEntries(
    Object.entries(CSP_DIRECTIVES).filter(([key]) => !META_IGNORED.has(key))
  )
);

/** Locks down powerful browser features; only what the OS actually uses stays enabled. */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  // SecTube (yt.securityops.co) is embedded cross-origin and needs these features
  // DELEGATED to it; (self) alone blocks delegation, so the video player can't play.
  'autoplay=(self "https://yt.securityops.co" "https://chat.securityops.co")',
  // SecChat (chat.securityops.co) is an end-to-end video chat embedded cross-origin;
  // its webcam/mic/screen-share need these features DELEGATED to it, or WebRTC's
  // getUserMedia is blocked regardless of the iframe `allow` attribute.
  'camera=(self "https://chat.securityops.co")',
  'display-capture=(self "https://chat.securityops.co")',
  'encrypted-media=(self "https://yt.securityops.co")',
  'fullscreen=(self "https://yt.securityops.co" "https://chat.securityops.co")',
  "gamepad=(self)",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "magnetometer=()",
  'microphone=(self "https://chat.securityops.co")',
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/** @type {{ key: string, value: string }[]} */
const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP_HEADER_VALUE },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

module.exports = {
  CSP_DIRECTIVES,
  CSP_HEADER_VALUE,
  CSP_META_CONTENT,
  PERMISSIONS_POLICY,
  securityHeaders,
};
