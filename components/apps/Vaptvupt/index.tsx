import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useState } from "react";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// Vaptvupt — the SecurityOps "zupt" file/folder share. Loaded DIRECTLY at its real
// https origin (share.securityops.co), NOT via the Tor HTML-rewriting proxy.
//
// TRADEOFF: the old embed routed the Vaptvupt .onion through the privacy proxy in
// an opaque-origin sandbox. That gave anonymity but BROKE the two things this app
// exists for: the sandbox had no `allow-downloads` (so file downloads were blocked),
// and the proxy is GET-only (httpGet in pages/api/proxy.ts never forwards a request
// body), so multipart file UPLOAD could not work either. To make download + upload
// fully functional we embed the clearnet share directly with IFRAME_CONFIG — exactly
// like SecChat (which goes direct because WebRTC needs a real browser context).
// IFRAME_CONFIG already carries `allow-downloads allow-forms ... allow-same-origin
// allow-scripts`, so native browser download AND multipart upload work, and the page
// keeps its own real origin/storage. `https:` is already in the page CSP `frame-src`
// (scripts/securityHeaders.js), so no header change is needed; downloads need no
// Permissions-Policy entry.
//
// NOTE: like SecChat, share.securityops.co must allow being framed by the SecurityOS
// origin (CSP `frame-ancestors`, no blocking X-Frame-Options) or the embed goes blank.
const VAPTVUPT_URL = "https://share.securityops.co/";
const VAPTVUPT_ALLOW =
  "clipboard-read; clipboard-write; fullscreen";

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
        src={VAPTVUPT_URL}
        title={id}
        {...IFRAME_CONFIG}
      />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          Connecting to Vaptvupt…
        </div>
      )}
    </StyledVaptvupt>
  );
};

export default Vaptvupt;
