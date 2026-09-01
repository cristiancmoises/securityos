import { PROXY_PATH } from "components/apps/Browser/config";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import type { FC } from "react";
import { useEffect } from "react";
import { SANDBOXED_IFRAME_CONFIG } from "utils/constants";

const GODS_EYE_URL = "https://eye.securityops.co/";

// A dedicated, sandboxed dashboard window. The same server-side proxy used by the
// clearnet browser removes framing restrictions while keeping the remote page away
// from the SecurityOS origin.
const GodsEye: FC<ComponentProcessProps> = ({ id }) => {
  const { prependFileToTitle } = useTitle(id);

  useEffect(() => prependFileToTitle("GODS EYE"), [prependFileToTitle]);

  return (
    <iframe
      src={`${PROXY_PATH}${encodeURIComponent(GODS_EYE_URL)}&direct=1`}
      style={{ border: 0, height: "100%", width: "100%" }}
      title="GODS EYE"
      {...SANDBOXED_IFRAME_CONFIG}
    />
  );
};

export default GodsEye;
