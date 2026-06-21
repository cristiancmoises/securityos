import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

// CryptPad — the first-party SecurityOps office suite (end-to-end-encrypted docs,
// sheets, code, drive) at office.securityops.co.
//
// WHY A DIRECT EMBED (NOT THE TOR PROXY): CryptPad needs persistent STORAGE
// (localStorage / IndexedDB) and Web Workers — it shows a hard "storage disabled"
// alert and refuses to run without them. The privacy proxy renders pages in an
// OPAQUE-ORIGIN sandbox with NO storage (that isolation is exactly what makes
// proxying untrusted content safe), so CryptPad cannot function there. The only way
// to give it real storage SAFELY is its OWN origin — so we embed office.securityops.co
// directly, cross-origin from the OS. The sandbox grants `allow-same-origin` (so its
// storage works) but the cross-origin boundary still prevents it from touching the
// SecurityOS desktop, and we withhold `allow-top-navigation` so it can't redirect us.
//
// TOR: this is a DIRECT connection to office.securityops.co (a real WebSocket for
// realtime collaboration). To use CryptPad anonymously, run SecurityOS itself in the
// Tor Browser / Tails — then this connection is over Tor too. (The same trade-off the
// messenger launchers make.) office.securityops.co must allow framing from the
// SecurityOS origin; if the panel stays blank, use "Open in window".
const CRYPTPAD_URL = "https://office.securityops.co/";
const CRYPTPAD_ALLOW =
  "clipboard-read; clipboard-write; fullscreen; autoplay; camera; microphone";
// allow-same-origin => real storage on CryptPad's own origin; cross-origin to the OS
// keeps it isolated. No allow-top-navigation (can't redirect the desktop).
const CRYPTPAD_SANDBOX =
  "allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-popups-to-escape-sandbox allow-storage-access-by-user-activation";

// If it hasn't loaded by now, surface the fallback (framing blocked / slow).
const SLOW_LOAD_MS = 18_000;

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

  .toolbar .badge {
    background: rgba(255, 176, 32, 14%);
    border: 1px solid rgba(255, 176, 32, 40%);
    border-radius: 999px;
    color: #ffcd6b;
    flex: 0 0 auto;
    font-size: 10.5px;
    padding: 2px 8px;
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
      window.open(CRYPTPAD_URL, "securityos-cryptpad", "popup,width=1280,height=860");
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
        <span className="title">🔐 CryptPad — encrypted office suite</span>
        <span className="badge" title="Direct connection — run SecurityOS in the Tor Browser for Tor">
          direct (not via Tor proxy)
        </span>
        <button onClick={reload} title="Reload" type="button">
          ↻ Reload
        </button>
        <button onClick={openInWindow} title="Open in a separate window" type="button">
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
          sandbox={CRYPTPAD_SANDBOX}
          src={CRYPTPAD_URL}
          title={id}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>Loading CryptPad…</span>
            {slow && (
              <>
                <span className="hint">
                  Still blank? CryptPad needs storage (its own origin) and permission
                  to be framed. Make sure office.securityops.co allows framing from
                  SecurityOS, or use <b>Window</b> / <b>Tor Browser</b> below.
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
