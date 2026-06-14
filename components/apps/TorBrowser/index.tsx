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

// The user's SecurityOps search hidden service: the Tor Browser start page.
const TOR_HOME =
  "http://2fd6cemkrkm5dfsjnuxzbpf6jcscm37fplcfih4htiteoaesoj4cauid.onion/";

// The SecurityOps ecosystem, surfaced as Tor Browser bookmarks (each opens
// through the Tor proxy). Replaces the standalone hosted-apps.
const BOOKMARKS: { name: string; url: string }[] = [
  { name: "Search", url: TOR_HOME },
  { name: "SecurityOps", url: "https://securityops.co/" },
  { name: "SecTube", url: "https://yt.securityops.co/" },
  { name: "BTP", url: "https://btp.securityops.co/" },
  { name: "Chat", url: "https://chat.securityops.co/" },
  { name: "Scan", url: "https://scan.securityops.co/" },
  { name: "Git", url: "https://git.securityops.co/" },
  { name: "Guix", url: "https://guix.securityops.co/" },
  { name: "Paste", url: "https://paste.securityops.co/" },
  { name: "News", url: "https://news.securityops.co/" },
  { name: "Quantico", url: "https://quantico.securityops.co/" },
  { name: "Wiki", url: "https://wiki.securityops.co/" },
  { name: "Vaptvupt", url: "https://vaptvupt.securityops.co/" },
  { name: "Evelin", url: "https://evelin.securityops.co/" },
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

      const addressUrl = await getUrlOrSearch(addressInput);

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
