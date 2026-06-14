# 🔐 SecurityOS

**SecurityOS** is a privacy- and security-first **web operating system** — a hardened
fork of [daedalOS](https://github.com/DustinBrett/daedalOS) (Next.js + TypeScript).
It runs entirely in the browser and is built for students, researchers, and security
practitioners who want an anonymous, amnesic, self-contained workspace.

🌐 [os.securityops.co](https://os.securityops.co)

---

## ✨ Highlights

- **🧅 Two browsers, by threat model** — the **Tor Browser** routes every request
  through a server-side privacy proxy over Tor (SOCKS5h, so `.onion` resolves and
  clear-net hostnames never leak), while the **Clearnet Browser** opens any site
  in-app with a **LibreJS-style "good JS only"** filter. The proxy is SSRF-guarded,
  forwards only an allowlist of response headers, rewrites links/forms to stay
  in-app, and logs nothing. See [Browsers](#-browsers).
- **🦀 Memory-safe proxy sidecar** — the untrusted fetch + HTML-rewriting path is also
  available as a Rust sidecar (Tor SOCKS5h, DNS-pinned SSRF guard, `lol_html`
  streaming rewriter); the OS delegates to it and transparently falls back to the
  built-in proxy.
- **🔑 Vaptvupt encryption (WebAssembly)** — the real Vaptvupt engine compiled to WASM:
  - **Password mode:** PBKDF2-SHA256 → AES-256-CTR + HMAC-SHA256 (encrypt-then-MAC) → `.zupt`.
  - **Post-quantum public-key mode:** **ML-KEM-768 + X25519 hybrid** — generate a
    keypair, encrypt to a public key, decrypt with the private key.
  - Exposed in the **Vaptvupt app**, the **Terminal** (`vaptvupt`/`encrypt`/`decrypt`),
    and the file-manager right-click menu.
- **🗑️ Secure delete** — right-click any file/folder → overwrite with **random (3-pass)**
  or **zeros**, then delete.
- **🧠 Amnesia** — containers run read-only with RAM-only `tmpfs` (no volumes, no logs);
  the session is overwritten with CSPRNG randomness and wiped on shutdown.
- **💻 Linux VM** — a 32-bit x86 emulator (v86, WASM) that boots lightweight **live ISOs**
  (Alpine, Tiny Core, SliTaz, …) amnesically, routable through Tor.
- **🧅 TAILS** — a launcher with **CI-verified** (OpenPGP signature + SHA-256) downloads,
  auto-updated by the `tails-iso` GitHub/Forgejo action.
- **📺 SecTube** — the SecurityOps video frontend, embedded for playback.
- **🧰 Security Tools** — an offline suite (hashing, encoding, entropy, UUID, …).
- **⌨️ Expanded terminal** — UNIX-style commands plus `curl`/`wget` over Tor, `du`,
  `df`, `tree`, `stat`, and more.
- **🖼️ Custom wallpaper** — set a background from an image URL or a proxied link;
  adjustable fit. **📋 Paste** any file/image from the clipboard straight onto the Desktop.

---

## 🌐 Browsers

SecurityOS ships **two** browsers — pick by threat model:

### 🧅 Tor Browser — *anonymity first*
- Every request is routed through **Tor** (SOCKS5h, including DNS) via the
  default obfs4 bridge, so `.onion` resolves and your IP is never revealed.
- **JavaScript is OFF by default** (toolbar toggle) to minimize the
  fingerprint and attack surface — Tor-Browser-"Safest" style.
- Bookmarks point at the SecurityOps **hidden services**. Use it for
  `.onion` sites and any browsing where your IP must stay hidden.

### 🌍 Clearnet Browser — *usability first*
- Opens ordinary `https://` sites **inside** the webOS. Pages are fetched
  server-side through the privacy proxy, which strips `X-Frame-Options`
  and `Content-Security-Policy` so sites that normally block embedding
  still load. Links that would open a new tab are kept **inside the app**
  (no escaping to your host browser).
- **JavaScript policy — only "good" JS runs.** Scripts are filtered
  **LibreJS-style**: first-party scripts and trivial/free-licensed inline
  scripts are kept, while **third-party / nonfree JavaScript** (trackers,
  ads, fingerprinting) is **blocked**. A site whose JS is free-licensed
  (e.g. our own `*.securityops.co` apps) stays fully usable; commercial
  sites load with their nonfree JS disabled.
  - The **JS** toolbar button toggles **"Allow all JS"** per page when a
    site needs everything to run.
- The **shield** button switches between **proxied** (recommended) and a
  direct load. Keep it **ON** for `*.securityops.co` apps — they send
  `X-Frame-Options` and only embed through the proxy.
- Typing a `.onion` URL here automatically hands it off to the **Tor
  Browser** (onions require Tor).

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

```bash
# Full hardened, amnesic, Tor-routed stack (tor + Rust sidecar + web):
docker compose -f deploy/docker-compose.yml up -d --build
# → http://localhost:8088
```

Or build the web image alone:

```bash
docker build -t securityos .
docker run -d -p 8088:3000 -e TOR_PROXY=socks5h://tor:9050 securityos
```

See [`docs/`](docs) for [`TOR.md`](docs/TOR.md), [`LIVE-ISO.md`](docs/LIVE-ISO.md),
[`GUIX-SETUP.md`](docs/GUIX-SETUP.md), and [`deploy/SECURITY-HEADERS.md`](deploy/SECURITY-HEADERS.md).

---

## 🧱 Architecture

| Layer | What |
|---|---|
| **Frontend** | Next.js + TypeScript + styled-components (the desktop, apps, virtual filesystem) |
| **Privacy proxy** | `pages/api/proxy.ts` — server-side Tor fetch, SSRF guard, header allowlist, HTML rewriting |
| **Rust sidecar** | `sidecar/` — memory-safe equivalent of the proxy fetch/rewrite path |
| **Crypto** | `wasm/vaptvupt/` → `public/Program Files/Vaptvupt/vaptvupt.js` (the WASM engine) |
| **Emulation** | v86 (x86 Linux), BoxedWine, js-dos, Ruffle — all WebAssembly |
| **Deploy** | `Dockerfile` + `deploy/` (compose, Tor image, nginx/Caddy, VM bootstrap, TAILS CI) |

---

## 🤝 Contributing & license

GPL-licensed components (Vaptvupt) and MIT upstream (daedalOS) — see source headers and
`THIRD-PARTY-NOTICES`. Issues and patches welcome.

---

## 👨‍💻 Author

**Cristian Cezar Moisés** — Information Security

[💼 LinkedIn](https://www.linkedin.com/in/cristian-cezar-mois%C3%A9s) ·
[🐙 GitHub](https://github.com/cristiancmoises) ·
[📦 Codeberg](https://codeberg.org/berkeley) ·
[📺 YouTube](https://www.youtube.com/@securityops) ·
[🌐 Portfolio](https://cristiancezarmoises.com)
