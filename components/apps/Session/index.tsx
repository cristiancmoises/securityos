import Messenger, {
  type MessengerConfig,
} from "components/apps/Messenger/Messenger";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";

// Session — the onion-routed, account-free messenger. Session has NO web client
// (it's a desktop/mobile app built on the Oxen service-node network), so it can't
// be embedded or run in a browser tab. This app is an honest launcher: it opens the
// official download page in a top-level window and explains how Session works.
const SESSION: MessengerConfig = {
  accent: "#00f782",
  available: false,
  logo: (
    <svg
      fill="none"
      stroke="#0b3b22"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 3 4 6v6c0 4.4 3.4 7.5 8 9 4.6-1.5 8-4.6 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  name: "Session",
  steps: (
    <>
      <li>
        Session is a <b>desktop &amp; mobile app</b> — it has no web client, so it
        can&apos;t run inside a browser tab.
      </li>
      <li>
        Click <b>Get Session</b> above to open the official downloads in a window,
        then install it on this device.
      </li>
      <li>
        No phone number or email needed — Session messages are onion-routed over
        its own network for strong privacy.
      </li>
    </>
  ),
  tagline:
    "End-to-end encrypted, onion-routed messaging with no phone number or email. Session runs as a desktop/mobile app — get it below.",
  url: "https://getsession.org/download",
  windowSize: { height: 820, width: 1100 },
};

const Session: FC<ComponentProcessProps> = () => <Messenger config={SESSION} />;

export default Session;
