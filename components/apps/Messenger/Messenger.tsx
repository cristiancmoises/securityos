import StyledMessenger from "components/apps/Messenger/StyledMessenger";
import { type ReactNode, useCallback, useState } from "react";

// Shared launcher for the messenger apps (WhatsApp / Telegram / Session).
//
// WHY A LAUNCHER, NOT AN EMBED: these clients cannot run inside a SecurityOS window
// iframe. WhatsApp Web ships `content-security-policy: frame-ancestors
// https://*.whatsapp.com` and Telegram Web ships `x-frame-options: deny`, so the
// browser refuses to frame them anywhere else; both also talk over `wss://`
// WebSockets, which the SecurityOS Tor proxy deliberately blocks (a WS would bypass
// Tor). Session has no web client at all. The one place these DO work is a real
// TOP-LEVEL browser window (anti-framing headers don't apply, WebSockets/QR-login/
// uploads/downloads all work natively), so the app opens the official web client
// there with one click, reusing a stable window name so re-clicks bring it to front.
//
// PRIVACY: a top-level window is a DIRECT connection — NOT routed through Tor (these
// services block Tor exits / need raw WebSockets). The app says so up front.

export type MessengerConfig = {
  // Brand accent (CSS color). Drives the logo tile + primary button.
  accent: string;
  // Whether `url` is a working web CLIENT (WhatsApp/Telegram) vs. a download/info
  // page (Session, which has no web client). Changes the copy + button label.
  available: boolean;
  // Inline brand logo (rendered white-on-accent inside the logo tile).
  logo: ReactNode;
  name: string;
  // Short steps shown in the panel (e.g. "Scan the QR code with your phone").
  steps: ReactNode;
  tagline: string;
  // The official web client (or download page) opened in the top-level window.
  url: string;
  // Optional preferred window size for the popup.
  windowSize?: { height: number; width: number };
};

const Messenger: FC<{ config: MessengerConfig }> = ({ config }) => {
  const { accent, available, logo, name, steps, tagline, url, windowSize } =
    config;
  const [launched, setLaunched] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const launch = useCallback(() => {
    const width = windowSize?.width ?? 1180;
    const height = windowSize?.height ?? 800;
    // Center the popup over the current screen when geometry is available.
    const left =
      typeof window !== "undefined"
        ? Math.max(0, Math.round((window.screen.width - width) / 2))
        : 0;
    const top =
      typeof window !== "undefined"
        ? Math.max(0, Math.round((window.screen.height - height) / 2))
        : 0;
    // Use a STABLE window NAME (`securityos-<name>`): the browser reuses + refocuses
    // an existing window of that name on repeat clicks, so we get "bring to front"
    // for free WITHOUT keeping a handle. We can't track the handle ourselves anyway —
    // SecurityOS sends `Cross-Origin-Opener-Policy: same-origin`, which SEVERS the
    // returned cross-origin WindowProxy (`.closed` lies, `.focus()` is a no-op), so
    // handle-based open/close tracking would be wrong. A pop-up BLOCK still returns
    // null (distinct from a severed-but-open handle), so we can still detect that.
    const child = window.open(
      url,
      `securityos-${name}`,
      `popup,width=${width},height=${height},left=${left},top=${top}`
    );

    if (child) {
      setLaunched(true);
      setBlocked(false);
    } else {
      // A pop-up blocker swallowed the window even though this is a user gesture —
      // tell the user how to allow it instead of doing nothing.
      setBlocked(true);
    }
  }, [name, url, windowSize]);

  return (
    <StyledMessenger $accent={accent}>
      <div className="card">
        <span className="logo">{logo}</span>
        <h1>{name}</h1>
        <p className="tagline">{tagline}</p>

        <span className="badge">
          ⚠ Direct connection — NOT routed through Tor
        </span>

        <button className="open-btn" onClick={launch} type="button">
          <svg fill="none" viewBox="0 0 24 24">
            <path
              d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          {launched
            ? `Reopen ${name}`
            : available
              ? `Open ${name}`
              : `Get ${name}`}
        </button>

        <p className={`status${launched && !blocked ? " live" : ""}`}>
          {blocked
            ? "⚠ Your browser blocked the pop-up. Allow pop-ups for SecurityOS, then click again."
            : launched
              ? `● Opened in its own window — uploads, downloads & calls work there. Click again to bring it back.`
              : available
                ? "Opens in a separate, full-feature window."
                : ""}
        </p>

        <ul className="steps">{steps}</ul>

        <details className="tor-note">
          <summary>{available ? `Using ${name} over Tor` : "Privacy & Tor"}</summary>
          {available ? (
            <p>
              {name} relies on <b>WebSockets</b>, which SecurityOS&apos;s built-in
              Tor proxy blocks (a WebSocket would bypass Tor) — so this window is a{" "}
              <b>direct</b> connection. To use {name} anonymously, route your{" "}
              <b>whole browser or device</b> through Tor first: open SecurityOS in
              the <b>Tor Browser</b>, or run it inside <b>Tails</b> / a system-wide
              Tor, then launch {name} here. Full guide: <b>SecurityOS Handbook</b>{" "}
              in Documents.
            </p>
          ) : (
            <p>
              {name} carries <b>its own onion routing</b> once installed — messages
              travel over its private network with no phone number or email. This
              window only opens the official <b>download page</b> (a direct
              connection); run SecurityOS in the <b>Tor Browser</b> for that step
              to stay anonymous. See the <b>SecurityOS Handbook</b> in Documents.
            </p>
          )}
        </details>

        <p className="footnote">
          The window is a normal browser window on your device. Files you{" "}
          <b>download</b> save to your real Downloads folder, and{" "}
          <b>uploads</b> use your device&apos;s file picker — both fully
          functional. Closing it signs you out only if you choose to.
        </p>
      </div>
    </StyledMessenger>
  );
};

export default Messenger;
