import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// VaptVupt — the SecurityOps file share (share.securityops.co), loaded DIRECTLY
// (real origin, cookies, full JavaScript) so the site is FULLY usable: login,
// upload, manage and download shares — everything a real browser tab can do.
//
// Like SecChat, this only renders if share.securityops.co allows being framed by
// the SecurityOS origin. It currently sends `X-Frame-Options: DENY` and CSP
// `frame-ancestors 'none'`, which block ALL embedding (the iframe stays blank).
// To enable full usage, on share.securityops.co:
//   • remove `X-Frame-Options: DENY`
//   • set `Content-Security-Policy: frame-ancestors 'self' https://<your-SecurityOS-origin>`
// (Routing it through the privacy proxy would strip those headers and render it
// now, but in an opaque sandbox where login/cookies don't persist — i.e. NOT full
// usage — so we load it direct, the way an interactive first-party app needs.)
const VAPTVUPT_URL = "https://share.securityops.co/";
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
    src={VAPTVUPT_URL}
    title={id}
    {...IFRAME_CONFIG}
  />
);

export default Vaptvupt;
