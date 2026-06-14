import {
  bookmarks,
  CLEARNET_SEARCH_QUERY,
  HOME_PAGE,
  isFirstPartyUrl,
  PROXY_ENABLED_BY_DEFAULT,
  PROXY_PATH,
} from "components/apps/Browser/config";
import { Arrow, Refresh, Stop } from "components/apps/Browser/NavigationIcons";
import StyledBrowser from "components/apps/Browser/StyledBrowser";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import processDirectory from "contexts/process/directory";
import { extname } from "path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "styles/common/Button";
import Icon from "styles/common/Icon";
import { IFRAME_CONFIG, SANDBOXED_IFRAME_CONFIG } from "utils/constants";
import { getUrlOrSearch, label } from "utils/functions";

const isHttpUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

const isOnionUrl = (value: string): boolean => {
  try {
    return new URL(value).hostname.toLowerCase().endsWith(".onion");
  } catch {
    return false;
  }
};

// A proxied iframe src either starts with the relative proxy path (address-bar
// navigations) or is the absolute same-origin proxy URL (links/pop-ups posted by
// the in-page shim). Either way it must render in the opaque sandbox.
const isProxiedSrc = (src: string): boolean =>
  Boolean(src) && (src.startsWith(PROXY_PATH) || src.includes("/api/proxy?"));

// Recover a human-readable address from a proxied src for the address bar / title.
const addressFromSrc = (src: string): string => {
  try {
    const u = new URL(src, window.location.origin);
    const target = u.searchParams.get("url");

    return target || src;
  } catch {
    return src;
  }
};

type Tab = {
  key: number;
  address: string;
  src: string;
  srcDoc: string;
  title: string;
  history: string[];
  position: number;
  loading: boolean;
};

const blankTab = (key: number, address: string): Tab => ({
  key,
  address,
  src: "",
  srcDoc: "",
  title: "",
  history: address ? [address] : [],
  position: address ? 0 : -1,
  loading: false,
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

const Browser: FC<ComponentProcessProps> = ({ id }) => {
  const {
    icon: setIcon,
    linkElement,
    open,
    processes: { [id]: process },
  } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const initialUrl = url || HOME_PAGE;
  const { exists, readFile } = useFileSystem();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const keyCounter = useRef(0);
  // Window-level (shared by every tab, like a normal browser's settings).
  const [proxyEnabled, setProxyEnabled] = useState(PROXY_ENABLED_BY_DEFAULT);
  const [libreJsEnabled, setLibreJsEnabled] = useState(true);
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

  // Resolve an address-bar entry into iframe state (the proxy/first-party/onion
  // decision), without touching React state, so callers can apply it to any tab.
  const resolveAddress = useCallback(
    async (
      addressInput: string
    ): Promise<
      | { handoff: true }
      | { handoff?: false; src: string; srcDoc: string; address: string }
    > => {
      const isHtml =
        [".htm", ".html"].includes(extname(addressInput).toLowerCase()) &&
        (await exists(addressInput));

      if (isHtml) {
        const content = (await readFile(addressInput)).toString();

        return { src: "", srcDoc: content, address: addressInput };
      }

      const addressUrl = await getUrlOrSearch(addressInput, CLEARNET_SEARCH_QUERY);

      // .onion needs Tor — hand off to the dedicated Tor Browser.
      if (isHttpUrl(addressUrl) && isOnionUrl(addressUrl)) {
        return { handoff: true };
      }

      const firstParty = isHttpUrl(addressUrl) && isFirstPartyUrl(addressUrl);
      const useProxy = isHttpUrl(addressUrl) && proxyEnabled && !firstParty;
      const src = useProxy
        ? `${PROXY_PATH}${encodeURIComponent(addressUrl)}&direct=1&adblock=1${
            libreJsEnabled ? "&librejs=1" : ""
          }`
        : addressUrl;

      return { src, srcDoc: "", address: addressInput };
    },
    [exists, libreJsEnabled, proxyEnabled, readFile]
  );

  // Navigate a tab. push=true records history (back/forward); replace updates in
  // place (initial load, reload, back/forward themselves).
  const navigateTab = useCallback(
    async (key: number, addressInput: string, push = true): Promise<void> => {
      patchTab(key, { loading: true });

      const result = await resolveAddress(addressInput);

      if (result.handoff) {
        open("TorBrowser", { url: addressInput });
        patchTab(key, { loading: false });
        return;
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.key !== key) return t;

          const history = push
            ? [...t.history.slice(0, t.position + 1), result.address]
            : t.history;

          return {
            ...t,
            address: result.address,
            src: result.src,
            srcDoc: result.srcDoc,
            history,
            position: push ? history.length - 1 : t.position,
          };
        })
      );
    },
    [open, patchTab, resolveAddress]
  );

  // Open a brand-new tab. addressInput omitted => the home page.
  const openTab = useCallback(
    (addressInput: string = HOME_PAGE): void => {
      keyCounter.current += 1;
      const key = keyCounter.current;

      setTabs((prev) => [...prev, blankTab(key, "")]);
      setActiveKey(key);
      void navigateTab(key, addressInput, true);
    },
    [navigateTab]
  );

  // Open an already-proxied src directly in a new tab (from the in-page shim:
  // pop-ups and ctrl/middle-clicks). No re-resolution — it is already a proxy URL.
  const openProxiedTab = useCallback((proxiedSrc: string): void => {
    keyCounter.current += 1;
    const key = keyCounter.current;
    const address = addressFromSrc(proxiedSrc);

    setTabs((prev) => [
      ...prev,
      {
        ...blankTab(key, address),
        src: proxiedSrc,
        loading: true,
      },
    ]);
    setActiveKey(key);
  }, []);

  const closeTab = useCallback(
    (key: number): void => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev; // keep at least one tab open
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

  // First load of the initial url (replace, don't push a duplicate history entry).
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      void navigateTab(0, initialUrl, false);
    }
  }, [initialUrl, navigateTab]);

  // The in-page shim posts { __sosNewTab } (a same-origin /api/proxy URL) for
  // pop-ups and ctrl/middle-clicked links — open each in a new tab. Validate the
  // URL is our own proxy endpoint so a page can't open an arbitrary/un-proxied tab.
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as {
        __sosNewTab?: unknown;
        __sosTitle?: unknown;
        __sosHref?: unknown;
      };
      const prefix = `${window.location.origin}/api/proxy?`;

      if (typeof data?.__sosNewTab === "string" && data.__sosNewTab.startsWith(prefix)) {
        openProxiedTab(data.__sosNewTab);
      } else if (
        typeof data?.__sosTitle === "string" &&
        data.__sosTitle &&
        typeof data?.__sosHref === "string"
      ) {
        // A proxied page reported its <title>. Apply it to whichever tab loaded
        // that URL (compared by the decoded target, since src may be relative).
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

  // Reflect the active tab into the window icon + title + address bar.
  useEffect(() => {
    if (!activeTab) return;

    setIcon(id, processDirectory.Browser.icon);
    prependFileToTitle(tabLabel(activeTab));

    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = activeTab.address;
    }
  }, [activeTab, id, prependFileToTitle, setIcon]);

  useEffect(() => {
    if (iframeRef?.current) linkElement(id, "peekElement", iframeRef.current);
  }, [activeKey, id, linkElement]);

  const toggleProxy = useCallback((): void => {
    setProxyEnabled((prev) => !prev);
  }, []);
  const toggleLibreJs = useCallback((): void => {
    setLibreJsEnabled((prev) => !prev);
  }, []);

  // Re-load the active tab when a window-level mode toggle changes.
  useEffect(() => {
    if (activeTab?.address) void navigateTab(activeKey, activeTab.address, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyEnabled, libreJsEnabled]);

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
    <StyledBrowser $hasSrcDoc={Boolean(activeTab?.srcDoc)}>
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
          <Button
            onClick={toggleProxy}
            {...label(
              proxyEnabled
                ? "Privacy proxy: ON (via Tor, unblocks framing) — click to load directly"
                : "Privacy proxy: OFF (direct) — click to enable Tor + unblock framing"
            )}
          >
            <svg height="16" viewBox="0 0 24 24" width="16">
              <path
                d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
                fill={proxyEnabled ? "currentColor" : "none"}
                fillOpacity={proxyEnabled ? 0.45 : 0}
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </Button>
          <Button
            disabled={!proxyEnabled}
            onClick={toggleLibreJs}
            {...label(
              libreJsEnabled
                ? "JavaScript: LibreJS filter ON (only free-licensed/first-party JS) — click to allow all JS"
                : "JavaScript: all allowed — click to re-enable the LibreJS filter"
            )}
          >
            <svg height="16" viewBox="0 0 24 24" width="16">
              <path
                d="M3 3h18v18H3z"
                fill={libreJsEnabled ? "currentColor" : "none"}
                fillOpacity={libreJsEnabled ? 0.18 : 0}
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M13 8v6.2a2.3 2.3 0 1 1-1.6-2.2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.9"
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
        {bookmarks.map(({ name, icon, url: bookmarkUrl }) => (
          <Button
            key={name}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = bookmarkUrl;
              void navigateTab(activeKey, bookmarkUrl, true);
            }}
            {...label(`${name}\n${bookmarkUrl}`)}
          >
            <Icon alt={name} imgSize={16} src={icon} />
          </Button>
        ))}
      </nav>
      {tabs.map((tab) => (
        <iframe
          key={tab.key}
          ref={tab.key === activeKey ? iframeRef : undefined}
          onLoad={() => patchTab(tab.key, { loading: false })}
          src={tab.src || undefined}
          srcDoc={tab.srcDoc || undefined}
          style={{ display: tab.key === activeKey ? undefined : "none" }}
          title={`${id}-${tab.key}`}
          {...(tab.srcDoc || isProxiedSrc(tab.src)
            ? SANDBOXED_IFRAME_CONFIG
            : IFRAME_CONFIG)}
        />
      ))}
    </StyledBrowser>
  );
};

export default Browser;
