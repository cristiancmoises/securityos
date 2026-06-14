import { PROXY_PATH } from "components/apps/Browser/config";
import { Arrow, Refresh, Stop } from "components/apps/Browser/NavigationIcons";
import StyledBrowser from "components/apps/Browser/StyledBrowser";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useProcesses } from "contexts/process";
import useHistory from "hooks/useHistory";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "styles/common/Button";
import {
  NOSCRIPT_IFRAME_CONFIG,
  SANDBOXED_IFRAME_CONFIG,
} from "utils/constants";
import { getUrlOrSearch, label } from "utils/functions";

// The Tor Browser start page. The operator's SecurityOps search is a SearXNG
// metasearch reachable both as a clearnet host and (when published) as a hidden
// service. We default to the clearnet host fetched OVER TOR: it stays up even when
// the .onion listeners are down, and SearXNG needs no JavaScript, so it renders in
// the JS-disabled "Safest" sandbox. The .onion services are bookmarked below and
// resolve once the operator's hidden-service listeners are running again.
const TOR_HOME = "https://securityops.co/";

// The operator's SearXNG search endpoint, for address-bar queries (over Tor).
const TOR_SEARCH_QUERY = "https://securityops.co/web?s=";

// SecurityOps bookmarks. "Search" is the SearXNG above (reached over Tor); the
// rest are the operator's .onion hidden services — they resolve only while the
// operator's onion listeners are running (otherwise the proxy shows a clear
// "this .onion looks offline" page, not a Tor error).
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
const TorBrowser: FC<ComponentProcessProps> = ({ id }) => {
  const {
    url: changeUrl,
    processes: { [id]: process },
  } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const initialUrl = url || TOR_HOME;
  const { canGoBack, canGoForward, history, moveHistory, position } =
    useHistory(initialUrl, id);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState("");
  const [jsEnabled, setJsEnabled] = useState(false);
  const [extEnabled, setExtEnabled] = useState(false);
  const currentUrl = useRef("");
  const changeHistory = (step: number): void => {
    moveHistory(step);

    if (inputRef.current) inputRef.current.value = history[position + step];
  };
  const setUrl = useCallback(
    async (addressInput: string): Promise<void> => {
      setLoading(true);

      const addressUrl = await getUrlOrSearch(addressInput, TOR_SEARCH_QUERY);

      if (!/^https?:/.test(addressUrl)) {
        setLoading(false);
        return;
      }

      setSrc(
        `${PROXY_PATH}${encodeURIComponent(addressUrl)}${
          jsEnabled ? "" : "&nojs=1"
        }${extEnabled ? "&ext=1" : ""}`
      );
      prependFileToTitle(addressInput);

      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.value = addressInput;
      }
    },
    [extEnabled, jsEnabled, prependFileToTitle]
  );
  const toggleJs = useCallback((): void => {
    currentUrl.current = "";
    setJsEnabled((prev) => !prev);
  }, []);
  const toggleExt = useCallback((): void => {
    currentUrl.current = "";
    setExtEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (process && history[position] !== currentUrl.current) {
      currentUrl.current = history[position];
      setUrl(history[position]);
    }
  }, [history, position, process, setUrl]);

  return (
    <StyledBrowser $hasSrcDoc={false}>
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
              changeUrl(id, inputRef.current.value);
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
              changeUrl(id, bookmarkUrl);
            }}
            {...label(`${name}\n${bookmarkUrl}`)}
          >
            {name}
          </Button>
        ))}
      </nav>
      <iframe
        ref={iframeRef}
        onLoad={() => setLoading(false)}
        src={src || undefined}
        title={id}
        {...(jsEnabled ? SANDBOXED_IFRAME_CONFIG : NOSCRIPT_IFRAME_CONFIG)}
      />
    </StyledBrowser>
  );
};

export default TorBrowser;
