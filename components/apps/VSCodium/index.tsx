import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// VSCodium — the FULL VS Code (Code-OSS) IDE, served by a self-hosted
// code-server and embedded here, like the other first-party SecurityOps apps
// (SecChat/Vaptvupt): loaded DIRECTLY, not through the Tor HTML-rewriting proxy
// (a live editor needs real workers/websockets the proxy can't provide).
//
// Local testing uses the loopback code-server on :8443 — http is fine because
// loopback is a "potentially trustworthy" origin (not mixed-content/upgraded). A
// server deployment uses https://code.securityops.co (covered by the `https:`
// CSP). Both origins are allowlisted in frame-src/connect-src (securityHeaders).

const LOCAL_VSCODE_URL = "http://localhost:8443/";
const REMOTE_VSCODE_URL = "https://code.securityops.co/";

const VSCODE_ALLOW = "clipboard-read; clipboard-write; fullscreen";

const isLoopback = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]";

const vscodeUrl = (): string =>
  typeof window !== "undefined" && !isLoopback(window.location.hostname)
    ? REMOTE_VSCODE_URL
    : LOCAL_VSCODE_URL;

const StyledVSCodium = styled.div`
  background: #1e1e1e;
  color: ${({ theme }) => theme.colors.text};
  height: 100%;
  width: 100%;

  iframe {
    border: 0;
    color-scheme: dark;
    display: block;
    height: 100%;
    width: 100%;
  }

  .panel {
    align-items: center;
    display: flex;
    flex-direction: column;
    font-family: ${({ theme }) => theme.formats.systemFont};
    gap: 12px;
    height: 100%;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }

  .panel h1 {
    font-size: 18px;
    margin: 0;
  }

  .panel p {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 12px;
    margin: 0;
    max-width: 420px;
  }

  .panel pre {
    background: #11151c;
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 6px;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.formats.monoFont};
    font-size: 12px;
    margin: 0;
    padding: 8px 12px;
    user-select: all;
  }

  .panel button {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 6px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 18px;
  }
`;

const VSCodium: FC<ComponentProcessProps> = ({ id }) => {
  const url = vscodeUrl();
  const [status, setStatus] = useState<"checking" | "offline" | "online">(
    "checking"
  );

  const check = useCallback(() => {
    setStatus("checking");
    // A no-cors probe can't read the response, but it resolves when the server
    // is reachable and rejects (network error) when it isn't.
    fetch(url, { cache: "no-store", mode: "no-cors" })
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, [url]);

  useEffect(() => {
    let active = true;

    fetch(url, { cache: "no-store", mode: "no-cors" })
      .then(() => active && setStatus("online"))
      .catch(() => active && setStatus("offline"));

    return () => {
      active = false;
    };
  }, [url]);

  if (status === "online") {
    return (
      <StyledVSCodium>
        <iframe allow={VSCODE_ALLOW} src={url} title={id} {...IFRAME_CONFIG} />
      </StyledVSCodium>
    );
  }

  return (
    <StyledVSCodium>
      <div className="panel">
        <h1>VSCodium</h1>
        {status === "checking" ? (
          <p>Connecting to the VSCodium server…</p>
        ) : (
          <>
            <p>
              The VSCodium server isn&apos;t reachable at <b>{url}</b>. It runs as
              a local container (Code-OSS / code-server). Start it with:
            </p>
            <pre>docker compose up -d vscode</pre>
            <button onClick={check} type="button">
              Retry
            </button>
          </>
        )}
      </div>
    </StyledVSCodium>
  );
};

export default VSCodium;
