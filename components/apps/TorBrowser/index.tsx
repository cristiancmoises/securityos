import {
  CLEARNET_BOOKMARKS,
  CLEARNET_HOME,
  CLEARNET_ONION_BLOCKED_PAGE,
  CLEARNET_SEARCH_QUERY,
  DEFAULT_CLEARNET_JS_MODE,
  DEFAULT_TOR_JS_MODE,
  isOnionUrl,
  PROXY_PATH,
} from "components/apps/Browser/config";
import {
  Arrow,
  ExternalLink,
  Home,
  Refresh,
  Stop,
} from "components/apps/Browser/NavigationIcons";
import StyledBrowser from "components/apps/Browser/StyledBrowser";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useProcesses } from "contexts/process";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "styles/common/Button";
import {
  NOSCRIPT_IFRAME_CONFIG,
  SANDBOXED_IFRAME_CONFIG,
} from "utils/constants";
import { getUrlOrSearch, label, updateBrowserHistory } from "utils/functions";
import { fetchProxyCapability } from "utils/useProxyCapability";

// The Tor Browser start page: Torch, the long-running darknet search engine.
// It needs no JavaScript, so it renders in the JS-disabled "Safest" sandbox. If it
// ever goes down, the proxy shows a clear "this .onion looks offline" page and Tor
// itself keeps working.
const TOR_HOME =
  "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/";

// Address-bar search → Torch's own search (GET /search?query=).
const TOR_SEARCH_QUERY =
  "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/search?query=";

// Bookmarks. "Search" is the home onion above; the rest are the operator's .onion
// hidden services — they resolve only while their listeners are running (otherwise
// the proxy shows a clear "this .onion looks offline" page, not a Tor error).
const TOR_BOOKMARKS: { name: string; url: string }[] = [
  { name: "Search", url: TOR_HOME },
  {
    name: "Hacker News",
    url: "http://secopss43hhdlot4xf7iinqknjdzjczrhnabgub3rjl3nrrwki26q6id.onion/",
  },
  {
    name: "SecTube",
    url: "http://secopsenznutinn7xhhpmqnsutbprf4ppefhznsmspa54x4kwx6olgqd.onion/",
  },
  {
    name: "Binternet",
    url: "http://secopspz6zsdlmbkfjnvqlp4hdyvxtvutnfzesj5tf66u2vui2e7kvad.onion/",
  },
  {
    name: "WebCheck",
    url: "http://secopspqmua4vjdpkhuu6b3dh45o5t7bdch4wl2xadicpksbwi2xp2qd.onion/",
  },
  {
    name: "Keywave",
    // The historical onion is currently unreachable; the live service still
    // traverses Tor because this browser proxies clearnet destinations via SOCKS5h.
    url: "https://chat.securityops.co/",
  },
  {
    name: "PrivateBin",
    url: "http://secopslhalclg4yet3mn6ftp25ncxsfrkrjsvkzfq4rrlxhf2zujbtyd.onion/",
  },
  {
    name: "Passky",
    url: "http://secopsqofiycgsnq2oksndqed2bbeh5ggeskiuy6jet326mhnm6rc7id.onion/",
  },
  {
    name: "Forgejo Git",
    url: "http://secopsrcfow4lzndhjsgetvwgxfc4h6citkc6alwy4tw7xluvjouytad.onion/",
  },
  {
    name: "Zupt Web",
    // Same routing rule as every Tor Browser clearnet tab: no direct fallback.
    url: "https://share.securityops.co/",
  },
  {
    name: "URL Shortener",
    url: "http://secops6ajpd6ggqtqbcgesq3f6ma67lzti4xj5qdyv3yirtl2mzatvyd.onion/",
  },
];

const KEYWAVE_ORIGIN = "https://chat.securityops.co";
const ZUPT_WEB_ORIGIN = "https://share.securityops.co";

type Bookmark = { name: string; url: string };
export type BrowserMode = "clearnet" | "tor";

// User bookmarks (the built-in BOOKMARKS above are the operator's onion services;
// these are sites the USER saves). Persisted in localStorage so they survive
// reopening the window. Best-effort: malformed/old storage is dropped, not thrown.
const LS_USER_BOOKMARKS = "securityos:%mode%browser:bookmarks";

const readUserBookmarks = (mode: BrowserMode): Bookmark[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      LS_USER_BOOKMARKS.replace("%mode%", mode)
    );
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is Bookmark =>
            !!entry &&
            typeof (entry as Bookmark).url === "string" &&
            typeof (entry as Bookmark).name === "string"
        )
      : [];
  } catch {
    return [];
  }
};

const writeUserBookmarks = (mode: BrowserMode, bookmarks: Bookmark[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LS_USER_BOOKMARKS.replace("%mode%", mode),
      JSON.stringify(bookmarks)
    );
  } catch {
    // localStorage full/unavailable — bookmarks are a best-effort convenience.
  }
};

// A dedicated anonymous browser: every site is fetched server-side through Tor
// (the /api/proxy SOCKS5h path), rendered in an opaque-origin sandbox. JavaScript
// is DISABLED by default ("Safest") — the proxy strips scripts + sets script-src
// 'none', and the iframe drops allow-scripts. Toggle JS on per session if needed.
// Tabs (in no-JS mode, the sandbox forbids scripts, so links open in the current
// tab and new tabs come from the + button; with JS on, ctrl/middle-click + pop-ups
// open new tabs via the in-page shim).
const addressFromProxySrc = (src: string): string => {
  try {
    const proxyUrl = new URL(src, window.location.origin);

    if (
      proxyUrl.origin !== window.location.origin ||
      proxyUrl.pathname !== "/api/proxy"
    ) {
      return "";
    }

    const address = proxyUrl.searchParams.get("url");

    if (!address) return "";

    const addressUrl = new URL(address);

    return addressUrl.protocol === "http:" || addressUrl.protocol === "https:"
      ? addressUrl.href
      : "";
  } catch {
    return "";
  }
};

// An opaque 128-bit token used as the Tor SOCKS username:password for STREAM
// ISOLATION (see pages/api/proxy.ts). A unique token => a separate Tor circuit =>
// in general a different exit IP. Exact-origin ZUPT also uses it as the key for its
// ephemeral server-side CSRF jar. crypto.getRandomValues avoids predictable tokens.
const newIsoToken = (): string => {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

type Tab = {
  address: string;
  history: string[];
  // Per-tab isolation token: selects a Tor circuit in Tor mode and separates the
  // exact-origin ZUPT CSRF jar in either route. Stable across tab navigation.
  iso: string;
  key: number;
  loading: boolean;
  position: number;
  // Forces a genuine iframe navigation even when reloading the same URL. React
  // otherwise sees an unchanged `src` prop and the reload button becomes inert.
  revision: number;
  src: string;
  syncPending: boolean;
  title: string;
};

const blankTab = (key: number, address: string, iso?: string): Tab => ({
  address,
  history: address ? [address] : [],
  iso: iso ?? newIsoToken(),
  key,
  loading: false,
  position: address ? 0 : -1,
  revision: 0,
  src: "",
  syncPending: false,
  title: "",
});

const tabLabel = (tab: Tab): string => {
  if (tab.title) return tab.title;
  if (!tab.address) return "New tab";

  try {
    return new URL(tab.address).hostname || tab.address;
  } catch {
    return tab.address.replace(/^https?:\/\//, "");
  }
};

// NoScript-style three-state script control (the "block everything" half of
// NoScript ships as the default "off"; the middle state is NoScript's typical
// "allow this site, block third parties", enforced server-side by the proxy's
// LibreJS filter — same-origin scripts kept, cross-origin stripped, before they
// ever reach the client):
//   off      -> ?nojs=1   : ALL scripts stripped + CSP script-src 'none' (Safest)
//   noscript -> ?librejs=1: first-party scripts only; third-party blocked
//   all      -> (none)    : every script runs
type JsMode = "all" | "noscript" | "off";

const NEXT_JS_MODE: Record<JsMode, JsMode> = {
  all: "off",
  noscript: "all",
  off: "noscript",
};

const JS_MODE_LABEL: Record<JsMode, string> = {
  all: "Scripts: ALL allowed. Click to block everything (Safest).",
  noscript:
    "Scripts: NoScript — first-party scripts only, third-party blocked. Click to allow ALL scripts.",
  off: "Scripts: OFF — Safest (all JavaScript blocked). Click for NoScript mode (first-party scripts only).",
};

type BrowserProps = ComponentProcessProps & { mode?: BrowserMode };

// Shared browser engine. Tor mode always uses SOCKS5h through the server-side Tor
// proxy; clearnet mode explicitly opts into the ordinary egress path. Both retain
// sandboxed rendering, SSRF protection, tabs, history, and per-session JS controls.
export const Browser: FC<BrowserProps> = ({ id, mode = "tor" }) => {
  const {
    processes: { [id]: process },
  } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const isTor = mode === "tor";
  const home = isTor ? TOR_HOME : CLEARNET_HOME;
  const searchQuery = isTor ? TOR_SEARCH_QUERY : CLEARNET_SEARCH_QUERY;
  const bookmarks = isTor ? TOR_BOOKMARKS : CLEARNET_BOOKMARKS;
  const initialUrl = url || home;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const keyCounter = useRef(0);
  const navigationCounter = useRef(0);
  const pendingNavigations = useRef(new Map<number, number>());
  // Tor launches in NoScript "Safest" mode; clearnet launches with JavaScript for
  // normal site compatibility. The Security Ops extension stays off in both modes,
  // and neither setting persists between browser sessions.
  const [jsMode, setJsMode] = useState<JsMode>(
    isTor ? DEFAULT_TOR_JS_MODE : DEFAULT_CLEARNET_JS_MODE
  );
  const [capabilityError, setCapabilityError] = useState(false);
  const [extEnabled, setExtEnabled] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(() => [blankTab(0, initialUrl)]);
  const [activeKey, setActiveKey] = useState(0);

  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) || tabs[0],
    [tabs, activeKey]
  );

  // Latest tabs, readable inside callbacks without making them depend on `tabs`
  // (so navigateTab can look up a tab's isolation token without invalidating every
  // memoized callback on each navigation).
  const tabsRef = useRef(tabs);

  tabsRef.current = tabs;

  const patchTab = useCallback(
    (key: number, patch: Partial<Tab>): void =>
      setTabs((prev) =>
        prev.map((t) => (t.key === key ? { ...t, ...patch } : t))
      ),
    []
  );

  const resolveSrc = useCallback(
    async (
      addressInput: string,
      iso: string
    ): Promise<{ address: string; src: string }> => {
      const addressUrl = await getUrlOrSearch(addressInput, searchQuery);

      if (!/^https?:/.test(addressUrl)) {
        return { address: addressInput, src: "" };
      }

      // Never send a hidden-service hostname to the host resolver. Clearnet and
      // Tor are separate applications; the user must open .onion destinations in
      // Tor Browser explicitly rather than receiving a silent route switch.
      if (!isTor && isOnionUrl(addressUrl)) {
        return { address: addressUrl, src: CLEARNET_ONION_BLOCKED_PAGE };
      }

      let isKeywave = false;
      let isZupt = false;

      try {
        const targetOrigin = new URL(addressUrl).origin;

        isKeywave = isTor && targetOrigin === KEYWAVE_ORIGIN;
        isZupt = targetOrigin === ZUPT_WEB_ORIGIN;
      } catch {
        // getUrlOrSearch already produced an HTTP(S) URL; keep special modes off if
        // an unusual implementation still fails URL parsing here.
      }

      const profile = isKeywave ? "keywave" : isZupt ? "zupt" : "browser";
      const routeCapability = await fetchProxyCapability(
        isTor ? "tor" : "direct",
        profile,
        iso,
        jsMode
      );

      return {
        // Keep the omnibox and history aligned with the destination actually
        // requested. In particular, free-text searches become their complete
        // SecurityOps/Torch search URL instead of leaving stale query text behind.
        address: addressUrl,
        // &iso=<tab token> pins this tab to its own Tor circuit (separate exit IP).
        src: `${PROXY_PATH}${encodeURIComponent(addressUrl)}${
          jsMode === "off"
            ? "&nojs=1"
            : jsMode === "noscript"
            ? "&librejs=1"
            : ""
        }${extEnabled ? "&ext=1" : ""}${isKeywave ? "&keywave=1" : ""}${
          isZupt ? "&zupt=1" : ""
        }&profile=${profile}${iso ? `&iso=${iso}` : ""}${
          isTor ? "" : "&direct=1"
        }&cap=${encodeURIComponent(routeCapability)}`,
      };
    },
    [extEnabled, isTor, jsMode, searchQuery]
  );

  const navigateTab = useCallback(
    async (
      key: number,
      addressInput: string,
      push: boolean,
      // Override the tab's isolation token (used when opening a brand-new tab whose
      // state hasn't committed yet). Otherwise the tab's current token is used.
      isoOverride?: string
    ): Promise<void> => {
      navigationCounter.current += 1;
      const navigationId = navigationCounter.current;

      pendingNavigations.current.set(key, navigationId);
      patchTab(key, { loading: true });

      const iso =
        isoOverride ?? tabsRef.current.find((t) => t.key === key)?.iso ?? "";
      let resolved: { address: string; src: string };

      try {
        resolved = await resolveSrc(addressInput, iso);
        setCapabilityError(false);
      } catch {
        setCapabilityError(true);
        // A failed async resolver (for example an unavailable IPFS gateway
        // module) must not leave the tab permanently showing a loading state.
        if (pendingNavigations.current.get(key) === navigationId) {
          pendingNavigations.current.delete(key);
          patchTab(key, { loading: false });
        }
        return;
      }

      // A newer address-bar submission or Stop action wins. This prevents a slow
      // async resolution from unexpectedly replacing the page the user chose.
      if (pendingNavigations.current.get(key) !== navigationId) return;
      pendingNavigations.current.delete(key);

      const { src, address } = resolved;

      setTabs((prev) =>
        prev.map((t) => {
          if (t.key !== key) return t;

          const nextHistory = push
            ? updateBrowserHistory(t.history, t.position, address)
            : { history: t.history, position: t.position };

          return {
            ...t,
            address,
            history: nextHistory.history,
            loading: Boolean(src),
            position: nextHistory.position,
            revision: t.revision + 1,
            src,
            syncPending: Boolean(src),
            title: address === t.address ? t.title : "",
          };
        })
      );
    },
    [patchTab, resolveSrc]
  );

  const openTab = useCallback(
    (addressInput: string = home): void => {
      keyCounter.current += 1;
      const key = keyCounter.current;
      // Generate the new tab's isolation token here so the immediate navigateTab
      // (before state commits) routes through the correct per-tab circuit.
      const iso = newIsoToken();

      setTabs((prev) => [...prev, blankTab(key, "", iso)]);
      setActiveKey(key);
      navigateTab(key, addressInput, true, iso);
      window.requestAnimationFrame(() => inputRef.current?.select());
    },
    [home, navigateTab]
  );

  const closeTab = useCallback(
    (key: number): void => {
      pendingNavigations.current.delete(key);
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const index = prev.findIndex((t) => t.key === key);
        const next = prev.filter((t) => t.key !== key);

        if (key === activeKey) {
          const fallback = next[Math.max(0, index - 1)];

          if (fallback) setActiveKey(fallback.key);
        }

        return next;
      });
    },
    [activeKey]
  );

  const selectTab = useCallback(
    (key: number): void => {
      setActiveKey(key);
      const tab = tabs.find((t) => t.key === key);

      if (tab && inputRef.current) inputRef.current.value = tab.address;
    },
    [tabs]
  );

  // ---- User bookmarks (persisted) ----------------------------------------
  const [userBookmarks, setUserBookmarks] = useState<Bookmark[]>(() =>
    readUserBookmarks(mode)
  );

  const removeBookmark = useCallback(
    (bookmarkUrl: string): void => {
      setUserBookmarks((prev) => {
        const next = prev.filter((bookmark) => bookmark.url !== bookmarkUrl);

        writeUserBookmarks(mode, next);

        return next;
      });
    },
    [mode]
  );

  // Save the active tab's current address (deduped). Names default to the page
  // title, then the hostname, then the raw address.
  const addBookmark = useCallback((): void => {
    const tab = tabsRef.current.find((t) => t.key === activeKey);
    const address = tab?.address?.trim();

    if (!address) return;
    // The operator's built-in bookmarks are always shown in the bar — don't add a
    // duplicate user chip for one.
    if (bookmarks.some((bookmark) => bookmark.url === address)) return;

    setUserBookmarks((prev) => {
      if (prev.some((bookmark) => bookmark.url === address)) return prev;

      const name = (tab?.title || tabLabel(tab as Tab) || address).slice(0, 40);
      const next = [...prev, { name, url: address }];

      writeUserBookmarks(mode, next);

      return next;
    });
  }, [activeKey, bookmarks, mode]);

  const goToBookmark = useCallback(
    (bookmarkUrl: string): void => {
      if (inputRef.current) inputRef.current.value = bookmarkUrl;
      navigateTab(activeKey, bookmarkUrl, true);
    },
    [activeKey, navigateTab]
  );

  // A built-in operator bookmark counts as already-bookmarked too, so the star
  // shows filled (★) on those pages and won't invite a duplicate user chip. The
  // star's remove path filters only userBookmarks, so clicking it on a built-in is
  // a harmless no-op (operator bookmarks aren't user-removable).
  const activeBookmarked = useMemo(
    () =>
      !!activeTab?.address &&
      (bookmarks.some((bookmark) => bookmark.url === activeTab.address) ||
        userBookmarks.some((bookmark) => bookmark.url === activeTab.address)),
    [activeTab?.address, bookmarks, userBookmarks]
  );

  const toggleJs = useCallback(
    (): void => setJsMode((prev) => NEXT_JS_MODE[prev]),
    []
  );
  const toggleExt = useCallback((): void => setExtEnabled((prev) => !prev), []);

  // "New Tor circuit" for the active tab: rotate its isolation token (new SOCKS
  // creds => Tor builds a fresh circuit => new exit IP) and reload the current
  // address through it. Tor Browser's "New Tor Circuit for this Site", at no cost.
  const newCircuit = useCallback((): void => {
    const tab = tabsRef.current.find((t) => t.key === activeKey);

    if (!tab) return;

    const iso = newIsoToken();

    patchTab(activeKey, { iso });
    if (tab.address) navigateTab(activeKey, tab.address, false, iso);
  }, [activeKey, navigateTab, patchTab]);

  const stopLoading = useCallback((): void => {
    pendingNavigations.current.delete(activeKey);

    try {
      iframeRef.current?.contentWindow?.stop();
    } catch {
      // Some engines deny stop() on an opaque-origin sandbox. Clearing the local
      // loading state still restores the reload control without weakening it.
    }

    patchTab(activeKey, { loading: false });
  }, [activeKey, patchTab]);

  const reload = useCallback((): void => {
    if (activeTab?.address) {
      navigateTab(activeKey, activeTab.address, false);
    }
  }, [activeKey, activeTab?.address, navigateTab]);

  const goHome = useCallback((): void => {
    if (inputRef.current) inputRef.current.value = home;
    navigateTab(activeKey, home, true);
  }, [activeKey, home, navigateTab]);

  const nativeWindowUrl = useMemo(() => {
    if (isTor || !activeTab?.address) return "";

    try {
      const parsed = new URL(activeTab.address);

      // Never hand an onion to the host browser: that can leak a DNS attempt and
      // defeats the strict separation between the clearnet and Tor apps.
      return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        !isOnionUrl(parsed.href)
        ? parsed.href
        : "";
    } catch {
      return "";
    }
  }, [activeTab?.address, isTor]);

  const openNativeWindow = useCallback((): void => {
    if (!nativeWindowUrl) return;

    const nativeWindow = window.open(
      nativeWindowUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (nativeWindow) nativeWindow.opener = undefined;
  }, [nativeWindowUrl]);

  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      navigateTab(0, initialUrl, false);
    }
  }, [initialUrl, navigateTab]);

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      // Proxied pages have an opaque origin, so origin matching is impossible.
      // Bind messages to this browser's active iframe instead: another app, popup,
      // or browser window must never create tabs or alter titles here.
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data as {
        __sosHref?: unknown;
        __sosNewTab?: unknown;
        __sosTitle?: unknown;
      };

      if (typeof data?.__sosNewTab === "string") {
        const address = addressFromProxySrc(data.__sosNewTab);

        // Extract only the destination. Rebuilding the URL through openTab enforces
        // this browser's routing mode, JS policy, extensions, and a fresh Tor
        // isolation token; page-controlled proxy flags are never trusted.
        if (address) openTab(address);
      } else if (typeof data?.__sosHref === "string") {
        const address = addressFromProxySrc(data.__sosHref);

        if (!address) return;

        const title =
          typeof data.__sosTitle === "string"
            ? data.__sosTitle.slice(0, 120)
            : undefined;

        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.key !== activeKey) return tab;

            const { history, position } = updateBrowserHistory(
              tab.history,
              tab.position,
              address,
              tab.syncPending
            );

            return {
              ...tab,
              address,
              history,
              position,
              syncPending: false,
              ...(title === undefined ? {} : { title }),
            };
          })
        );
      }
    };

    window.addEventListener("message", onMessage);

    return () => window.removeEventListener("message", onMessage);
  }, [activeKey, openTab]);

  useEffect(() => {
    if (!activeTab) return;

    prependFileToTitle(tabLabel(activeTab));

    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = activeTab.address;
    }
  }, [activeTab, prependFileToTitle]);

  const appliedPolicy = useRef({ extEnabled, jsMode });

  // Reload every tab when a mode toggle (JS / extension) really changes. The
  // iframe sandbox is global to this browser window, so leaving background tabs on
  // stale proxy flags would make the badge disagree with their effective policy.
  // Comparing values instead of a first-render boolean also survives React Strict
  // Mode's development effect replay without opening a second cold Tor circuit.
  useEffect(() => {
    if (
      appliedPolicy.current.extEnabled === extEnabled &&
      appliedPolicy.current.jsMode === jsMode
    ) {
      return;
    }

    appliedPolicy.current = { extEnabled, jsMode };

    tabsRef.current.forEach((tab) => {
      if (tab.address) {
        navigateTab(tab.key, tab.address, false).catch(() => false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsMode, extEnabled]);

  const canGoBack = (activeTab?.position ?? 0) > 0;
  const canGoForward =
    activeTab && activeTab.position < activeTab.history.length - 1;
  const jsModeName =
    jsMode === "all"
      ? "JS ALL"
      : jsMode === "noscript"
      ? "FIRST-PARTY JS"
      : "JS OFF";
  const hasTorPolicyWarning = isTor && jsMode !== "off";
  const hasBrowserWarning = capabilityError || hasTorPolicyWarning;
  const modeStatus = isTor
    ? jsMode === "off"
      ? "TOR · SAFEST · FAIL-CLOSED"
      : `TOR PROXY · ${jsModeName} · NAVIGATION RISK`
    : `DIRECT · ${jsModeName} · NOT ANONYMOUS`;

  const go = (step: number): void => {
    if (!activeTab) return;
    const position = activeTab.position + step;
    const address = activeTab.history[position];

    if (address === undefined) return;
    patchTab(activeKey, { position });
    if (inputRef.current) inputRef.current.value = address;
    navigateTab(activeKey, address, false);
  };

  return (
    <StyledBrowser $hasSrcDoc={false} $hasTorPolicyWarning={hasBrowserWarning}>
      <nav className="tabstrip">
        {tabs.map((tab) => (
          <span
            key={tab.key}
            className={tab.key === activeKey ? "tab active" : "tab"}
          >
            <button
              aria-current={tab.key === activeKey ? "page" : undefined}
              className="tab-select"
              onAuxClick={({ button }) => button === 1 && closeTab(tab.key)}
              onClick={() => selectTab(tab.key)}
              type="button"
              {...label(tab.address || "New tab")}
            >
              {tab.loading && (
                <span aria-hidden="true" className="tab-spinner" />
              )}
              <span className="tab-title">{tabLabel(tab)}</span>
            </button>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={() => closeTab(tab.key)}
                type="button"
                {...label("Close tab")}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <button
          className="tab-new"
          onClick={() => openTab()}
          type="button"
          {...label("New tab")}
        >
          +
        </button>
      </nav>
      <nav className="controls">
        <div className="nav-buttons">
          <Button
            disabled={!canGoBack}
            onClick={() => go(-1)}
            {...label("Click to go back")}
          >
            <Arrow direction="left" />
          </Button>
          <Button
            disabled={!canGoForward}
            onClick={() => go(+1)}
            {...label("Click to go forward")}
          >
            <Arrow direction="right" />
          </Button>
          <Button
            onClick={activeTab?.loading ? stopLoading : reload}
            {...label(activeTab?.loading ? "Stop loading" : "Reload this page")}
          >
            {activeTab?.loading ? <Stop /> : <Refresh />}
          </Button>
          <Button onClick={goHome} {...label(`Home — ${home}`)}>
            <Home />
          </Button>
          {isTor && (
            <Button
              onClick={newCircuit}
              {...label("New Tor circuit for this site (fresh exit IP)")}
            >
              <svg height="16" viewBox="0 0 24 24" width="16">
                <path
                  d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2M19.5 12a7.5 7.5 0 0 1-12.9 5.2"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <path
                  d="M17.4 3v3.8h-3.8M6.6 21v-3.8h3.8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </Button>
          )}
          <Button
            onClick={toggleJs}
            {...label(
              `${JS_MODE_LABEL[jsMode]}${
                isTor
                  ? " Tor warning: script-driven frame navigation cannot be completely contained by an HTML-rewriting proxy."
                  : ""
              }`
            )}
          >
            <svg
              height="16"
              opacity={
                jsMode === "all" ? 1 : jsMode === "noscript" ? 0.7 : 0.35
              }
              viewBox="0 0 24 24"
              width="16"
            >
              <path
                d="M8 7 3 12l5 5M16 7l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </Button>
          <Button
            onClick={toggleExt}
            {...label(
              extEnabled
                ? "Security Ops extension ON — dark theme + ad/tracker block"
                : "Security Ops extension OFF — click to enable (dark theme, ad-block)"
            )}
          >
            <svg
              height="16"
              opacity={extEnabled ? 1 : 0.4}
              viewBox="0 0 24 24"
              width="16"
            >
              <circle
                cx="12"
                cy="12"
                fill="none"
                r="8.5"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <line
                stroke="currentColor"
                strokeWidth="1.7"
                x1="6.5"
                x2="17.5"
                y1="6.5"
                y2="17.5"
              />
            </svg>
          </Button>
        </div>
        <input
          ref={inputRef}
          aria-label={
            isTor
              ? "Tor address or private search"
              : "Clearnet address or SecurityOps search"
          }
          autoCapitalize="none"
          autoComplete="off"
          defaultValue={initialUrl}
          enterKeyHint="go"
          onFocusCapture={() => inputRef.current?.select()}
          onKeyDown={({ key }) => {
            if (inputRef.current && key === "Enter") {
              navigateTab(activeKey, inputRef.current.value, true);
              window.getSelection()?.removeAllRanges();
              inputRef.current.blur();
            } else if (key === "Escape") {
              if (activeTab?.loading) stopLoading();
              inputRef.current?.blur();
            }
          }}
          placeholder={
            isTor
              ? "Search privately with Torch or enter an address"
              : "Search SecurityOps or enter an address"
          }
          spellCheck={false}
          type="text"
        />
        {!isTor && (
          <Button
            className="native-window"
            disabled={!nativeWindowUrl}
            onClick={openNativeWindow}
            {...label(
              "Open in a native browser window for maximum site compatibility (direct connection; leaves the SecurityOS sandbox)"
            )}
          >
            <ExternalLink />
            <span>Full site</span>
          </Button>
        )}
        <span
          className={`mode-badge ${isTor ? "tor" : "direct"}`}
          {...label(
            isTor
              ? jsMode === "off"
                ? "Fail-closed Tor route with scripts disabled."
                : "Managed traffic uses Tor, but page scripts can force navigation outside an HTML-rewriting proxy."
              : "Direct clearnet route. Your network address is visible to sites."
          )}
        >
          {modeStatus}
        </span>
      </nav>
      <nav className="bookmarks">
        <Button
          className={`bm-star${activeBookmarked ? " on" : ""}`}
          disabled={!activeTab?.address}
          onClick={() =>
            activeBookmarked
              ? removeBookmark(activeTab?.address || "")
              : addBookmark()
          }
          {...label(
            activeBookmarked
              ? "Remove this page from bookmarks"
              : "Bookmark this page"
          )}
        >
          {activeBookmarked ? "★" : "☆"}
        </Button>
        {bookmarks.map(({ name, url: bookmarkUrl }) => (
          <Button
            key={name}
            onClick={() => goToBookmark(bookmarkUrl)}
            {...label(`${name}\n${bookmarkUrl}`)}
          >
            {name}
          </Button>
        ))}
        {userBookmarks.length > 0 && <span className="bm-sep" />}
        {userBookmarks.map(({ name, url: bookmarkUrl }) => (
          <span key={bookmarkUrl} className="bm-user">
            <Button
              className="bm-go"
              onClick={() => goToBookmark(bookmarkUrl)}
              {...label(`${name}\n${bookmarkUrl}`)}
            >
              {name}
            </Button>
            <Button
              className="bm-remove"
              onClick={() => removeBookmark(bookmarkUrl)}
              {...label("Remove bookmark")}
            >
              ×
            </Button>
          </span>
        ))}
      </nav>
      {capabilityError ? (
        <div className="tor-policy-warning" role="alert">
          SecurityOS could not authorize this network route.{" "}
          <button onClick={reload} type="button">
            Retry
          </button>
        </div>
      ) : hasTorPolicyWarning ? (
        <div className="tor-policy-warning" role="alert">
          JavaScript can force a raw frame navigation that a web proxy cannot
          intercept. Managed requests stay Tor-routed, but strict fail-closed
          anonymity requires JS OFF or a Tor-routed native browser/VM.
        </div>
      ) : undefined}
      {activeTab?.loading && (
        <div
          aria-label={isTor ? "Loading through Tor" : "Loading directly"}
          className="loading-track"
          role="progressbar"
        >
          <span />
        </div>
      )}
      {tabs.map((tab) => (
        <iframe
          key={`${tab.key}:${tab.revision}`}
          ref={tab.key === activeKey ? iframeRef : undefined}
          onError={() => patchTab(tab.key, { loading: false })}
          onLoad={() => patchTab(tab.key, { loading: false })}
          src={tab.src || undefined}
          style={{ display: tab.key === activeKey ? undefined : "none" }}
          title={`${id}-${tab.key}`}
          {...(jsMode === "off"
            ? NOSCRIPT_IFRAME_CONFIG
            : SANDBOXED_IFRAME_CONFIG)}
        />
      ))}
    </StyledBrowser>
  );
};

export default Browser;
