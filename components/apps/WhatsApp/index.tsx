import Messenger, {
  type MessengerConfig,
} from "components/apps/Messenger/Messenger";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";

// WhatsApp — opens WhatsApp Web (web.whatsapp.com) in a real top-level window.
// It can't be iframed (CSP `frame-ancestors https://*.whatsapp.com`) and runs over
// `wss://` WebSockets the Tor proxy blocks, so the launcher window is the only way
// it works. There it is the full WhatsApp Web client — chats, voice/video calls,
// and native file uploads/downloads.
const WHATSAPP: MessengerConfig = {
  accent: "#25d366",
  available: true,
  logo: (
    <svg fill="#fff" viewBox="0 0 24 24">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01ZM12.04 20.15h-.003a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  ),
  name: "WhatsApp",
  steps: (
    <>
      <li>
        Click <b>Open WhatsApp</b> above — the full WhatsApp&nbsp;Web client opens
        in its own window.
      </li>
      <li>
        On your phone: <b>Settings → Linked Devices → Link a Device</b>.
      </li>
      <li>Scan the QR code shown in the window to sign in.</li>
    </>
  ),
  tagline:
    "The full WhatsApp Web client — chats, voice & video calls, and file sharing. Link it to your phone with a QR code.",
  url: "https://web.whatsapp.com/",
  windowSize: { height: 860, width: 1200 },
};

const WhatsApp: FC<ComponentProcessProps> = () => <Messenger config={WHATSAPP} />;

export default WhatsApp;
