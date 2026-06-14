import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// SecChat — the SecurityOps end-to-end encrypted video chat (chat.securityops.co)
// with text messaging. Loaded DIRECTLY (not via the Tor proxy): WebRTC needs real
// getUserMedia + peer connections in a genuine browser context, which the HTML-
// rewriting proxy can't provide. For the webcam/microphone to work, two things
// must agree: (1) the iframe `allow` attribute below grants the features, and
// (2) the page Permissions-Policy (scripts/securityHeaders.js) DELEGATES
// camera/microphone/display-capture to https://chat.securityops.co — (self) alone
// blocks cross-origin delegation, so the camera would stay dark.
//
// NOTE: chat.securityops.co must also allow being framed by the SecurityOS origin
// (CSP `frame-ancestors`, no blocking X-Frame-Options) or the embed goes blank.
const SECCHAT_URL = "https://chat.securityops.co/";
const SECCHAT_ALLOW =
  "camera; microphone; display-capture; autoplay; fullscreen; picture-in-picture; clipboard-write";

const StyledSecChat = styled.iframe`
  background: #150f1b;
  border: 0;
  display: block;
  height: 100%;
  width: 100%;
`;

const SecChat: FC<ComponentProcessProps> = ({ id }) => (
  <StyledSecChat
    allow={SECCHAT_ALLOW}
    src={SECCHAT_URL}
    title={id}
    {...IFRAME_CONFIG}
  />
);

export default SecChat;
