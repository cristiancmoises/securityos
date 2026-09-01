// Shared by the Tor and Clearnet browsers. The server-side privacy proxy
// (pages/api/proxy.ts):
// routing a remote page through it strips X-Frame-Options / CSP frame-ancestors so
// sites that block embedding still load, fetches it server-side over Tor, and
// renders it in a sandboxed, opaque-origin iframe that can never touch the
// SecurityOS origin. Tor routing is the default; the clearnet browser must pass
// `direct=1` explicitly and is clearly labelled as non-anonymous in its UI/docs.
export const PROXY_PATH = "/api/proxy?url=";

// The clearnet browser is intentionally branded and self-hosted by default.
// Bare address-bar searches stay on the operator-controlled SecurityOps origin
// instead of being disclosed to a third-party search provider.
export const CLEARNET_HOME = "https://securityops.co/";
export const CLEARNET_SEARCH_QUERY = `${CLEARNET_HOME}?q=`;
export const CLEARNET_ONION_BLOCKED_PAGE =
  "/System/Browser/clearnet-onion-blocked.html";

export const isOnionUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");

    return hostname.endsWith(".onion");
  } catch {
    return false;
  }
};

// First-party public services only. Keeping onions out of this explicit list
// prevents the direct browser from ever leaking a hidden-service lookup.
export const CLEARNET_BOOKMARKS: ReadonlyArray<{
  name: string;
  url: string;
}> = [
  { name: "SecurityOps", url: "https://securityops.com.br/" },
  { name: "SecurityOps .co", url: CLEARNET_HOME },
  { name: "SecurityOS", url: "https://os.securityops.co/" },
  { name: "GODS EYE", url: "https://eye.securityops.co/" },
  { name: "SecurityOps IRC", url: "https://irc.securityops.com.br/" },
  { name: "Keywave", url: "https://chat.securityops.co/" },
  { name: "Wiki", url: "https://wiki.securityops.co/" },
  { name: "Git .co", url: "https://git.securityops.co/" },
  { name: "Git .com.br", url: "https://git.securityops.com.br/" },
];

// Clearnet prioritizes compatibility. Tor continues to start in its safest,
// script-free policy and lets the user opt in per browser session.
export const DEFAULT_CLEARNET_JS_MODE = "all" as const;
export const DEFAULT_TOR_JS_MODE = "off" as const;
