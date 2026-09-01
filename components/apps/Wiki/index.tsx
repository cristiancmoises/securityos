import RoutedWebApp from "components/apps/RoutedWebApp";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

// The Wiki sends X-Frame-Options: SAMEORIGIN, so both in-OS modes use the
// same-origin SecurityOS app proxy. Tor is the fail-closed default; clearnet is an
// explicit direct-server-egress choice. The native-site button remains available
// for a full top-level client.
const SECURITYOPS_WIKI = {
  accent: "#55cfff",
  name: "SecurityOps Wiki",
  profile: "wiki" as const,
  subtitle: "wiki.securityops.co",
  torNote: "Pages and assets stay inside the SecurityOS Tor proxy.",
  url: "https://wiki.securityops.co/",
};

const Wiki: FC<ComponentProcessProps> = (props) => (
  <RoutedWebApp {...props} config={SECURITYOPS_WIKI} />
);

export default Wiki;
