import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";
import useProxyCapability from "utils/useProxyCapability";

// Keywave requires an own-origin, top-level browsing context for its complete
// camera/microphone + WebRTC client. The live service deliberately sends
// X-Frame-Options: DENY and CSP frame-ancestors 'none', so a direct iframe is both
// non-functional and misleading. The Tor view therefore uses SecurityOS's opaque
// privacy sandbox for HTTPS + Socket.IO landing/control traffic and keeps WebRTC
// blocked;
// the explicit clearnet launcher opens the complete client on its own origin.
const KEYWAVE_URL = "https://chat.securityops.co/";
const SLOW_LOAD_MS = 30_000;

type KeywaveMode = "clearnet" | "tor";

const getRoomFragment = (candidate = ""): string => {
  try {
    const target = new URL(candidate, KEYWAVE_URL);
    const allowedHost = target.hostname === new URL(KEYWAVE_URL).hostname;
    const room = target.hash.match(/^#room=([\da-f]{10})$/i)?.[1];

    return allowedHost && room ? `#room=${room.toUpperCase()}` : "";
  } catch {
    return "";
  }
};

// A per-reload Tor stream-isolation token. It is only a circuit selector, not a
// credential, and never leaves the SecurityOS proxy boundary.
const newIsoToken = (): string => {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const StyledKeywave = styled.div`
  background: radial-gradient(
      circle at 50% -20%,
      rgba(0, 207, 255, 14%),
      transparent 42%
    ),
    #03040a;
  color: #ccdaee;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;

  .toolbar {
    align-items: center;
    background: rgba(8, 11, 20, 96%);
    border-bottom: 1px solid #1a2540;
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    gap: 8px;
    min-height: 42px;
    padding: 6px 9px;
  }

  .brand {
    color: #00ff9f;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-right: auto;
  }

  .mode-button,
  .action {
    background: transparent;
    border: 1px solid #2a3f6a;
    border-radius: 4px;
    color: #aebfd4;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    padding: 5px 10px;
    text-decoration: none;
  }

  .mode-button[aria-pressed="true"] {
    background: rgba(0, 207, 255, 12%);
    border-color: #00cfff;
    color: #dff9ff;
  }

  .badge {
    border: 1px solid;
    border-radius: 999px;
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    padding: 3px 8px;
  }

  .badge.tor {
    background: rgba(0, 255, 159, 10%);
    border-color: rgba(0, 255, 159, 55%);
    color: #55f3b7;
  }

  .badge.clearnet {
    background: rgba(255, 187, 0, 10%);
    border-color: rgba(255, 187, 0, 60%);
    color: #ffd15c;
  }

  .content,
  .frame-wrap {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  }

  .content {
    align-items: center;
    display: flex;
    justify-content: center;
    overflow: auto;
    padding: 28px;
  }

  .card {
    background: rgba(8, 11, 20, 94%);
    border: 1px solid #1a2540;
    border-radius: 7px;
    box-shadow: 0 18px 70px rgba(0, 0, 0, 42%);
    font-family: ${({ theme }) => theme.formats.systemFont};
    max-width: 620px;
    padding: 28px;
    width: 100%;
  }

  .card h1 {
    color: #00ff9f;
    font-size: 22px;
    letter-spacing: 3px;
    margin: 0 0 8px;
  }

  .card .lead {
    color: #d7e3f2;
    font-size: 14px;
    line-height: 1.55;
    margin: 0 0 18px;
  }

  .warning {
    background: rgba(255, 187, 0, 7%);
    border-left: 3px solid #fb0;
    color: #f1d995;
    font-size: 12px;
    line-height: 1.55;
    margin: 18px 0;
    padding: 12px 14px;
  }

  .facts {
    color: #91a5bd;
    font-size: 12px;
    line-height: 1.6;
    margin: 18px 0;
    padding-left: 20px;
  }

  .actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .action {
    display: inline-flex;
    font-size: 12px;
    font-weight: 600;
    justify-content: center;
    padding: 9px 15px;
  }

  .action.primary {
    background: #00ff9f;
    border-color: #00ff9f;
    color: #03110c;
  }

  .action:hover,
  .mode-button:hover {
    filter: brightness(1.14);
  }

  iframe {
    background: #03040a;
    border: 0;
    display: block;
    height: 100%;
    width: 100%;
  }

  .notice {
    align-items: center;
    background: rgba(3, 4, 10, 94%);
    color: #aebfd4;
    display: flex;
    flex-direction: column;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    gap: 12px;
    inset: 0;
    justify-content: center;
    padding: 24px;
    position: absolute;
    text-align: center;
  }

  .notice.pass {
    pointer-events: none;
  }

  .notice .spinner {
    animation: keywave-spin 0.9s linear infinite;
    border: 3px solid rgba(0, 207, 255, 22%);
    border-radius: 50%;
    border-top-color: #00ff9f;
    height: 22px;
    width: 22px;
  }

  .privacy-strip {
    background: #080b14;
    border-top: 1px solid #1a2540;
    color: #8799b0;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 10.5px;
    line-height: 1.45;
    padding: 6px 10px;
    text-align: center;
  }

  @keyframes keywave-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 640px) {
    .toolbar {
      flex-wrap: wrap;
    }

    .brand {
      flex-basis: 100%;
    }

    .badge {
      order: 4;
    }

    .content {
      padding: 14px;
    }

    .card {
      padding: 20px;
    }
  }
`;

const Keywave: FC<ComponentProcessProps> = ({ id }) => {
  const {
    processes: { [id]: process },
  } = useProcesses();
  const [iso, setIso] = useState(newIsoToken);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<KeywaveMode>("tor");
  const [reloadKey, setReloadKey] = useState(0);
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();
  const roomFragment = getRoomFragment(process?.url);
  const clearnetTarget = `${KEYWAVE_URL}${roomFragment}`;
  const {
    capability: routeCapability,
    error: capabilityError,
    retry: retryCapability,
  } = useProxyCapability("tor", "keywave", iso);
  const torSrc = routeCapability
    ? `${PROXY_PATH}${encodeURIComponent(
        KEYWAVE_URL
      )}&keywave=1&profile=keywave&iso=${iso}&cap=${encodeURIComponent(
        routeCapability
      )}${roomFragment}`
    : "";

  useEffect(() => {
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (mode === "tor" && loading) {
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    }

    return () => {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    };
  }, [loading, mode, reloadKey]);

  const reloadTor = (): void => {
    setIso(newIsoToken());
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  return (
    <StyledKeywave>
      <div className="toolbar">
        <span className="brand">KEYWAVE 2.1</span>
        <button
          aria-pressed={mode === "tor"}
          className="mode-button"
          onClick={() => setMode("tor")}
          type="button"
        >
          Tor
        </button>
        <button
          aria-pressed={mode === "clearnet"}
          className="mode-button"
          onClick={() => setMode("clearnet")}
          type="button"
        >
          Clearnet
        </button>
        <span className={`badge ${mode}`}>
          {mode === "tor"
            ? "TOR · LANDING/CONTROL ONLY"
            : "DIRECT · IP VISIBLE"}
        </span>
      </div>

      {mode === "tor" ? (
        <div className="frame-wrap">
          <iframe
            key={reloadKey}
            allow="clipboard-read; clipboard-write; fullscreen"
            onLoad={() => setLoading(false)}
            src={torSrc || undefined}
            title={`${id} Tor landing/control view`}
            {...SANDBOXED_IFRAME_CONFIG}
          />
          {loading && (
            <div className={`notice${slow ? "" : " pass"}`}>
              <span className="spinner" />
              <span>
                {routeCapability
                  ? "Connecting to Keywave signaling over Tor…"
                  : "Authorizing the Tor route…"}
              </span>
              {capabilityError ? (
                <div className="actions">
                  <button
                    className="action"
                    onClick={retryCapability}
                    type="button"
                  >
                    Retry route authorization
                  </button>
                </div>
              ) : slow ? (
                <div className="actions">
                  <button className="action" onClick={reloadTor} type="button">
                    New Tor circuit
                  </button>
                </div>
              ) : undefined}
            </div>
          )}
        </div>
      ) : (
        <div className="content">
          <section aria-labelledby={`${id}-clearnet-title`} className="card">
            <h1 id={`${id}-clearnet-title`}>FULL KEYWAVE CLIENT</h1>
            <p className="lead">
              Open Keywave in its own top-level window for encrypted text,
              camera, microphone, and WebRTC audio/video.
            </p>
            <div className="warning">
              <b>This route is clearnet and is not anonymous.</b> Your network
              address is visible to the Keywave service and its STUN/TURN
              infrastructure. SecurityOS never switches to this route without
              your click.
            </div>
            <ul className="facts">
              <li>
                The service blocks framing, so an own-origin window is the safe,
                compatible full-client path.
              </li>
              <li>
                Room tokens and encryption keys are ephemeral page memory; no
                account or persistent browser-storage dependency was observed.
              </li>
              <li>
                Keep the safety-number verification step inside Keywave before
                trusting a call.
              </li>
            </ul>
            <div className="actions">
              <a
                className="action primary"
                href={clearnetTarget}
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
                target="_blank"
              >
                Open full client
              </a>
              <button
                className="action"
                onClick={() => setMode("tor")}
                type="button"
              >
                Back to Tor mode
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="privacy-strip">
        {mode === "tor" ? (
          <>
            HTTP and Socket.IO stay inside the Tor proxy and fail closed. WebRTC
            is blocked because ICE can bypass Tor; calls require the explicit
            clearnet mode.
          </>
        ) : (
          "Top-level direct client · camera/microphone media · not anonymous"
        )}
      </div>
    </StyledKeywave>
  );
};

export default Keywave;
