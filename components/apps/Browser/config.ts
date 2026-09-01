// Shared by the Tor and Clearnet browsers. The server-side privacy proxy
// (pages/api/proxy.ts):
// routing a remote page through it strips X-Frame-Options / CSP frame-ancestors so
// sites that block embedding still load, fetches it server-side over Tor, and
// renders it in a sandboxed, opaque-origin iframe that can never touch the
// SecurityOS origin. Tor routing is the default; the clearnet browser must pass
// `direct=1` explicitly and is clearly labelled as non-anonymous in its UI/docs.
export const PROXY_PATH = "/api/proxy?url=";
