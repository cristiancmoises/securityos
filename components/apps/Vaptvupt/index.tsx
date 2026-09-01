import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";
import useProxyCapability from "utils/useProxyCapability";

// ZUPT's native site refuses framing. Both modes therefore use SecurityOS's
// same-origin, SSRF-guarded proxy and render in an opaque-origin sandbox; only the
// proxy's upstream route changes. Tor is fail-closed, while clearnet explicitly
// opts into ordinary egress with direct=1.
//
// The live service binds its CSRF form token to a Secure HttpOnly cookie. zupt=1
// and a per-mode iso token let the proxy keep that single upstream cookie
// server-side for this app session; it is never exposed to, or persisted by, the
// browser.
//
// The historical hidden service currently has no reachable descriptor. Tor mode
// therefore reaches the healthy HTTPS service THROUGH Tor; it never silently
// changes to direct egress.
const VAPTVUPT_URL = "https://share.securityops.co/";
const VAPTVUPT_ALLOW = "clipboard-read; clipboard-write; fullscreen";

type NetworkMode = "clearnet" | "tor";

const newSessionToken = (): string => {
  const bytes = new Uint8Array(16);

  globalThis.crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

// How long to wait before replacing the passive loading veil with actionable help.
const SLOW_LOAD_MS = 30_000;

const StyledVaptvupt = styled.div`
  background: #150f1b;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 100%;

  .toolbar {
    align-items: center;
    background: #1b1322;
    border-bottom: 1px solid rgba(157, 123, 216, 22%);
    color: #cbb8e4;
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
    min-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-switch {
    border: 1px solid rgba(157, 123, 216, 35%);
    border-radius: 6px;
    display: flex;
    overflow: hidden;
  }

  .mode-switch .mode {
    background: transparent;
    border: 0;
    color: #d7c2ec;
    cursor: pointer;
    font-family: inherit;
    font-size: 11.5px;
    padding: 4px 9px;
    white-space: nowrap;
  }

  .mode-switch .mode + .mode {
    border-left: 1px solid rgba(157, 123, 216, 35%);
  }

  .mode-switch .mode:hover {
    background: rgba(157, 123, 216, 14%);
  }

  .mode-switch .mode.active {
    background: rgba(157, 123, 216, 28%);
    color: #fff;
  }

  .badge {
    border: 1px solid;
    border-radius: 999px;
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    white-space: nowrap;
  }

  .badge.tor {
    background: rgba(95, 208, 135, 10%);
    border-color: rgba(95, 208, 135, 42%);
    color: #78d99a;
  }

  .badge.direct {
    background: rgba(240, 178, 82, 9%);
    border-color: rgba(240, 178, 82, 45%);
    color: #efba6b;
  }

  .toolbar .action {
    background: transparent;
    border: 1px solid rgba(157, 123, 216, 35%);
    border-radius: 5px;
    color: #d7c2ec;
    cursor: pointer;
    font-family: inherit;
    font-size: 11.5px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .toolbar .action:hover {
    background: rgba(157, 123, 216, 14%);
  }

  .toolbar .action.full-client {
    border-color: rgba(240, 178, 82, 45%);
    color: #efba6b;
  }

  .route-note {
    align-items: center;
    background: #120e18;
    border-bottom: 1px solid rgba(157, 123, 216, 18%);
    color: #9685a9;
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 11px;
    gap: 7px;
    line-height: 1.35;
    padding: 5px 10px;
  }

  .route-note strong {
    color: #cbb8e4;
    flex: 0 0 auto;
  }

  .route-note.direct strong {
    color: #efba6b;
  }

  .frame-wrap {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  }

  iframe {
    border: 0;
    display: block;
    height: 100%;
    width: 100%;
  }

  .overlay {
    align-items: center;
    background: #150f1b;
    color: #b9a7cf;
    display: flex;
    flex-direction: column;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 13px;
    gap: 12px;
    inset: 0;
    justify-content: center;
    letter-spacing: 0.3px;
    padding: 24px;
    position: absolute;
    text-align: center;
  }

  .overlay.pass {
    pointer-events: none;
  }

  .spinner {
    animation: vaptvupt-spin 0.9s linear infinite;
    border: 2px solid rgba(185, 167, 207, 25%);
    border-radius: 50%;
    border-top-color: #9d7bd8;
    height: 18px;
    width: 18px;
  }

  .overlay .hint {
    color: #8d7ba8;
    font-size: 11.5px;
    max-width: 360px;
  }

  .overlay .actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .frame-wrap .overlay-action {
    background: rgba(157, 123, 216, 16%);
    border: 1px solid rgba(157, 123, 216, 45%);
    border-radius: 6px;
    color: #e7ddf3;
    cursor: pointer;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    padding: 7px 14px;
  }

  .frame-wrap .overlay-action:hover {
    background: rgba(157, 123, 216, 28%);
  }

  .frame-wrap .overlay-action.full-client {
    border-color: rgba(240, 178, 82, 45%);
    color: #efba6b;
  }

  @media (max-width: 760px) {
    .toolbar {
      flex-wrap: wrap;
    }

    .toolbar .title {
      flex-basis: 100%;
    }

    .route-note {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  @keyframes vaptvupt-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Vaptvupt: FC<ComponentProcessProps> = ({ id }) => {
  const [mode, setMode] = useState<NetworkMode>("tor");
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const sessionTokens = useRef<Record<NetworkMode, string>>();
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();

  if (!sessionTokens.current) {
    sessionTokens.current = {
      clearnet: newSessionToken(),
      tor: newSessionToken(),
    };
  }

  const isTor = mode === "tor";
  const {
    capability: routeCapability,
    error: capabilityError,
    retry: retryCapability,
  } = useProxyCapability(
    isTor ? "tor" : "direct",
    "zupt",
    sessionTokens.current[mode]
  );
  const src = routeCapability
    ? `${PROXY_PATH}${encodeURIComponent(VAPTVUPT_URL)}&zupt=1&iso=${
        sessionTokens.current[mode]
      }${isTor ? "" : "&direct=1"}&profile=zupt&cap=${encodeURIComponent(
        routeCapability
      )}`
    : "";

  // Arm the "this is slow" hint whenever a (re)load starts; clear it on success.
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
    // A failed/blocked Tor exit must not trap the app on the same circuit. Rotating
    // also starts a fresh ephemeral CSRF jar; the root GET immediately seeds it.
    if (isTor && sessionTokens.current) {
      sessionTokens.current.tor = newSessionToken();
    }
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const selectMode = (nextMode: NetworkMode): void => {
    if (nextMode === mode) return;

    setMode(nextMode);
    setLoading(true);
    setSlow(false);
    setReloadKey((key) => key + 1);
  };

  const openFullClient = (): void => {
    try {
      window.open(VAPTVUPT_URL, "_blank", "noopener,noreferrer");
    } catch {
      // The embedded client remains available if the browser blocks pop-ups.
    }
  };

  return (
    <StyledVaptvupt>
      <div className="toolbar">
        <span className="title">
          ZUPT — compression, encryption &amp; recovery
        </span>
        <span aria-label="Network route" className="mode-switch" role="group">
          <button
            aria-pressed={isTor}
            className={`mode${isTor ? " active" : ""}`}
            onClick={() => selectMode("tor")}
            title="Route the embedded ZUPT session through Tor"
            type="button"
          >
            🧅 Tor
          </button>
          <button
            aria-pressed={!isTor}
            className={`mode${isTor ? "" : " active"}`}
            onClick={() => selectMode("clearnet")}
            title="Use ordinary server egress (not anonymous)"
            type="button"
          >
            🌐 Clearnet
          </button>
        </span>
        <span className={`badge ${isTor ? "tor" : "direct"}`}>
          {isTor ? "TOR · FAIL-CLOSED" : "DIRECT · NOT ANONYMOUS"}
        </span>
        <button
          className="action"
          onClick={reload}
          title={
            isTor
              ? "Reload with a fresh Tor circuit and ephemeral CSRF session"
              : "Reload using direct egress"
          }
          type="button"
        >
          {isTor ? "↻ New circuit" : "↻ Reload"}
        </button>
        <button
          className="action full-client"
          onClick={openFullClient}
          title="Open the native site outside SecurityOS; this direct fallback is not anonymized by the app"
          type="button"
        >
          Full client · DIRECT
        </button>
      </div>
      <div className={`route-note ${isTor ? "tor" : "direct"}`}>
        <strong>{isTor ? "Tor session" : "Clearnet session"}</strong>
        <span>
          {isTor
            ? "Pages, uploads and downloads stay on Tor; there is no automatic direct fallback."
            : "Pages, uploads and downloads use ordinary SecurityOS server egress and are not anonymous."}
          {
            " The CSRF session is ephemeral and held only by the server-side proxy."
          }
        </span>
      </div>
      <div className="frame-wrap">
        <iframe
          key={reloadKey}
          allow={VAPTVUPT_ALLOW}
          onError={() => setSlow(true)}
          onLoad={() => setLoading(false)}
          src={src || undefined}
          title={`${id} (${isTor ? "Tor" : "clearnet"})`}
          {...SANDBOXED_IFRAME_CONFIG}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>
              {routeCapability
                ? `Connecting to ZUPT ${isTor ? "over Tor" : "directly"}…`
                : `Authorizing the ${isTor ? "Tor" : "direct"} route…`}
            </span>
            {capabilityError ? (
              <div className="actions">
                <button
                  className="overlay-action"
                  onClick={retryCapability}
                  type="button"
                >
                  Retry route authorization
                </button>
              </div>
            ) : slow ? (
              <>
                <span className="hint">
                  {isTor
                    ? "Tor or the service is unavailable. This mode fails closed and will not switch to clearnet on its own."
                    : "The direct route or service is unavailable. Reload, or use the native full client outside the sandbox."}
                </span>
                <div className="actions">
                  <button
                    className="overlay-action"
                    onClick={reload}
                    type="button"
                  >
                    {isTor ? "↻ New Tor circuit" : "↻ Reload"}
                  </button>
                  <button
                    className="overlay-action full-client"
                    onClick={openFullClient}
                    title="Direct, native-browser fallback; not anonymized by SecurityOS"
                    type="button"
                  >
                    Full client · DIRECT
                  </button>
                </div>
              </>
            ) : undefined}
          </div>
        )}
      </div>
    </StyledVaptvupt>
  );
};

export default Vaptvupt;
