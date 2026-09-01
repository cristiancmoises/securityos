import MessengerEmbed from "components/apps/Messenger/MessengerEmbed";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

// irc.securityops.com.br is a The Lounge web client (Socket.IO), not a raw
// IRC-over-WebSocket gateway. Reuse the hardened embedded-app transport so its
// HTTP and realtime traffic stays in the SecurityOS proxy/Tor boundary.
const SECURITYOPS_IRC = {
  accent: "#75d59a",
  name: "SecurityOps IRC",
  url: "https://irc.securityops.com.br/",
};

const IRCWeb: FC<ComponentProcessProps> = (props) => (
  <MessengerEmbed {...props} config={SECURITYOPS_IRC} />
);

export default IRCWeb;
