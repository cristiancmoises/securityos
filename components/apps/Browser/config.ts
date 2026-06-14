import { FAVICON_BASE_PATH } from "utils/constants";

type Bookmark = {
  icon: string;
  name: string;
  url: string;
};

export const bookmarks: Bookmark[] = [
 {
    icon: "/System/Icons/Favicons/presentation.webp",
    name: "Chat",
    url: "https://wiki.securityops.co/",
  },  
{
    icon: "/System/Icons/Favicons/osint.webp",
    name: "Security Ops",
    url: "https://securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/anime.webp",
    name: "Quantico",
    url: "https://quantico.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/bird.webp",
    name: "IA",
    url: "https://ia.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/yt.webp",
    name: "Key",
    url: "https://keys.securityops.co",
  },
 {
    icon: "/System/Icons/Favicons/short.webp",
    name: "More",
    url: "https://i.securityops.com.br",
  },
 {
    icon: "/System/Icons/Favicons/share.webp",
    name: "Portfolio",
    url: "https://share.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/archive.webp",
    name: "Archives",
    url: "https://archive.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/chat.webp",
    name: "SecretChat",
    url: "https://chat.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/jitsi.webp",
    name: "Screen",
    url: "https://guix.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/osint.webp",
    name: "Info",
    url: "https://ip.securityops.co/",
  },
  {
    icon: "/System/Icons/Favicons/wiki.webp",
    name: "GIT",
    url: "https://git.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/torbrowser.webp",
    name: "DOCS",
    url: "https://office.securityops.co",
  },
 {
    icon: "/System/Icons/Favicons/home.webp",
    name: "Portfolio",
    url: "https://cristiancezarmoises.com",
  },
 {
    icon: "/System/Icons/Favicons/news.webp",
    name: "News",
    url: "https://news.securityops.co",
  },
  {
    icon: "/System/Icons/vaptvupt.webp",
    name: "Vaptvupt",
    url: "https://vaptvupt.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/chat.webp",
    name: "WhatsAppEl",
    url: "https://whatsappel.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/jitsi.webp",
    name: "TurboRec",
    url: "https://turborec.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/news.webp",
    name: "Redlib",
    url: "https://libre.securityops.co",
  },
  {
    icon: "/System/Icons/Favicons/home.webp",
    name: "Portfolio Ops",
    url: "https://portfolio.securityops.co",
  },
];

export const HOME_PAGE = "https://securityops.co";

// The Clearnet Browser's default search engine. securityops.co is the user's own
// SearXNG metasearch ("Security Search"); its search endpoint is GET /web?s=<query>
// (verified against the live searchbox form — the input is name="s" and the form
// posts to /web). Unlike the Tor Browser (which searches a .onion over Tor), these
// clearnet searches go over the normal connection; the host is first-party, so the
// results page loads DIRECT (real origin) rather than through the rewriting proxy.
export const CLEARNET_SEARCH_QUERY = "https://securityops.co/web?s=";

// Server-side privacy proxy (pages/api/proxy.ts). Routing remote pages through it
// (a) strips X-Frame-Options/CSP frame-ancestors so sites that block embedding
// finally load in the in-OS Browser, and (b) fetches them server-side — which
// exits through Tor when the server container is Tor-routed (deploy/docker-compose).
// Proxied content is rendered in a sandboxed, opaque-origin iframe so it can never
// touch the SecurityOS origin. Toggle OFF (shield button) for interactive/login
// sites (Jitsi, Collabora, chat) that need their real origin + cookies.
export const PROXY_PATH = "/api/proxy?url=";

export const PROXY_ENABLED_BY_DEFAULT = true;

// First-party SecurityOps apps are ALWAYS loaded directly (never proxied): they
// are interactive (Jitsi/Collabora/chat/git) and need their real origin, cookies
// and WebSockets, which the sandboxed/opaque proxy would break. The proxy's value
// is anonymizing/unblocking arbitrary THIRD-party sites, not the OS's own apps.
const FIRST_PARTY_SUFFIXES = [
  "securityops.co",
  "securityops.com.br",
  "cristiancezarmoises.com",
];

export const isFirstPartyUrl = (rawUrl: string): boolean => {
  try {
    const { hostname } = new URL(rawUrl);

    return FIRST_PARTY_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
};
