import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { type FC, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { IFRAME_CONFIG, SANDBOXED_IFRAME_CONFIG } from "utils/constants";
import type { ProxyProfile } from "utils/proxyCapability";
import useProxyCapability from "utils/useProxyCapability";

export type RoutedWebAppConfig = {
  accent: string;
  allow?: string;
  directTransport?: "native" | "proxy";
  name: string;
  profile: Extract<ProxyProfile, "godseye" | "irc" | "wiki">;
  subtitle: string;
  torNote: string;
  url: string;
};

type NetworkMode = "clearnet" | "tor";

const SLOW_LOAD_MS = 30_000;

const newIsolationToken = (): string => {
  const bytes = new Uint8Array(16);

  globalThis.crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const StyledRoutedWebApp = styled.div<{ $accent: string }>`
  background: #090d13;
  color: #dce8e2;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;

  .toolbar {
    align-items: center;
    background: #101720;
    border-bottom: 1px solid
      color-mix(in srgb, ${({ $accent }) => $accent} 36%, transparent);
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    gap: 8px;
    min-height: 42px;
    padding: 5px 9px;
  }

  .title {
    color: #eef8f3;
    flex: 1 1 auto;
    min-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-switch {
    border: 1px solid rgba(255, 255, 255, 22%);
    border-radius: 6px;
    display: flex;
    flex: 0 0 auto;
    overflow: hidden;
  }

  button {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 22%);
    color: #dce8e2;
    cursor: pointer;
    font-family: inherit;
  }

  .mode {
    border: 0;
    font-size: 11.5px;
    padding: 4px 9px;
    white-space: nowrap;
  }

  .mode + .mode {
    border-left: 1px solid rgba(255, 255, 255, 22%);
  }

  .action {
    border-radius: 5px;
    font-size: 11.5px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .mode:hover,
  .action:hover {
    background: rgba(255, 255, 255, 9%);
  }

  .mode.active {
    background: color-mix(
      in srgb,
      ${({ $accent }) => $accent} 22%,
      transparent
    );
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
    border-color: rgba(95, 208, 135, 45%);
    color: #78d99a;
  }

  .badge.direct {
    background: rgba(240, 178, 82, 9%);
    border-color: rgba(240, 178, 82, 48%);
    color: #efba6b;
  }

  .action.full-client {
    border-color: rgba(240, 178, 82, 48%);
    color: #efba6b;
  }

  .route-note {
    align-items: center;
    background: #0b1118;
    border-bottom: 1px solid rgba(255, 255, 255, 8%);
    color: #91a4af;
    display: flex;
    flex: 0 0 auto;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 11px;
    gap: 7px;
    line-height: 1.35;
    padding: 5px 10px;
  }

  .route-note strong {
    color: ${({ $accent }) => $accent};
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
    background: #090d13;
    border: 0;
    display: block;
    height: 100%;
    width: 100%;
  }

  .overlay {
    align-items: center;
    background: #090d13;
    color: #afbec6;
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
    animation: routed-app-spin 0.9s linear infinite;
    border: 3px solid rgba(255, 255, 255, 16%);
    border-radius: 50%;
    border-top-color: ${({ $accent }) => $accent};
    height: 20px;
    width: 20px;
  }

  .hint {
    color: #81949f;
    font-size: 11.5px;
    line-height: 1.5;
    max-width: 440px;
  }

  .overlay-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }

  .overlay-action {
    border-color: color-mix(
      in srgb,
      ${({ $accent }) => $accent} 52%,
      transparent
    );
    border-radius: 6px;
    font-size: 12px;
    padding: 7px 14px;
  }

  .overlay-action:hover {
    background: rgba(255, 255, 255, 9%);
  }

  .overlay-action.full-client {
    border-color: rgba(240, 178, 82, 48%);
    color: #efba6b;
  }

  @keyframes routed-app-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .toolbar {
      flex-wrap: wrap;
    }

    .title {
      flex-basis: 100%;
    }

    .route-note {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;

const RoutedWebApp: FC<
  ComponentProcessProps & { config: RoutedWebAppConfig }
> = ({ config, id }) => {
  const {
    accent,
    allow = "fullscreen",
    directTransport = "proxy",
    name,
    profile,
    subtitle,
    torNote,
    url,
  } = config;
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<NetworkMode>("tor");
  const [reloadKey, setReloadKey] = useState(0);
  const [slow, setSlow] = useState(false);
  const sessionTokens = useRef<Record<NetworkMode, string>>();
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();

  if (!sessionTokens.current) {
    sessionTokens.current = {
      clearnet: newIsolationToken(),
      tor: newIsolationToken(),
    };
  }

  const isTor = mode === "tor";
  const nativeDirect = !isTor && directTransport === "native";
  const {
    capability: routeCapability,
    error: capabilityError,
    retry: retryCapability,
  } = useProxyCapability(
    isTor ? "tor" : "direct",
    profile,
    sessionTokens.current[mode]
  );
  const proxySrc = routeCapability
    ? `${PROXY_PATH}${encodeURIComponent(url)}&app=1&iso=${
        sessionTokens.current[mode]
      }${isTor ? "" : "&direct=1"}&profile=${profile}&cap=${encodeURIComponent(
        routeCapability
      )}`
    : "";
  const src = nativeDirect ? url : proxySrc;
  let routeDescription =
    "This view uses ordinary SecurityOS server egress and is not anonymous.";

  if (isTor) {
    routeDescription = `${torNote} There is no automatic direct fallback.`;
  } else if (nativeDirect) {
    routeDescription =
      "This browser connects straight to the service. Your network address is visible to it.";
  }

  useEffect(() => {
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (loading) {
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    }

    return () => {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    };
  }, [loading, mode, reloadKey]);

  const reload = (): void => {
    if (isTor && sessionTokens.current) {
      sessionTokens.current.tor = newIsolationToken();
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
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // The selected in-OS route remains available if pop-ups are blocked.
    }
  };

  return (
    <StyledRoutedWebApp $accent={accent}>
      <div className="toolbar">
        <span className="title">
          {name} — {subtitle}
        </span>
        <span aria-label="Network route" className="mode-switch" role="group">
          <button
            aria-pressed={isTor}
            className={`mode${isTor ? " active" : ""}`}
            onClick={() => selectMode("tor")}
            title={`Route ${name} through Tor`}
            type="button"
          >
            🧅 Tor
          </button>
          <button
            aria-pressed={!isTor}
            className={`mode${isTor ? "" : " active"}`}
            onClick={() => selectMode("clearnet")}
            title="Use the explicit direct route (not anonymous)"
            type="button"
          >
            🌐 Clearnet
          </button>
        </span>
        <span className={`badge ${isTor ? "tor" : "direct"}`}>
          {isTor ? "TOR · FAIL-CLOSED" : "DIRECT · NOT ANONYMOUS"}
        </span>
        <button className="action" onClick={reload} type="button">
          {isTor ? "↻ New circuit" : "↻ Reload"}
        </button>
        <button
          className="action full-client"
          onClick={openFullClient}
          title="Open the native site directly outside the SecurityOS sandbox"
          type="button"
        >
          Full client · DIRECT
        </button>
      </div>
      <div className={`route-note ${isTor ? "tor" : "direct"}`}>
        <strong>{isTor ? "Tor session" : "Clearnet session"}</strong>
        <span>{routeDescription}</span>
      </div>
      <div className="frame-wrap">
        <iframe
          key={`${mode}-${reloadKey}`}
          allow={allow}
          onError={() => setSlow(true)}
          onLoad={() => setLoading(false)}
          src={src || undefined}
          title={`${id} (${isTor ? "Tor" : "clearnet"})`}
          {...(nativeDirect ? IFRAME_CONFIG : SANDBOXED_IFRAME_CONFIG)}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>
              {!nativeDirect && !routeCapability
                ? `Authorizing the ${isTor ? "Tor" : "direct"} route…`
                : `Connecting to ${name} ${isTor ? "over Tor" : "directly"}…`}
            </span>
            {capabilityError ? (
              <div className="overlay-actions">
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
                    ? "Tor or the service is unavailable. This route fails closed and will not switch to clearnet on its own."
                    : "The direct route or service is unavailable. Reload, or open the native full client."}
                </span>
                <div className="overlay-actions">
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
    </StyledRoutedWebApp>
  );
};

export default RoutedWebApp;
