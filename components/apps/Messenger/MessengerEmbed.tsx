import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

// Shared embed for WhatsApp / Telegram — runs the official web client INSIDE
// SecurityOS, fetched through the privacy proxy over Tor (so it works even on
// networks that block these services, and the user's IP is never exposed). The
// proxy strips the anti-framing headers, rewrites the page, tunnels the realtime
// WebSocket through /api/ws over Tor, and shims storage in the opaque sandbox.
//
// HONEST LIMITS: these are heavy multi-origin SPAs that also use service workers and
// may refuse Tor exit IPs, so the embed can be partial. The toolbar's **Window**
// button opens the official client in a real top-level window (full functionality);
// run SecurityOS in the Tor Browser to keep that over Tor too. Session is not here —
// it has no web client (it stays a launcher).
export type MessengerEmbedConfig = {
  accent: string;
  name: string;
  url: string;
};

const SLOW_LOAD_MS = 30_000;

// A fresh 128-bit hex Tor stream-isolation token. Carried as &iso= so the proxy
// routes this embed through its OWN Tor circuit (separate exit IP); rotating it on
// Reload gives each retry a NEW exit — the fix for WhatsApp/Telegram's per-exit
// intermittent block, where reloading onto the SAME blocked exit never recovers.
const newIsoToken = (): string => {
  const bytes = new Uint8Array(16);

  (globalThis.crypto || window.crypto).getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const StyledEmbed = styled.div<{ $accent: string }>`
  background: #0b141a;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 100%;

  .toolbar {
    align-items: center;
    background: #11202b;
    border-bottom: 1px solid rgba(255, 255, 255, 10%);
    color: #d6e3ea;
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    gap: 8px;
    padding: 5px 9px;
  }

  .toolbar .title {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar .badge {
    background: rgba(127, 219, 160, 14%);
    border: 1px solid rgba(127, 219, 160, 40%);
    border-radius: 999px;
    color: #7fdba0;
    flex: 0 0 auto;
    font-size: 10.5px;
    padding: 2px 8px;
  }

  .toolbar button {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 22%);
    border-radius: 5px;
    color: #e7eef2;
    cursor: pointer;
    flex: 0 0 auto;
    font-family: inherit;
    font-size: 11.5px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .toolbar button:hover {
    background: rgba(255, 255, 255, 9%);
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
    background: #0b141a;
    color: #aebfc8;
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
    animation: msgr-spin 0.9s linear infinite;
    border: 3px solid rgba(255, 255, 255, 18%);
    border-radius: 50%;
    border-top-color: ${({ $accent }) => $accent};
    height: 20px;
    width: 20px;
  }

  .overlay .hint {
    color: #8197a3;
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
    background: ${({ $accent }) => $accent};
    border: 0;
    border-radius: 6px;
    color: #06231a;
    cursor: pointer;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    font-weight: 600;
    padding: 7px 14px;
  }

  @keyframes msgr-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const MessengerEmbed: FC<
  ComponentProcessProps & { config: MessengerEmbedConfig }
> = ({ config, id }) => {
  const { accent, name, url } = config;
  const { open } = useProcesses();
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [iso, setIso] = useState(newIsoToken);
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();
  // &app=1 = "embedded app mode": forces the proxy's Node clientShim path (the Rust
  // sidecar injects none), so the messenger gets the in-memory storage + IndexedDB
  // shim on the opaque-origin sandbox and the /api/ws WebSocket tunnel. Without it
  // the page loads shim-less and crashes on first storage access. &iso pins a per-tab
  // Tor circuit so Reload can rotate to a fresh exit IP (see newIsoToken).
  const src = `${PROXY_PATH}${encodeURIComponent(url)}&app=1&iso=${iso}`;

  useEffect(() => {
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (loading)
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_LOAD_MS);

    return () => {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    };
  }, [loading, reloadKey]);

  const reload = (): void => {
    setLoading(true);
    // Rotate the Tor circuit so a blocked/slow exit is swapped for a fresh one.
    setIso(newIsoToken());
    setReloadKey((key) => key + 1);
  };

  const openInWindow = (): void => {
    try {
      window.open(url, `securityos-${name}`, "popup,width=1200,height=860");
    } catch {
      // ignore
    }
  };

  return (
    <StyledEmbed $accent={accent}>
      <div className="toolbar">
        <span className="title">{name} — inside SecurityOS, over Tor</span>
        <span
          className="badge"
          title="Fetched server-side over Tor — bypasses network blocks"
        >
          over Tor
        </span>
        <button onClick={reload} title="Reload over Tor" type="button">
          ↻ Reload
        </button>
        <button
          onClick={openInWindow}
          title="Open the official client in a window"
          type="button"
        >
          ⧉ Window
        </button>
      </div>
      <div className="frame-wrap">
        <iframe
          key={reloadKey}
          allow="clipboard-read; clipboard-write; fullscreen"
          onLoad={() => setLoading(false)}
          src={src}
          title={id}
          {...SANDBOXED_IFRAME_CONFIG}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>Connecting to {name} over Tor…</span>
            {slow && (
              <>
                <span className="hint">
                  {name} is a heavy app and may block Tor exit IPs or need
                  features the privacy sandbox can&apos;t provide. If it
                  doesn&apos;t finish, open it in a <b>Window</b> (full client)
                  — run SecurityOS in the Tor Browser to keep that over Tor.
                </span>
                <div className="actions">
                  <button onClick={reload} type="button">
                    ↻ Reload
                  </button>
                  <button onClick={openInWindow} type="button">
                    ⧉ Open in window
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </StyledEmbed>
  );
};

export default MessengerEmbed;
