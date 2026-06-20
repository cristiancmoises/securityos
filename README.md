# 🔐 SecurityOS

**SecurityOS** is a privacy- and security-first **web operating system** — a hardened
fork of [daedalOS](https://github.com/DustinBrett/daedalOS) (Next.js + TypeScript).
It runs entirely in the browser and is built for students, researchers, and security
practitioners who want an anonymous, amnesic, self-contained workspace.

🌐 [os.securityops.co](https://os.securityops.co)

---

## ✨ Highlights

- **🧅 Tor Browser (anonymity-only)** — all web access goes through the **Tor
  Browser**: a server-side privacy proxy routes every request over Tor (SOCKS5h,
  so `.onion` resolves and clear-net hostnames never leak), with **tabs** and a
  **NoScript-style 3-state JS control** (Off / first-party-only / All). There is
  no clearnet browser. The proxy is SSRF-guarded, fails closed if Tor is
  misconfigured, pins the SSRF-validated IP, forwards only an allowlist of
  response headers, and logs nothing. See [Tor Browser](#-tor-browser).
- **🦀 Memory-safe proxy sidecar** — the untrusted fetch + HTML-rewriting path is also
  available as a Rust sidecar (Tor SOCKS5h, DNS-pinned SSRF guard, `lol_html`
  streaming rewriter); the OS delegates to it and transparently falls back to the
  built-in proxy.
- **🔑 Vaptvupt encryption (WebAssembly)** — the real Vaptvupt engine compiled to WASM:
  - **Password mode:** PBKDF2-SHA256 → AES-256-CTR + HMAC-SHA256 (encrypt-then-MAC) → `.zupt`.
  - **Post-quantum public-key mode:** **ML-KEM-768 + X25519 hybrid** — generate a
    keypair, encrypt to a public key, decrypt with the private key.
  - Exposed in the **Terminal** (`vaptvupt`/`encrypt`/`decrypt`) and the
    file-manager right-click **Encrypt/Decrypt** menu.
- **🗑️ Secure delete** — right-click any file/folder → overwrite with **random (3-pass)**
  or **zeros**, then delete.
- **🧠 Amnesia** — containers run read-only with RAM-only `tmpfs` (no volumes, no logs);
  the session is overwritten with CSPRNG randomness and wiped on shutdown.
- **💻 Linux VM** — a 32-bit x86 emulator (v86, WASM) that boots lightweight **live ISOs**
  (Alpine, Tiny Core, SliTaz, …) amnesically, routable through Tor.
- **🧅 TAILS** — a launcher with **CI-verified** (OpenPGP signature + SHA-256) downloads,
  auto-updated by the `tails-iso` GitHub/Forgejo action.
- **💬 Matrix (end-to-end-encrypted chat)** — a full Matrix client
  (matrix-js-sdk + Rust crypto/WASM) where **every request is tunneled through the
  same-origin Tor proxy** to `matrix.securityops.co`. It decrypts E2EE rooms,
  searches the user directory, browses/joins federated rooms, handles invites, and
  renders image/file attachments. It **pre-warms the Tor circuit on open** so the
  first login is fast (cold Tor otherwise makes the first request take 15–40s).
  **Amnesic** — keys live in memory only. See [Matrix](#-matrix).
- **🎥 SecChat** — first-party end-to-end-encrypted video chat
  (`chat.securityops.co`), embedded in-OS.
- **📻 Radio** — listen to internet radio worldwide (radio-browser API). **Exact**
  country filtering (by ISO country code, not a fuzzy name match), genre filter, and
  **only working HTTPS stations** — offline and non-playable (http-only) ones are
  filtered out — plus favorites and resilient mirror failover.
- **📝 Cloudmacs** — a full **Emacs** (Spacemacs) in the browser (Gotty serving a
  terminal Emacs), with **telega** (Telegram — TDLib built into the image),
  **whatsappel** (WhatsApp), **org-mode**, and **eww**. Appears in *Open with* for
  text/code files.
- **📺 SecTube** — the SecurityOps video frontend, embedded for playback.
- **📁 VaptVupt file share** — the first-party SecurityOps encrypted file share,
  embedded in-OS **over Tor** (its `.onion` served through the privacy proxy in an
  opaque-origin sandbox). Upload and download files in the window (uploads up to
  256 MiB; downloads stream back in full); a toolbar offers **Reload** and **Open in
  Tor Browser** for script-heavy actions. Real-time/WebSocket features aren't
  available through the proxy by design.
- **🟢 WhatsApp · Telegram · Session** — launchers for the official messengers.
  These can't be embedded (anti-framing headers; WebSockets the Tor proxy blocks;
  Session has no web client), so each opens its **official client in a real
  top-level window** where it's fully functional (chats, calls, uploads/downloads,
  QR login), with a clear **"Direct connection — NOT routed through Tor"** badge. To
  use them over Tor, run SecurityOS itself in the **Tor Browser** / Tails — each app
  explains how, and so does the **SecurityOS Handbook**.
- **⏺️ Screen Capture** — screen recording + screenshots via `getDisplayMedia`
  (captures everything on screen, incl. cross-origin app iframes): countdown,
  microphone + system audio, quality/format/codec presets, and a max-duration. A
  **webcam picture-in-picture overlay** offers selectable effect themes — Matrix
  (digital rain), Grayscale, Sepia, Neon/Invert, Blur, and a best-effort
  Background blur.
- **🧩 Desktop Widgets** — Rainmeter-style, draggable, toggleable, and persisted:
  **Clock**, **Weather** (searchable city, open-meteo), a JS-heap **Memory** gauge,
  **RSS News** (fetched over Tor), a month-grid **Calendar**, and a **Post-it**
  sticky note. A Clock and the News feed are shown on first run.
- **🔒 Lock screen** — a frosted overlay with a large clock over the blurred
  wallpaper, an optional **PIN** (salted SHA-256), **idle auto-lock**, and it stays
  locked across reload; a **Lock** button lives in the Start menu.
- **🔊 Master volume** — the taskbar volume now controls **all** web-OS sound —
  native audio/video plus WebAudio apps like **Webamp** and the **v86** emulator.
- **🎵 Music + Webamp** — bundled free/classical music and the **Webamp**
  (Winamp-style) player, plus lots of wallpapers (including animated ones).
- **🪟 Undercover mode** — a Windows-11-like appearance (folders/wallpaper/theming)
  for blending in.
- **🛟 Resilience / recovery** — if corrupted saved data from an old version would
  otherwise stop the desktop from starting, SecurityOS shows a **recovery screen**
  (*Try again* / *Reset*) instead of reloading forever.
- **🧰 Security Tools** — an offline suite (hashing, encoding, entropy, UUID, …).
- **⌨️ Expanded terminal** — UNIX-style commands plus `curl`/`wget` over Tor, `du`,
  `df`, `tree`, `stat`, and more.
- **🖼️ Custom wallpaper** — set a background from an image URL or a proxied link;
  adjustable fit. **📋 Paste** any file/image from the clipboard straight onto the Desktop.

---

## 🧅 Tor Browser

SecurityOS browses the web through **one** browser — the **Tor Browser**,
anonymity first. (There is intentionally **no clearnet browser**: all web access
goes over Tor.)

- Every request is routed through **Tor** (SOCKS5h, including DNS) via a
  server-side privacy proxy, so `.onion` resolves and your real IP is never
  revealed. Clear-net sites load over Tor too; hostnames never leak to a local
  resolver.
- **Tabbed** — per-tab history; Ctrl/⌘- or middle-click a link to open it in a
  new tab; `＋` for a blank tab. Tab labels show the page title.
- **NoScript-style 3-state JavaScript control** (toolbar): **Off** — *Safest*,
  all JS blocked + `script-src 'none'`; **NoScript** — first-party scripts only,
  third-party stripped server-side by the LibreJS filter; **All** — every script
  runs. Off by default.
- Bookmarks point at the SecurityOps **hidden services**.
- The proxy is SSRF-guarded, **fails closed** if Tor is misconfigured, **pins the
  SSRF-validated IP** (no DNS rebinding), forwards only an allowlist of response
  headers, rewrites links/forms to stay in-app, and **logs nothing**.

> **What loads, and what won't.** The proxy renders pages **server-side in an
> opaque sandbox**, so it's deliberately *not* a full browser: onions and simple,
> mostly-static sites render cleanly, but many arbitrary sites **won't** — they
> block Tor exit IPs (Cloudflare challenges), require JavaScript + login, or break
> under URL rewriting. That's the inherent ceiling of a privacy proxy, not a bug.
> For genuinely full, anonymous browsing of arbitrary sites, use the **Linux VM
> via Tor Control**.

---

## 💬 Matrix

SecurityOS ships a **full end-to-end-encrypted Matrix client** (matrix-js-sdk with
the **Rust crypto/WASM** stack), wired so that **every request is tunneled through
the same-origin Tor proxy** to the `matrix.securityops.co` homeserver — nothing
talks to Matrix off-Tor.

- **E2EE** — decrypts encrypted rooms; keys are **kept in memory only** (amnesic —
  nothing is written to disk).
- **Federation** — search the user directory, browse and join federated rooms, and
  accept/decline invites.
- **Attachments** — renders image and file attachments.
- **Fast first login** — the client **pre-warms the Tor circuit the moment you open
  it**, so login is quick. (A cold Tor circuit otherwise makes the first request
  take ~15–40s.)

---

## 🛡️ Security model

- **Strict CSP** without `'unsafe-eval'` (WASM uses `'wasm-unsafe-eval'`), `frame-ancestors 'none'`,
  HSTS, COOP, CORP, and a locked-down **Permissions-Policy**.
- **Tor egress** for all proxied browsing; the v86 VM defaults to a local Tor relay.
- **No persistence by design** — see *Amnesia* above.
- Single source of truth for headers: [`scripts/securityHeaders.js`](scripts/securityHeaders.js)
  (mirrored to `next.config.js`, `pages/_document.tsx`, and the `deploy/` reverse-proxy samples).

---

## 🚀 Deploy

**One command** (web + Tor, hardened & amnesic) — from the repo root:

```bash
docker compose up -d
# → open http://localhost:8088
```

Two containers, no host networking, no manual flags, Tor on by default.
`docker compose down` leaves no residue.

<details><summary>Other options</summary>

```bash
# Full stack — adds the memory-safe Rust proxy sidecar:
docker compose -f deploy/docker-compose.yml up -d --build

# Web image alone (bring your own Tor SOCKS at TOR_PROXY):
docker build -t securityos .
docker run -d -p 8088:3000 -e TOR_PROXY=socks5h://tor:9050 securityos
```
</details>

See [`CHANGELOG.md`](CHANGELOG.md) for what's new, and [`docs/`](docs) for
[`TOR.md`](docs/TOR.md), [`LIVE-ISO.md`](docs/LIVE-ISO.md),
[`GUIX-SETUP.md`](docs/GUIX-SETUP.md), and [`deploy/SECURITY-HEADERS.md`](deploy/SECURITY-HEADERS.md).

---

## 🧱 Architecture

| Layer | What |
|---|---|
| **Frontend** | Next.js + TypeScript + styled-components (the desktop, apps, virtual filesystem) |
| **Privacy proxy** | `pages/api/proxy.ts` — server-side Tor fetch, SSRF guard, header allowlist, HTML rewriting |
| **Matrix proxy** | same-origin Tor tunnel to `matrix.securityops.co` for the E2EE Matrix client (matrix-js-sdk + Rust crypto/WASM) |
| **Rust sidecar** | `sidecar/` — memory-safe equivalent of the proxy fetch/rewrite path |
| **Crypto** | `wasm/vaptvupt/` → `public/Program Files/Vaptvupt/vaptvupt.js` (the WASM engine) |
| **Emulation** | v86 (x86 Linux), BoxedWine, js-dos, Ruffle — all WebAssembly |
| **Deploy** | `Dockerfile` + `deploy/` (compose, Tor image, nginx/Caddy, VM bootstrap, TAILS CI) |

---

## ⚠️ Disclaimer & liability

SecurityOS is built by **one person**, Cristian Cezar Moisés, to **improve
privacy worldwide** and help people be **safer online** — and for the author's own
use. It is **for lawful, authorized use only**.

- **Use it ethically and legally.** The bundled tools (Tor Browser, Matrix chat,
  Vaptvupt encryption, network utilities) are for securing your *own* systems,
  **authorized** research/testing with explicit permission, lawful privacy, and
  CTF/labs.
- **You are solely responsible** for what you do with it. **The project and its
  sole maintainer are NOT responsible or liable for any misuse, illegal,
  unauthorized, or harmful use.**
- **No warranty.** Provided *"as is"*, without warranty of any kind; to the
  maximum extent permitted by law the author is **not liable** for any damages
  arising from its use. Tor reduces but does not eliminate deanonymization risk.

Full terms: [`docs/TERMS.md`](docs/TERMS.md) (also on the SecurityOS desktop as
`terms.md`), and [`LICENSE`](LICENSE).

## 🤝 Contributing & license

SecurityOS is an **independent, one-person project** — built and maintained solely
by **Cristian Cezar Moisés** (no team, no company). Issues and patches are welcome.

Licensing is **per component**:

- **SecurityOS (the desktop / OS itself)** — **MIT**. It's a fork of
  [daedalOS](https://github.com/DustinBrett/daedalOS) by Dustin Brett, also MIT, so
  [`LICENSE`](LICENSE) carries both copyrights (Cristian Cezar Moisés for SecurityOS,
  Dustin Brett for daedalOS).
- **Vaptvupt** (the encryption tool, and its **`.zupt`** encrypted-file format /
  engine) — **dual-licensed: GNU AGPL-3.0-or-later *or* a separate Commercial
  license, at your option**. The AGPL's network-use clause (§13) means that if you
  run a *modified* Vaptvupt as a network service, you must offer its users the
  corresponding source; a commercial license is the alternative for proprietary or
  closed-source use. Full terms are in
  [`LICENSE-VAPTVUPT.md`](LICENSE-VAPTVUPT.md), with the AGPL text in
  [`LICENSES/AGPL-3.0.txt`](LICENSES/AGPL-3.0.txt).

> **Naming:** *Vaptvupt* is the tool; *`.zupt`* is **only** its encrypted-file
> format / extension — never a name for the tool itself.

Upstream and bundled third-party components keep their own licenses — see source
headers and `THIRD-PARTY-NOTICES`. For a one-page summary, see
[`LICENSING.md`](LICENSING.md).

---

## 👨‍💻 Author

**Cristian Cezar Moisés** — sole maintainer & developer · Information Security

[💼 LinkedIn](https://www.linkedin.com/in/cristiancezarmoises) ·
[🐙 GitHub](https://github.com/cristiancmoises) ·
[📦 Codeberg](https://codeberg.org/berkeley) ·
[📺 YouTube](https://www.youtube.com/@securityops) ·
[🌐 Portfolio](https://cristiancezarmoises.com)
