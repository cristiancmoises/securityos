import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// Cloudmacs — FULL Emacs in the browser (github.com/karlicoss/cloudmacs): Gotty
// serves `emacsclient --tty` as a web TTY, so the session persists across reloads.
// Embedded in-OS like the other first-party services. It's the local Emacs
// backend (the `cloudmacs` docker-compose service), so it's loaded directly, not
// through the Tor proxy. Local testing uses the loopback Gotty on :8090 (http on
// loopback is a trustworthy origin); a server deployment uses an https origin.

const LOCAL_URL = "http://localhost:8090/";
const REMOTE_URL = "https://emacs.securityops.co/";
const CLOUDMACS_ALLOW = "clipboard-read; clipboard-write; fullscreen";

const isLoopback = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]";

const cloudmacsUrl = (): string =>
  typeof window !== "undefined" && !isLoopback(window.location.hostname)
    ? REMOTE_URL
    : LOCAL_URL;

const StyledCloudmacs = styled.div`
  background: #1d1f21;
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
    max-width: 440px;
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

const Cloudmacs: FC<ComponentProcessProps> = ({ id }) => {
  const url = cloudmacsUrl();
  const [status, setStatus] = useState<"checking" | "offline" | "online">(
    "checking"
  );

  const check = useCallback(() => {
    setStatus("checking");
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
      <StyledCloudmacs>
        <iframe
          allow={CLOUDMACS_ALLOW}
          src={url}
          title={id}
          {...IFRAME_CONFIG}
        />
      </StyledCloudmacs>
    );
  }

  return (
    <StyledCloudmacs>
      <div className="panel">
        <h1>Cloudmacs</h1>
        {status === "checking" ? (
          <p>Connecting to Cloudmacs…</p>
        ) : (
          <>
            <p>
              The Cloudmacs server isn&apos;t reachable at <b>{url}</b>. It runs
              as a local container (Emacs + Gotty). Start it with:
            </p>
            <pre>docker compose up -d cloudmacs</pre>
            <button onClick={check} type="button">
              Retry
            </button>
          </>
        )}
      </div>
    </StyledCloudmacs>
  );
};

export default Cloudmacs;
