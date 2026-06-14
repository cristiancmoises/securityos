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
import useHistory from "hooks/useHistory";
import { extname } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "styles/common/Button";
import Icon from "styles/common/Icon";
import {
  FAVICON_BASE_PATH,
  IFRAME_CONFIG,
  ONE_TIME_PASSIVE_EVENT,
  SANDBOXED_IFRAME_CONFIG,
} from "utils/constants";
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

const Browser: FC<ComponentProcessProps> = ({ id }) => {
  const {
    icon: setIcon,
    linkElement,
    open,
    url: changeUrl,
    processes: { [id]: process },
  } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const initialUrl = url || HOME_PAGE;
  const { canGoBack, canGoForward, history, moveHistory, position } =
    useHistory(initialUrl, id);
  const { exists, readFile } = useFileSystem();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [srcDoc, setSrcDoc] = useState("");
  const [src, setSrc] = useState("");
  // Privacy proxy: ON routes remote pages through /api/proxy (server-side fetch via
  // Tor + strips X-Frame-Options/CSP so sites that block embedding load). OFF loads
  // the page directly (its real origin + cookies) — for interactive/login sites.
  const [proxyEnabled, setProxyEnabled] = useState(PROXY_ENABLED_BY_DEFAULT);
  // LibreJS-style filter (ON by default): the proxy keeps only first-party +
  // trivial/free-licensed JavaScript and strips third-party/nonfree scripts
  // (trackers, ads, fingerprinting). Toggle OFF to allow all JS on a page that
  // needs it. Only meaningful while the privacy proxy is ON.
  const [libreJsEnabled, setLibreJsEnabled] = useState(true);
  const currentUrl = useRef("");
  const changeHistory = (step: number): void => {
    moveHistory(step);

    if (inputRef.current) inputRef.current.value = history[position + step];
  };
  const setUrl = useCallback(
    async (addressInput: string): Promise<void> => {
      setLoading(true);

      const isHtml =
        [".htm", ".html"].includes(extname(addressInput).toLowerCase()) &&
        (await exists(addressInput));

      // Resolve everything we await BEFORE touching iframe state, so the iframe
      // transitions old -> new in a single render (no about:blank flicker that
      // would fire a premature onLoad).
      if (isHtml) {
        const content = (await readFile(addressInput)).toString();

        setSrc("");
        setSrcDoc(content);
        setIcon(id, processDirectory.Browser.icon);
        return;
      }

      const addressUrl = await getUrlOrSearch(
        addressInput,
        CLEARNET_SEARCH_QUERY
      );

      // This is the CLEARNET browser — it opens any website in the webOS. .onion
      // sites need Tor, so hand those off to the dedicated Tor Browser.
      if (isHttpUrl(addressUrl) && isOnionUrl(addressUrl)) {
        open("TorBrowser", { url: addressInput });
        setLoading(false);
        if (inputRef.current) inputRef.current.value = currentUrl.current;
        return;
      }

      // First-party SecurityOps sites are interactive (login, cookies, WebSockets),
      // so load them DIRECT from their real origin. The rewriting proxy strips
      // cookies + opaque-sandboxes the page, which breaks these apps — that's why
      // securityops.co failed to load through the proxy before.
      const firstParty = isHttpUrl(addressUrl) && isFirstPartyUrl(addressUrl);

      // Route THIRD-party clearnet pages through the proxy with ?direct=1 (no Tor):
      // it strips X-Frame-Options/CSP so sites that block embedding still load,
      // blocks ads/trackers (&adblock=1), and filters JavaScript LibreJS-style.
      // The shield toggle loads the page directly (its real origin) instead.
      const useProxy = isHttpUrl(addressUrl) && proxyEnabled && !firstParty;

      setSrcDoc("");
      setSrc(
        useProxy
          ? `${PROXY_PATH}${encodeURIComponent(addressUrl)}&direct=1&adblock=1${
              libreJsEnabled ? "&librejs=1" : ""
            }`
          : addressUrl
      );
      setIcon(id, processDirectory.Browser.icon);

      // Keep the address bar in sync (unless the user is editing it).
      if (
        inputRef.current &&
        document.activeElement !== inputRef.current &&
        !addressUrl.startsWith(CLEARNET_SEARCH_QUERY)
      ) {
        inputRef.current.value = addressInput;
      }

      if (addressUrl.startsWith(CLEARNET_SEARCH_QUERY)) {
        prependFileToTitle(`${addressInput} - SecurityOps Search`);
      } else {
        const { name = "" } =
          bookmarks?.find(({ url: bookmarkUrl }) => bookmarkUrl === addressInput) ||
          {};

        prependFileToTitle(name);
      }

      const { icon: bookmarkIcon } =
        bookmarks?.find(({ url: bookmarkUrl }) => bookmarkUrl === addressInput) ||
        {};

      if (addressInput.startsWith("ipfs://")) {
        setIcon(id, "/System/Icons/Favicons/osint.webp");
      } else if (useProxy) {
        // Don't probe the remote favicon directly in proxy mode — it would leak
        // the visited host (bypassing Tor). Use the bookmark icon if known.
        if (bookmarkIcon) setIcon(id, bookmarkIcon);
      } else if (isHttpUrl(addressUrl)) {
        const favicon = new Image();
        const faviconUrl = `${new URL(addressUrl).origin}${FAVICON_BASE_PATH}`;

        favicon.addEventListener(
          "error",
          () => {
            if (bookmarkIcon) setIcon(id, bookmarkIcon);
          },
          ONE_TIME_PASSIVE_EVENT
        );
        favicon.addEventListener(
          "load",
          () => setIcon(id, faviconUrl),
          ONE_TIME_PASSIVE_EVENT
        );
        favicon.src = faviconUrl;
      }
    },
    [
      exists,
      id,
      libreJsEnabled,
      open,
      prependFileToTitle,
      proxyEnabled,
      readFile,
      setIcon,
    ]
  );
  const toggleProxy = useCallback((): void => {
    // Force the navigation effect to reload the current page in the new mode.
    currentUrl.current = "";
    setProxyEnabled((prev) => !prev);
  }, []);
  const toggleLibreJs = useCallback((): void => {
    currentUrl.current = "";
    setLibreJsEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (process && history[position] !== currentUrl.current) {
      currentUrl.current = history[position];
      setUrl(history[position]);
    }
  }, [history, position, process, setUrl]);

  useEffect(() => {
    if (iframeRef?.current) {
      linkElement(id, "peekElement", iframeRef.current);
    }
  }, [id, linkElement]);

  const proxied = src.startsWith(PROXY_PATH);
  const sandboxConfig =
    srcDoc || proxied ? SANDBOXED_IFRAME_CONFIG : IFRAME_CONFIG;

  return (
    <StyledBrowser $hasSrcDoc={Boolean(srcDoc)}>
      <nav>
        <div>
          <Button
            disabled={!canGoBack}
            onClick={() => changeHistory(-1)}
            {...label("Click to go back")}
          >
            <Arrow direction="left" />
          </Button>
          <Button
            disabled={!canGoForward}
            onClick={() => changeHistory(+1)}
            {...label("Click to go forward")}
          >
            <Arrow direction="right" />
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              currentUrl.current = "";
              setUrl(history[position]);
            }}
            {...label("Reload this page")}
          >
            {loading ? <Stop /> : <Refresh />}
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
              changeUrl(id, inputRef.current.value);
              window.getSelection()?.removeAllRanges();
              inputRef.current.blur();
            }
          }}
          type="text"
        />
      </nav>
      <nav>
        {bookmarks.map(({ name, icon, url: bookmarkUrl }) => (
          <Button
            key={name}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = bookmarkUrl;
              }

              changeUrl(id, bookmarkUrl);
            }}
            {...label(`${name}\n${bookmarkUrl}`)}
          >
            <Icon alt={name} imgSize={16} src={icon} />
          </Button>
        ))}
      </nav>
      <iframe
        ref={iframeRef}
        onLoad={() => setLoading(false)}
        src={src || undefined}
        srcDoc={srcDoc || undefined}
        title={id}
        {...sandboxConfig}
      />
    </StyledBrowser>
  );
};

export default Browser;
