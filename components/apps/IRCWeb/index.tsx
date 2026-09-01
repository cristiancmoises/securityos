import RoutedWebApp from "components/apps/RoutedWebApp";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

// irc.securityops.com.br is a The Lounge web client (Socket.IO), not a raw
// IRC-over-WebSocket gateway. Tor mode uses the hardened embedded-app transport
// for HTTP and Socket.IO, while the explicit clearnet mode uses the live origin
// directly for the most compatible full client.
const SECURITYOPS_IRC = {
  accent: "#75d59a",
  allow: "clipboard-read; clipboard-write; fullscreen",
  directTransport: "native" as const,
  name: "SecurityOps IRC",
  profile: "irc" as const,
  subtitle: "The Lounge at irc.securityops.com.br",
  torNote: "HTTP and Socket.IO stay inside the SecurityOS Tor proxy.",
  url: "https://irc.securityops.com.br/",
};

const IRCWeb: FC<ComponentProcessProps> = (props) => (
  <RoutedWebApp {...props} config={SECURITYOPS_IRC} />
);

export default IRCWeb;
