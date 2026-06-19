import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useState } from "react";
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
// `allow-downloads`, and pages/api/proxy.ts now forwards POST/multipart request
// bodies over Tor (SSRF-guarded, cookie-less), so the share's upload form submits
// through the proxy and downloads stream back — all routed through Tor in the
// opaque-origin sandbox (no direct connection, no framing requirement).
const VAPTVUPT_URL =
  "http://secopsuwwht2unomwt3jofl33kfqsfd2z6cwip6rbqlapi7s4pys5vyd.onion/";
const VAPTVUPT_SRC = `${PROXY_PATH}${encodeURIComponent(VAPTVUPT_URL)}`;
const VAPTVUPT_ALLOW = "clipboard-read; clipboard-write; fullscreen";

const StyledVaptvupt = styled.div`
  background: #150f1b;
  height: 100%;
  position: relative;
  width: 100%;

  iframe {
    border: 0;
    display: block;
    height: 100%;
    width: 100%;
  }

  .loading {
    align-items: center;
    color: #b9a7cf;
    display: flex;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 13px;
    gap: 10px;
    inset: 0;
    justify-content: center;
    letter-spacing: 0.3px;
    pointer-events: none;
    position: absolute;
  }

  .spinner {
    animation: vaptvupt-spin 0.9s linear infinite;
    border: 2px solid rgba(185, 167, 207, 25%);
    border-radius: 50%;
    border-top-color: #9d7bd8;
    height: 18px;
    width: 18px;
  }

  @keyframes vaptvupt-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Vaptvupt: FC<ComponentProcessProps> = ({ id }) => {
  const [loading, setLoading] = useState(true);

  return (
    <StyledVaptvupt>
      <iframe
        allow={VAPTVUPT_ALLOW}
        onLoad={() => setLoading(false)}
        src={VAPTVUPT_SRC}
        title={id}
        {...SANDBOXED_IFRAME_CONFIG}
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          Connecting to Vaptvupt over Tor…
        </div>
      )}
    </StyledVaptvupt>
  );
};

export default Vaptvupt;
