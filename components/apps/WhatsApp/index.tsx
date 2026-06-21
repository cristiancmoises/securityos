import MessengerEmbed, {
  type MessengerEmbedConfig,
} from "components/apps/Messenger/MessengerEmbed";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";

// WhatsApp — runs WhatsApp Web INSIDE SecurityOS, fetched through the privacy proxy
// over Tor (works on networks that block WhatsApp; the user's IP is never exposed).
// Heavy SPA + service workers + Tor-exit blocking can limit the embed; the toolbar's
// "Window" button opens the full official client (run the OS in Tor Browser for Tor).
const WHATSAPP: MessengerEmbedConfig = {
  accent: "#25d366",
  name: "WhatsApp",
  url: "https://web.whatsapp.com/",
};

const WhatsApp: FC<ComponentProcessProps> = (props) => (
  <MessengerEmbed {...props} config={WHATSAPP} />
);

export default WhatsApp;
