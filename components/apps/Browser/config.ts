// Shared by the Tor Browser. The server-side privacy proxy (pages/api/proxy.ts):
// routing a remote page through it strips X-Frame-Options / CSP frame-ancestors so
// sites that block embedding still load, fetches it server-side over Tor, and
// renders it in a sandboxed, opaque-origin iframe that can never touch the
// SecurityOS origin. (SecurityOS is Tor-only — there is no clearnet browser.)
export const PROXY_PATH = "/api/proxy?url=";
