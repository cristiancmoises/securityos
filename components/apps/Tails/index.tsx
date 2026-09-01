import StyledTool from "components/apps/SecTools/StyledTool";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import { useEffect, useState } from "react";

// TAILS launcher. Honest portal — NOT an in-browser boot. Real Tails is 64-bit and
// the in-browser emulator (v86) is 32-bit, so Tails can't boot in the tab. This
// surfaces the CI-verified (OpenPGP signature + SHA-256) download for a native VM,
// and a button to boot a 32-bit amnesic/Tor live ISO in the in-browser VM.
type Manifest = {
  release_url?: string;
  official?: string;
  sha256?: string;
  signing_key_fpr?: string;
  verified?: boolean;
  version?: string;
};

const MANIFEST_URL = "/Program Files/Tails/manifest.json";
const OFFICIAL = "https://tails.net/install/";
// A 32-bit (i686) live ISO that the in-browser VM CAN boot (amnesic). Editable —
// update the version as needed. Fetched through the Tor proxy and booted from CD.
const DEFAULT_LIVE_ISO =
  "https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/x86/alpine-virt-3.21.0-x86.iso";

// Curated lightweight 32-bit (i686) GNU+Linux / UNIX-like live ISOs the in-browser
// VM can boot (amnesic). Best-effort — v86 is a 32-bit emulator + fetch is over Tor,
// so boot success/speed varies; URLs are editable via "Custom ISO…". For anonymity,
// route the VM through Tor in the Tor Control app first.
const SYSTEMS: { name: string; url: string }[] = [
  {
    name: "Alpine Linux (x86, ~60 MB)",
    url: "https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/x86/alpine-virt-3.21.0-x86.iso",
  },
  {
    name: "Tiny Core Linux (x86, ~24 MB)",
    url: "https://distro.ibiblio.org/tinycorelinux/15.x/x86/release/TinyCore-current.iso",
  },
  {
    name: "SliTaz GNU/Linux (x86, ~50 MB)",
    url: "https://mirror.slitaz.org/iso/rolling/slitaz-rolling.iso",
  },
  {
    name: "Debian netinst (i386, ~700 MB)",
    url: "https://cdimage.debian.org/debian-cd/current/i386/iso-cd/debian-12.0.0-i386-netinst.iso",
  },
];

const Tails: FC<ComponentProcessProps> = () => {
  const { open } = useProcesses();
  const [manifest, setManifest] = useState<Manifest>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data) => {
        if (active) {
          setManifest(data as Manifest);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const verified = Boolean(manifest?.verified && manifest?.version);
  const downloadUrl = manifest?.release_url || manifest?.official || OFFICIAL;

  const bootIso = (url: string): void => {
    if (/^https?:\/\//.test(url)) open("V86", { url });
  };

  const bootLive = (): void => {
    const iso = window.prompt(
      "32-bit (i686) live ISO URL to fetch + boot (amnesic). Tip: enable Tor in Tor Control first for anonymous networking. Best-effort — v86 is a 32-bit emulator, so boot success varies by ISO.",
      DEFAULT_LIVE_ISO
    );

    if (iso?.trim()) bootIso(iso.trim());
  };

  return (
    <StyledTool>
      <h2>🧅 TAILS — Amnesic Incognito Live System</h2>
      <p className="desc">
        Tails routes everything through Tor and leaves no trace. SecurityOS
        keeps a signature + SHA-256 verified copy current via CI.
      </p>

      {verified ? (
        <pre className="output ok">
          {`✓ Verified Tails ${manifest?.version}
SHA-256: ${manifest?.sha256}
OpenPGP key: ${manifest?.signing_key_fpr || "(pinned Tails key)"}`}
        </pre>
      ) : loaded ? (
        <p className="muted">
          No verified build published yet — run the <code>tails-iso</code>{" "}
          action (GitHub/Forgejo) to fetch + verify the latest Tails.
        </p>
      ) : (
        <p className="muted">Checking for a verified build…</p>
      )}

      <div className="btn-row">
        <button
          onClick={() =>
            window.open(downloadUrl, "_blank", "noopener,noreferrer")
          }
          type="button"
        >
          Download verified Tails
        </button>
        <button className="secondary" onClick={bootLive} type="button">
          Custom ISO…
        </button>
      </div>

      <p className="desc" style={{ marginBottom: 2 }}>
        Boot a lightweight 32-bit live system in the VM (amnesic):
      </p>
      <div className="btn-row">
        {SYSTEMS.map(({ name, url }) => (
          <button
            key={name}
            className="secondary"
            onClick={() => bootIso(url)}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>

      <p className="muted">
        ⚠️ Real Tails is <b>64-bit</b> — run the downloaded <code>.iso</code> in
        a native VM (QEMU/VirtualBox). The in-browser emulator is 32-bit, so it
        boots 32-bit amnesic/Tor live ISOs but <b>not</b> 64-bit Tails. See{" "}
        <code>docs/LIVE-ISO.md</code>.
      </p>
    </StyledTool>
  );
};

export default Tails;
