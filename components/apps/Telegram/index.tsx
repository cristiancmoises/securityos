import MessengerEmbed, {
  type MessengerEmbedConfig,
} from "components/apps/Messenger/MessengerEmbed";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";

// Telegram — runs Telegram Web (K) INSIDE SecurityOS, fetched through the privacy
// proxy over Tor (works on networks that block Telegram; IP never exposed). Telegram
// is more Tor-tolerant than most, but it's still a heavy SPA; the toolbar's "Window"
// button opens the full official client (run the OS in Tor Browser for Tor).
const TELEGRAM: MessengerEmbedConfig = {
  accent: "#2aabee",
  name: "Telegram",
  url: "https://web.telegram.org/k/",
};

const Telegram: FC<ComponentProcessProps> = (props) => (
  <MessengerEmbed {...props} config={TELEGRAM} />
);

export default Telegram;
