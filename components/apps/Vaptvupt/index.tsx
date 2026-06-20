import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

// Vaptvupt — the SecurityOps "zupt" file/folder share, served from its Tor hidden
// service and loaded through the same-origin Tor proxy (like the Tor Browser):
// every byte is fetched server-side over Tor and rendered in an opaque-origin
// sandbox.
//
// WHY THE PROXY (not a direct embed): share.securityops.co sends
// `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`, so a DIRECT iframe is
// refused by the browser and the app shows blank. The proxy strips those framing
// headers and serves the page in the sandbox, so it loads reliably.
//
// DOWNLOADS + UPLOADS both work over the proxy: SANDBOXED_IFRAME_CONFIG grants
// `allow-downloads`, and pages/api/proxy.ts forwards POST/multipart request bodies
// over Tor (up to 256 MiB) and streams large file downloads back in full (downloads
// get a dedicated 256 MiB budget for attachments/binary types, so files over 25 MiB
// no longer truncate) — all routed through Tor in the opaque-origin sandbox.
const VAPTVUPT_URL =
  "http://secopsuwwht2unomwt3jofl33kfqsfd2z6cwip6rbqlapi7s4pys5vyd.onion/";
const VAPTVUPT_SRC = `${PROXY_PATH}${encodeURIComponent(VAPTVUPT_URL)}`;
const VAPTVUPT_ALLOW = "clipboard-read; clipboard-write; fullscreen";

// How long to wait on a cold Tor circuit before telling the user it's slow (and
// offering Reload / open-in-Tor-Browser) instead of leaving a silent spinner.
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar button {
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

  .toolbar button:hover {
    background: rgba(157, 123, 216, 14%);
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

  .overlay button {
    background: rgba(157, 123, 216, 16%);
    border: 1px solid rgba(157, 123, 216, 45%);
    border-radius: 6px;
    color: #e7ddf3;
    cursor: pointer;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    padding: 7px 14px;
  }

  .overlay button:hover {
    background: rgba(157, 123, 216, 28%);
  }

  @keyframes vaptvupt-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Vaptvupt: FC<ComponentProcessProps> = ({ id }) => {
  const { open } = useProcesses();
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  // Bumping this key remounts the iframe → a clean reload over a fresh request.
  const [reloadKey, setReloadKey] = useState(0);
  const slowTimer = useRef<ReturnType<typeof setTimeout>>();

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
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const openInTorBrowser = (): void => {
    try {
      open("TorBrowser", { url: VAPTVUPT_URL });
    } catch {
      // Tor Browser failed to open — the embedded view is still available.
    }
  };

  return (
    <StyledVaptvupt>
      <div className="toolbar">
        <span className="title">🧅 Vaptvupt — encrypted file share, over Tor</span>
        <button onClick={reload} title="Reload over Tor" type="button">
          ↻ Reload
        </button>
        <button
          onClick={openInTorBrowser}
          title="Open the share in the Tor Browser (toggle scripts if a page needs them)"
          type="button"
        >
          Open in Tor Browser
        </button>
      </div>
      <div className="frame-wrap">
        <iframe
          key={reloadKey}
          allow={VAPTVUPT_ALLOW}
          onLoad={() => setLoading(false)}
          src={VAPTVUPT_SRC}
          title={id}
          {...SANDBOXED_IFRAME_CONFIG}
        />
        {loading && (
          <div className={`overlay${slow ? "" : " pass"}`}>
            <span className="spinner" />
            <span>Connecting to Vaptvupt over Tor…</span>
            {slow && (
              <>
                <span className="hint">
                  A cold Tor circuit can take a while. If it doesn&apos;t appear,
                  reload, or open it in the Tor Browser where you can retry and
                  toggle scripts per page.
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
    </StyledVaptvupt>
  );
};

export default Vaptvupt;
