import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

// CryptPad — encrypted office suite, run INSIDE SecurityOS over Tor.
//
// office.securityops.co 301-redirects to the public CryptPad at pad.envs.net, which
// refuses to be framed (frame-ancestors) — so a DIRECT embed failed with "Refused to
// connect". We therefore load it THROUGH the privacy proxy: the proxy follows the
// redirect server-side over Tor, strips the anti-framing headers, rewrites the page,
// and injects a shim that tunnels CryptPad's realtime WebSocket through /api/ws (also
// over Tor) and provides amnesic in-memory localStorage/sessionStorage so its storage
// checks pass in the opaque sandbox. This loads CryptPad in-OS over Tor and bypasses
// networks that block it.
//
// LIMITS (be honest): the privacy sandbox has no IndexedDB and CryptPad is a complex
// multi-origin app, so deep document persistence may be limited in the embed. For
// full, persistent use, the toolbar's **Window** (top-level, own origin) or **Tor
// Browser** buttons open the real client — run SecurityOS in the Tor Browser to keep
// those over Tor too.
const CRYPTPAD_URL = "https://office.securityops.co/";
// &app=1 = "embedded app mode": forces the proxy's Node clientShim path (the Rust
// sidecar injects none), giving CryptPad the in-memory localStorage/sessionStorage +
// IndexedDB shim it needs on the opaque-origin sandbox, plus the /api/ws WebSocket
// tunnel for its realtime engine. Without it (sidecar path) the page loads shim-less
// and CryptPad's storage check fails immediately.
const CRYPTPAD_SRC = `${PROXY_PATH}${encodeURIComponent(CRYPTPAD_URL)}&app=1`;
const CRYPTPAD_ALLOW = "clipboard-read; clipboard-write; fullscreen";
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
    flex: 0 0 auto;
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
    max-width: 400px;
  }

  .overlay .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
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

  const openInWindow = (): void => {
    try {
      window.open(
        CRYPTPAD_URL,
        "securityos-cryptpad",
        "popup,width=1280,height=860"
      );
    } catch {
      // ignore pop-up failures
    }
  };

  const openInTorBrowser = (): void => {
    try {
      open("TorBrowser", { url: CRYPTPAD_URL });
    } catch {
      // The embedded/window view is still available.
    }
  };

  return (
    <StyledCryptPad>
      <div className="toolbar">
        <span className="title">🔐 CryptPad — encrypted office, over Tor</span>
        <button onClick={reload} title="Reload over Tor" type="button">
          ↻ Reload
        </button>
        <button
          onClick={openInWindow}
          title="Open in a separate window (own origin, full storage)"
          type="button"
        >
          ⧉ Window
        </button>
        <button
          onClick={openInTorBrowser}
          title="Open CryptPad in the in-OS Tor Browser"
          type="button"
        >
          Tor Browser
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
                  while. If it doesn&apos;t fully load, the privacy sandbox
                  limits deep document storage — use <b>Window</b> (own origin,
                  full storage) or <b>Tor Browser</b> below for the complete
                  client.
                </span>
                <div className="actions">
                  <button onClick={reload} type="button">
                    ↻ Reload
                  </button>
                  <button onClick={openInWindow} type="button">
                    ⧉ Open in window
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
