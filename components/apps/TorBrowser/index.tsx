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

// The Tor Browser start page: the verified live darknet search hidden service.
// It needs no JavaScript, so it renders in the JS-disabled "Safest" sandbox. If it
// ever goes down, the proxy shows a clear "this .onion looks offline" page and Tor
// itself keeps working.
const TOR_HOME =
  "http://2fd6cemt4gmccflhm6imvdfvli3nf7zn6rfrwpsy7uhxrgbypvwf5fad.onion/";

// Address-bar search → the home onion's own search (GET /search?query=). To use
// the operator's clearnet Security Search instead, set this to
// "https://securityops.co/web?s=".
const TOR_SEARCH_QUERY =
  "http://2fd6cemt4gmccflhm6imvdfvli3nf7zn6rfrwpsy7uhxrgbypvwf5fad.onion/search?query=";

// Bookmarks. "Search" is the home onion above; the rest are the operator's .onion
// hidden services — they resolve only while their listeners are running (otherwise
// the proxy shows a clear "this .onion looks offline" page, not a Tor error).
const BOOKMARKS: { name: string; url: string }[] = [
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
    name: "SecChat",
    url: "http://secops5qrrxmlsv3nezdyxc77v7cg57civtre6tqr2phk6uwvrxccjqd.onion/",
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

type Tab = {
  key: number;
  address: string;
  src: string;
  title: string;
  history: string[];
  position: number;
  loading: boolean;
};

const blankTab = (key: number, address: string): Tab => ({
  key,
  address,
  src: "",
  title: "",
  history: address ? [address] : [],
  position: address ? 0 : -1,
  loading: false,
});

const tabLabel = (tab: Tab): string =>
  (tab.title || tab.address || "New tab").replace(/^https?:\/\//, "");

const TorBrowser: FC<ComponentProcessProps> = ({ id }) => {
  const {
    processes: { [id]: process },
  } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const initialUrl = url || TOR_HOME;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const keyCounter = useRef(0);
  const [jsEnabled, setJsEnabled] = useState(false);
  const [extEnabled, setExtEnabled] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>(() => [blankTab(0, initialUrl)]);
  const [activeKey, setActiveKey] = useState(0);

  const activeTab = useMemo(
    () => tabs.find((t) => t.key === activeKey) || tabs[0],
    [tabs, activeKey]
  );

  const patchTab = useCallback(
    (key: number, patch: Partial<Tab>): void =>
      setTabs((prev) =>
        prev.map((t) => (t.key === key ? { ...t, ...patch } : t))
      ),
    []
  );

  const resolveSrc = useCallback(
    async (addressInput: string): Promise<{ src: string; address: string }> => {
      const addressUrl = await getUrlOrSearch(addressInput, TOR_SEARCH_QUERY);

      if (!/^https?:/.test(addressUrl)) return { src: "", address: addressInput };

      return {
        src: `${PROXY_PATH}${encodeURIComponent(addressUrl)}${
          jsEnabled ? "" : "&nojs=1"
        }${extEnabled ? "&ext=1" : ""}`,
        address: addressInput,
      };
    },
    [extEnabled, jsEnabled]
  );

  const navigateTab = useCallback(
    async (key: number, addressInput: string, push = true): Promise<void> => {
      patchTab(key, { loading: true });

      const { src, address } = await resolveSrc(addressInput);

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
    (addressInput: string = TOR_HOME): void => {
      keyCounter.current += 1;
      const key = keyCounter.current;

      setTabs((prev) => [...prev, blankTab(key, "")]);
      setActiveKey(key);
      void navigateTab(key, addressInput, true);
    },
    [navigateTab]
  );

  const openProxiedTab = useCallback((proxiedSrc: string): void => {
    keyCounter.current += 1;
    const key = keyCounter.current;
    const address = addressFromSrc(proxiedSrc);

    setTabs((prev) => [
      ...prev,
      { ...blankTab(key, address), src: proxiedSrc, loading: true },
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

  const toggleJs = useCallback((): void => setJsEnabled((prev) => !prev), []);
  const toggleExt = useCallback((): void => setExtEnabled((prev) => !prev), []);

  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      void navigateTab(0, initialUrl, false);
    }
  }, [initialUrl, navigateTab]);

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const candidate = (event.data as { __sosNewTab?: unknown })?.__sosNewTab;
      const prefix = `${window.location.origin}/api/proxy?`;

      if (typeof candidate === "string" && candidate.startsWith(prefix)) {
        openProxiedTab(candidate);
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
    if (activeTab?.address) void navigateTab(activeKey, activeTab.address, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsEnabled, extEnabled]);

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
        <div>
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
          <Button
            onClick={toggleJs}
            {...label(
              jsEnabled
                ? "JavaScript ENABLED — click to disable (Safest)"
                : "JavaScript disabled (Safest) — click to enable"
            )}
          >
            <svg
              height="16"
              opacity={jsEnabled ? 1 : 0.4}
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
        {BOOKMARKS.map(({ name, url: bookmarkUrl }) => (
          <Button
            key={name}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = bookmarkUrl;
              void navigateTab(activeKey, bookmarkUrl, true);
            }}
            {...label(`${name}\n${bookmarkUrl}`)}
          >
            {name}
          </Button>
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
          {...(jsEnabled ? SANDBOXED_IFRAME_CONFIG : NOSCRIPT_IFRAME_CONFIG)}
        />
      ))}
    </StyledBrowser>
  );
};

export default TorBrowser;
