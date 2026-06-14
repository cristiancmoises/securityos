import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

// SecTube — the SecurityOps video frontend (yt.securityops.co). Loaded DIRECTLY
// (not via the Tor proxy): video has to stream + run its player JS, which the
// HTML-rewriting proxy can't do. yt.securityops.co sends no X-Frame-Options, so a
// direct embed works — the missing piece for playback was the iframe Permissions-
// Policy: autoplay/encrypted-media/fullscreen must be explicitly delegated, or
// clicking play is inert. (For anonymous browsing of other sites, use Tor Browser.)
const SECTUBE_URL = "https://yt.securityops.co/";
const SECTUBE_ALLOW =
  "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; accelerometer; gyroscope";

const StyledSecTube = styled.iframe`
  background: #0f0f0f;
  border: 0;
  display: block;
  height: 100%;
  width: 100%;
`;

const SecTube: FC<ComponentProcessProps> = ({ id }) => (
  <StyledSecTube
    allow={SECTUBE_ALLOW}
    src={SECTUBE_URL}
    title={id}
    {...IFRAME_CONFIG}
  />
);

export default SecTube;
