import Messenger, {
  type MessengerConfig,
} from "components/apps/Messenger/Messenger";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";

// Telegram — opens Telegram Web K (web.telegram.org/k/) in a real top-level window.
// Telegram Web sends `x-frame-options: deny`, so it can't be iframed; the launcher
// window is the full client (chats, channels, calls, and native uploads/downloads).
const TELEGRAM: MessengerConfig = {
  accent: "#2aabee",
  available: true,
  logo: (
    <svg fill="#fff" viewBox="0 0 24 24">
      <path d="M21.94 4.5 2.9 11.84c-1.3.5-1.29 1.24-.24 1.56l4.88 1.52 1.89 5.8c.23.63.34.88.77.88.43 0 .62-.2 1.02-.5l2.44-2.37 5.08 3.75c.94.52 1.61.25 1.84-.87l3.34-15.74c.34-1.37-.51-1.99-1.43-1.57ZM7.6 14.2l9.86-6.22c.49-.3.94-.13.57.2l-8.43 7.6-.33 3.5-1.67-5.08Z" />
    </svg>
  ),
  name: "Telegram",
  steps: (
    <>
      <li>
        Click <b>Open Telegram</b> above — Telegram&nbsp;Web opens in its own
        window.
      </li>
      <li>
        Enter your phone number, or scan the QR with{" "}
        <b>Telegram → Settings → Devices → Link Desktop Device</b>.
      </li>
      <li>
        All chats, channels, media, and file transfers work in that window.
      </li>
    </>
  ),
  tagline:
    "The full Telegram Web client — chats, channels, groups, media, and file sharing. Sign in by phone number or QR code.",
  url: "https://web.telegram.org/k/",
  windowSize: { height: 860, width: 1200 },
};

const Telegram: FC<ComponentProcessProps> = () => <Messenger config={TELEGRAM} />;

export default Telegram;
