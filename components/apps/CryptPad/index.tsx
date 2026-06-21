import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

// CryptPad — the first-party SecurityOps office suite (end-to-end-encrypted docs,
// sheets, code, drive) at office.securityops.co, embedded INSIDE the OS over Tor.
//
// HOW IT RUNS IN-OS: the page is fetched + rewritten by the privacy proxy
// (/api/proxy, SOCKS5h over Tor) and rendered in an opaque-origin sandbox. CryptPad
// is a REAL-TIME app — its collaborative engine needs a WebSocket
// (wss://office.securityops.co/cryptpad_websocket), which a plain HTTP proxy can't
// carry. SecurityOS's custom server exposes a same-origin WebSocket TUNNEL at
// /api/ws; the proxy's client shim rewrites the page's WebSocket to that tunnel, so
// the realtime connection rides through SecurityOS over Tor. Uploads/downloads work
// through the proxy (allow-downloads + forwarded POST bodies). office.securityops.co
// is first-party and does not block Tor, so this is the in-OS, over-Tor path the
// messenger clients can't take.
const CRYPTPAD_URL = "https://office.securityops.co/";
const CRYPTPAD_SRC = `${PROXY_PATH}${encodeURIComponent(CRYPTPAD_URL)}`;
const CRYPTPAD_ALLOW = "clipboard-read; clipboard-write; fullscreen";

// CryptPad over a cold Tor circuit + its WASM/crypto can take a while; after this,
// offer Reload / open-in-Tor-Browser instead of a silent spinner.
const SLOW_LOAD_MS = 35_000;

const StyledCryptPad = styled.div`
  background: #1c1340;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 100%;

  .toolbar {
    align-items: center;
    background: #241a4d;
    border-bottom: 1px solid rgba(150, 130, 220, 24%);
    color: #d7ccf2;
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    gap: 8px;
    letter-spacing: 0.2px;
    padding: 5px 9px;
  }

  .toolbar .title {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar button {
    background: transparent;
    border: 1px solid rgba(150, 130, 220, 38%);
    border-radius: 5px;
    color: #e2d8fb;
    cursor: pointer;
    font-family: inherit;
    font-size: 11.5px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .toolbar button:hover {
    background: rgba(150, 130, 220, 16%);
  }

  .frame-wrap {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  }

  iframe {
    background: #fff;
    border: 0;
    display: block;
    height: 100%;
    width: 100%;
  }

  .overlay {
    align-items: center;
    background: #1c1340;
    color: #c3b6e8;
    display: flex;
    flex-direction: column;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 13px;
    gap: 12px;
    inset: 0;
    justify-content: center;
    padding: 24px;
    position: absolute;
    text-align: center;
  }

  .overlay.pass {
    pointer-events: none;
  }

  .spinner {
    animation: cryptpad-spin 0.9s linear infinite;
    border: 3px solid rgba(170, 150, 230, 35%);
    border-radius: 50%;
    border-top-color: #b9a4ef;
    height: 20px;
    width: 20px;
  }

  .overlay .hint {
    color: #9a8cc4;
    font-size: 11.5px;
    max-width: 380px;
  }

  .overlay .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .overlay button {
    background: rgba(150, 130, 220, 18%);
    border: 1px solid rgba(150, 130, 220, 48%);
    border-radius: 6px;
    color: #efe8ff;
    cursor: pointer;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    padding: 7px 14px;
  }

  .overlay button:hover {
    background: rgba(150, 130, 220, 30%);
  }

  @keyframes cryptpad-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const CryptPad: FC<ComponentProcessProps> = ({ id }) => {
  const { open } = useProcesses();
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (loading) {
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    }

    return () => {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    };
  }, [loading, reloadKey]);

  const reload = (): void => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const openInTorBrowser = (): void => {
    try {
      open("TorBrowser", { url: CRYPTPAD_URL });
    } catch {
      // The embedded view is still available.
    }
  };

  return (
    <StyledCryptPad>
      <div className="toolbar">
        <span className="title">
          🔐 CryptPad — encrypted office suite, over Tor
        </span>
        <button onClick={reload} title="Reload over Tor" type="button">
          ↻ Reload
        </button>
        <button
          onClick={openInTorBrowser}
          title="Open CryptPad in the Tor Browser (toggle scripts if a page needs them)"
          type="button"
        >
          Open in Tor Browser
        </button>
      </div>
      <div className="frame-wrap">
        <iframe
          key={reloadKey}
          allow={CRYPTPAD_ALLOW}
          onLoad={() => setLoading(false)}
          src={CRYPTPAD_SRC}
          title={id}
          {...SANDBOXED_IFRAME_CONFIG}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>Connecting to CryptPad over Tor…</span>
            {slow && (
              <>
                <span className="hint">
                  A cold Tor circuit plus CryptPad&apos;s encryption can take a
                  while. If it doesn&apos;t appear, reload, or open it in the Tor
                  Browser where you can retry and toggle scripts.
                </span>
                <div className="actions">
                  <button onClick={reload} type="button">
                    ↻ Reload
                  </button>
                  <button onClick={openInTorBrowser} type="button">
                    Open in Tor Browser
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </StyledCryptPad>
  );
};

export default CryptPad;
