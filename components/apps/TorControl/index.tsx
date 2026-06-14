import { RELAY_PRESETS } from "components/apps/V86/config";
import StyledTorControl from "components/apps/TorControl/StyledTorControl";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import { useEffect, useId, useState } from "react";

type Mode = "disabled" | "tor" | "clearnet" | "custom";

const isWsUrl = (value: string): boolean => /^wss?:\/\/.+/i.test(value.trim());

const modeFromRelay = (relay: string): Mode => {
  if (!relay) return "disabled";
  if (relay === RELAY_PRESETS.tor) return "tor";
  if (relay === RELAY_PRESETS.clearnet) return "clearnet";
  return "custom";
};

const STATUS_LABEL: Record<Mode, string> = {
  clearnet: "Clearnet relay — NOT anonymous",
  custom: "Custom relay",
  disabled: "Networking disabled (most private)",
  tor: "Routing the Linux VM through Tor",
};

type ProxyTor = "checking" | "down" | "off" | "up";

const PROXY_TOR_LABEL: Record<ProxyTor, string> = {
  checking: "Checking the Tor proxy…",
  down: "Tor proxy UNREACHABLE — start the tor service (onions won't load)",
  off: "Tor proxy not configured (set TOR_PROXY)",
  up: "Tor: connected — Browser & Tor Browser are routed through Tor",
};

const TorControl: FC<ComponentProcessProps> = () => {
  const { emulatorRelayUrl, setEmulatorRelayUrl } = useSession();
  const { open } = useProcesses();
  const groupName = useId();
  const [mode, setMode] = useState<Mode>(() =>
    modeFromRelay(emulatorRelayUrl)
  );
  const [customUrl, setCustomUrl] = useState(() =>
    modeFromRelay(emulatorRelayUrl) === "custom" ? emulatorRelayUrl : ""
  );
  // Server-side Tor proxy (the in-OS Browser/Tor Browser path) — Tor is enabled by
  // default there, so we probe /api/tor-status and show a truthful live state.
  const [proxyTor, setProxyTor] = useState<ProxyTor>("checking");

  // Keep the UI in sync if the session relay changes elsewhere.
  useEffect(() => {
    setMode(modeFromRelay(emulatorRelayUrl));
  }, [emulatorRelayUrl]);

  useEffect(() => {
    let active = true;
    const check = async (): Promise<void> => {
      try {
        const response = await fetch("/api/tor-status", { cache: "no-store" });
        const data = (await response.json()) as {
          configured: boolean;
          tor: boolean;
        };

        if (!active) return;
        setProxyTor(!data.configured ? "off" : data.tor ? "up" : "down");
      } catch {
        if (active) setProxyTor("down");
      }
    };

    check();

    const timer = window.setInterval(check, 15_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const statusMode = modeFromRelay(emulatorRelayUrl);
  const customValid = isWsUrl(customUrl);

  const selectMode = (next: Mode): void => {
    setMode(next);
    if (next === "disabled") setEmulatorRelayUrl("");
    else if (next === "tor") setEmulatorRelayUrl(RELAY_PRESETS.tor);
    else if (next === "clearnet") setEmulatorRelayUrl(RELAY_PRESETS.clearnet);
  };

  const applyCustom = (): void => {
    if (customValid) setEmulatorRelayUrl(customUrl.trim());
  };

  return (
    <StyledTorControl>
      <h1>🧅 Tor Control</h1>
      <p className="subtitle">
        Tor is <strong>enabled by default</strong> for in-OS browsing. The status
        below is live. The relay section controls the separate v86 Linux VM.
      </p>

      <div className={`status proxy-${proxyTor}`}>
        <span className="dot" />
        <span>{PROXY_TOR_LABEL[proxyTor]}</span>
      </div>

      <div className={`status ${statusMode}`}>
        <span className="dot" />
        <span>VM relay — {STATUS_LABEL[statusMode]}</span>
      </div>

      <fieldset>
        <legend>VM network relay</legend>

        <label className="mode">
          <input
            checked={mode === "disabled"}
            name={groupName}
            onChange={() => selectMode("disabled")}
            type="radio"
          />
          <span>
            <span className="mode-title">Disabled (default)</span>
            <br />
            <span className="mode-desc">
              The emulated Linux has no external network. Nothing leaves your
              machine — the most private option.
            </span>
          </span>
        </label>

        <label className="mode">
          <input
            checked={mode === "tor"}
            name={groupName}
            onChange={() => selectMode("tor")}
            type="radio"
          />
          <span>
            <span className="mode-title">Tor ({RELAY_PRESETS.tor})</span>
            <br />
            <span className="mode-desc">
              Sends the VM&apos;s traffic through a local WebSocket→SOCKS5 bridge
              that exits via Tor. Requires the bridge to be running (see docs).
            </span>
          </span>
        </label>

        <label className="mode">
          <input
            checked={mode === "clearnet"}
            name={groupName}
            onChange={() => selectMode("clearnet")}
            type="radio"
          />
          <span>
            <span className="mode-title">Clearnet relay</span>
            <br />
            <span className="mode-desc">
              Uses a public third-party relay ({RELAY_PRESETS.clearnet}). Traffic
              exits in the clear through a stranger — not anonymous.
            </span>
          </span>
        </label>

        <label className="mode">
          <input
            checked={mode === "custom"}
            name={groupName}
            onChange={() => setMode("custom")}
            type="radio"
          />
          <span>
            <span className="mode-title">Custom relay</span>
            <br />
            <span className="mode-desc">
              Point the VM at your own ws:// or wss:// relay (e.g. your own Tor
              bridge on another host).
            </span>
          </span>
        </label>

        {mode === "custom" && (
          <div className="custom-url">
            <input
              aria-label="Custom relay URL"
              className={customUrl && !customValid ? "invalid" : undefined}
              onChange={(event) => setCustomUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyCustom();
              }}
              placeholder="wss://your-host:port/"
              type="text"
              value={customUrl}
            />
            <button
              className="apply"
              disabled={!customValid}
              onClick={applyCustom}
              type="button"
            >
              Apply
            </button>
          </div>
        )}
      </fieldset>

      <div className="note">
        Changes apply the <strong>next time the V86 app boots</strong>. Close and
        reopen the VM (or start a fresh disk image) for a new relay to take
        effect.
      </div>

      <div className="note">
        To verify Tor from <em>inside</em> the VM, run{" "}
        <code>curl https://check.torproject.org/api/ip</code> in the guest — it
        should report <code>IsTor: true</code>. Set up the bridge with{" "}
        <a
          href="/Users/Public/Documents/TOR.md"
          onClick={(event) => {
            event.preventDefault();
            open("Marked", { url: "/Users/Public/Documents/TOR.md" });
          }}
          rel="noreferrer"
        >
          docs/TOR.md
        </a>
        .
      </div>

      <div className="note warn">
        The relay above controls only the <strong>emulated Linux VM</strong>. The
        in-OS <strong>Browser</strong> and <strong>Tor Browser</strong> already
        route through Tor server-side (status shown at the top). Only the
        SecurityOS shell page itself uses your real browser connection — to
        anonymize that too, open SecurityOS via its <code>.onion</code> address.
        See docs/TOR.md.
      </div>
    </StyledTorControl>
  );
};

export default TorControl;
