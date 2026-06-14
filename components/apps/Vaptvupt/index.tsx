import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import styled from "styled-components";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

// VaptVupt — the SecurityOps file share (share.securityops.co).
//
// share.securityops.co sends `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`,
// which block ALL direct embedding — the iframe shows "refused to connect". So we
// load it through the privacy proxy (`?direct=1`: server-side fetch over the normal
// connection), which strips those framing headers and rewrites the page so it
// renders here, in an opaque-origin sandbox. Full JavaScript runs (no nojs/librejs
// flag), so browsing/upload/download work.
//
// Trade-off: because the sandbox is opaque (no allow-same-origin) and the proxy
// doesn't forward Set-Cookie, a login session won't persist. For full login/cookies,
// allow framing on share.securityops.co (drop X-Frame-Options; set
// `frame-ancestors 'self' https://<your-SecurityOS-origin>`) and load it direct.
const VAPTVUPT_URL = "https://share.securityops.co/";
const VAPTVUPT_SRC = `${PROXY_PATH}${encodeURIComponent(VAPTVUPT_URL)}&direct=1`;
const VAPTVUPT_ALLOW = "clipboard-read; clipboard-write; fullscreen";

const StyledVaptvupt = styled.iframe`
  background: #150f1b;
  border: 0;
  display: block;
  height: 100%;
  width: 100%;
`;

const Vaptvupt: FC<ComponentProcessProps> = ({ id }) => (
  <StyledVaptvupt
    allow={VAPTVUPT_ALLOW}
    src={VAPTVUPT_SRC}
    title={id}
    {...SANDBOXED_IFRAME_CONFIG}
  />
);

export default Vaptvupt;
