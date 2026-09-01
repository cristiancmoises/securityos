import { PROXY_PATH } from "components/apps/Browser/config";
import { Arrow, Refresh, Stop } from "components/apps/Browser/NavigationIcons";
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
import { getUrlOrSearch, label } from "utils/functions";

// The Tor Browser start page: Torch, the long-running darknet search engine.
// It needs no JavaScript, so it renders in the JS-disabled "Safest" sandbox. If it
// ever goes down, the proxy shows a clear "this .onion looks offline" page and Tor
// itself keeps working.
const TOR_HOME =
  "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/";

// Address-bar search → Torch's own search (GET /search?query=).
const TOR_SEARCH_QUERY =
  "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/search?query=";

const CLEARNET_HOME = "https://search.brave.com/";
const CLEARNET_SEARCH_QUERY = "https://search.brave.com/search?q=";

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
    url: "http://secopshnfap6cllndkzxf7345kjlbgqvfdkyrv6jfwkkfcwxtdfcqgid.onion/",
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
    url: "http://secopsuwwht2unomwt3jofl33kfqsfd2z6cwip6rbqlapi7s4pys5vyd.onion/",
  },
  {
    name: "URL Shortener",
    url: "http://secops6ajpd6ggqtqbcgesq3f6ma67lzti4xj5qdyv3yirtl2mzatvyd.onion/",
  },
];

// First-party public services, available in the separate clearnet browser.  Keep
// this list deliberately explicit so opening the browser never leaks an onion
// address into a non-Tor request.
const CLEARNET_BOOKMARKS: { name: string; url: string }[] = [
  { name: "SecurityOps", url: "https://securityops.com.br/" },
  { name: "SecurityOps .co", url: "https://securityops.co/" },
  { name: "GODS EYE", url: "https://eye.securityops.co/" },
];

type Bookmark = { name: string; url: string };

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
const addressFromSrc = (src: string): string => {
  try {
    return new URL(src, window.location.origin).searchParams.get("url") || src;
  } catch {
    return src;
  }
};

// Pull the Tor isolation token out of a proxied src (e.g. a link the in-page shim
// opened in a new tab) so the new tab inherits the SAME circuit as the link it came
// from. Falls back to "" (caller then mints a fresh token).
const isoFromSrc = (src: string): string => {
  try {
    return new URL(src, window.location.origin).searchParams.get("iso") || "";
  } catch {
    return "";
  }
};

// An opaque 128-bit token used purely as the Tor SOCKS username:password for STREAM
// ISOLATION (see pages/api/proxy.ts). A unique token => a separate Tor circuit =>
// in general a different exit IP. It is NOT secret and reveals nothing about the
// real client; it only selects which circuit Tor uses. crypto.getRandomValues is
// fine here — this is client-side React (Math.random is avoided / may be unavailable).
const newIsoToken = (): string => {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

type Tab = {
  key: number;
  address: string;
  src: string;
  title: string;
  history: string[];
  position: number;
  loading: boolean;
  // Per-tab Tor stream-isolation token: gives this tab its own circuit/exit IP so
  // sites in different tabs can't be correlated by a shared exit. "New Tor circuit"
  // rotates it for a fresh exit. Stable across navigations within the tab.
  iso: string;
};

const blankTab = (key: number, address: string, iso?: string): Tab => ({
  key,
  address,
  src: "",
  title: "",
  history: address ? [address] : [],
  position: address ? 0 : -1,
  loading: false,
  iso: iso ?? newIsoToken(),
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
type JsMode = "off" | "noscript" | "all";

const NEXT_JS_MODE: Record<JsMode, JsMode> = {
  off: "noscript",
  noscript: "all",
  all: "off",
};

const JS_MODE_LABEL: Record<JsMode, string> = {
  off: "Scripts: OFF — Safest (all JavaScript blocked). Click for NoScript mode (first-party scripts only).",
  noscript:
    "Scripts: NoScript — first-party scripts only, third-party blocked. Click to allow ALL scripts.",
  all: "Scripts: ALL allowed. Click to block everything (Safest).",
};

export type BrowserMode = "tor" | "clearnet";

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
  // Secure-by-default, every launch: NoScript "Safest" (jsMode "off" -> all
  // JavaScript blocked, script-src 'none', sandbox drops allow-scripts) and the
  // Security Ops extension OFF (its scripts — incl. secops-reporter — never load,
  // so no telemetry). The user can opt into scripts / the extension per session;
  // it never persists, so a fresh window is always the hardened state.
  const [jsMode, setJsMode] = useState<JsMode>("off");
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
    ): Promise<{ src: string; address: string }> => {
      const addressUrl = await getUrlOrSearch(addressInput, searchQuery);

      if (!/^https?:/.test(addressUrl))
        return { src: "", address: addressInput };

      return {
        // &iso=<tab token> pins this tab to its own Tor circuit (separate exit IP).
        src: `${PROXY_PATH}${encodeURIComponent(addressUrl)}${
          jsMode === "off"
            ? "&nojs=1"
            : jsMode === "noscript"
            ? "&librejs=1"
            : ""
        }${extEnabled ? "&ext=1" : ""}${isTor && iso ? `&iso=${iso}` : ""}${
          isTor ? "" : "&direct=1"
        }`,
        address: addressInput,
      };
    },
    [extEnabled, isTor, jsMode, searchQuery]
  );

  const navigateTab = useCallback(
    async (
      key: number,
      addressInput: string,
      push = true,
      // Override the tab's isolation token (used when opening a brand-new tab whose
      // state hasn't committed yet). Otherwise the tab's current token is used.
      isoOverride?: string
    ): Promise<void> => {
      patchTab(key, { loading: true });

      const iso =
        isoOverride ?? tabsRef.current.find((t) => t.key === key)?.iso ?? "";
      const { src, address } = await resolveSrc(addressInput, iso);

      setTabs((prev) =>
        prev.map((t) => {
          if (t.key !== key) return t;

          const history = push
            ? [...t.history.slice(0, t.position + 1), address]
            : t.history;

          return {
            ...t,
            address,
            src,
            history,
            position: push ? history.length - 1 : t.position,
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
      void navigateTab(key, addressInput, true, iso);
    },
    [home, navigateTab]
  );

  const openProxiedTab = useCallback((proxiedSrc: string): void => {
    keyCounter.current += 1;
    const key = keyCounter.current;
    const address = addressFromSrc(proxiedSrc);
    // Inherit the circuit of the link that spawned this tab (the shim carried the
    // parent's &iso=); mint a fresh one only if the src somehow has none.
    const iso = isoFromSrc(proxiedSrc) || newIsoToken();

    setTabs((prev) => [
      ...prev,
      { ...blankTab(key, address, iso), src: proxiedSrc, loading: true },
    ]);
    setActiveKey(key);
  }, []);

  const closeTab = useCallback(
    (key: number): void => {
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

  const removeBookmark = useCallback((url: string): void => {
    setUserBookmarks((prev) => {
      const next = prev.filter((bookmark) => bookmark.url !== url);

      writeUserBookmarks(mode, next);

      return next;
    });
  }, [mode]);

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
      void navigateTab(activeKey, bookmarkUrl, true);
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
    if (tab.address) void navigateTab(activeKey, tab.address, false, iso);
  }, [activeKey, navigateTab, patchTab]);

  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      void navigateTab(0, initialUrl, false);
    }
  }, [initialUrl, navigateTab]);

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as {
        __sosNewTab?: unknown;
        __sosTitle?: unknown;
        __sosHref?: unknown;
      };
      const prefix = `${window.location.origin}/api/proxy?`;

      if (
        typeof data?.__sosNewTab === "string" &&
        data.__sosNewTab.startsWith(prefix)
      ) {
        openProxiedTab(data.__sosNewTab);
      } else if (
        typeof data?.__sosTitle === "string" &&
        data.__sosTitle &&
        typeof data?.__sosHref === "string"
      ) {
        const target = addressFromSrc(data.__sosHref);
        const title = data.__sosTitle.slice(0, 120);

        setTabs((prev) =>
          prev.map((t) =>
            t.src && addressFromSrc(t.src) === target ? { ...t, title } : t
          )
        );
      }
    };

    window.addEventListener("message", onMessage);

    return () => window.removeEventListener("message", onMessage);
  }, [openProxiedTab]);

  useEffect(() => {
    if (!activeTab) return;

    prependFileToTitle(tabLabel(activeTab));

    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = activeTab.address;
    }
  }, [activeTab, prependFileToTitle]);

  // Reload the active tab when a mode toggle (JS / extension) changes.
  useEffect(() => {
    if (activeTab?.address)
      void navigateTab(activeKey, activeTab.address, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsMode, extEnabled]);

  const canGoBack = (activeTab?.position ?? 0) > 0;
  const canGoForward =
    activeTab && activeTab.position < activeTab.history.length - 1;

  const go = (step: number): void => {
    if (!activeTab) return;
    const position = activeTab.position + step;
    const address = activeTab.history[position];

    if (address === undefined) return;
    patchTab(activeKey, { position });
    if (inputRef.current) inputRef.current.value = address;
    void navigateTab(activeKey, address, false);
  };

  return (
    <StyledBrowser $hasSrcDoc={false}>
      <nav className="tabstrip">
        {tabs.map((tab) => (
          <span
            key={tab.key}
            className={tab.key === activeKey ? "tab active" : "tab"}
          >
            <button
              className="tab-select"
              onClick={() => selectTab(tab.key)}
              type="button"
              {...label(tab.address || "New tab")}
            >
              {tabLabel(tab)}
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
            disabled={activeTab?.loading}
            onClick={() =>
              activeTab && navigateTab(activeKey, activeTab.address, false)
            }
            {...label("Reload this page")}
          >
            {activeTab?.loading ? <Stop /> : <Refresh />}
          </Button>
          {isTor && <Button
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
          </Button>}
          <Button onClick={toggleJs} {...label(JS_MODE_LABEL[jsMode])}>
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
          defaultValue={initialUrl}
          enterKeyHint="go"
          onFocusCapture={() => inputRef.current?.select()}
          onKeyDown={({ key }) => {
            if (inputRef.current && key === "Enter") {
              void navigateTab(activeKey, inputRef.current.value, true);
              window.getSelection()?.removeAllRanges();
              inputRef.current.blur();
            }
          }}
          type="text"
        />
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
      {tabs.map((tab) => (
        <iframe
          key={tab.key}
          ref={tab.key === activeKey ? iframeRef : undefined}
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
