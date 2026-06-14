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
- **📺 SecTube** — the SecurityOps video frontend, embedded for playback.
- **📁 Vaptvupt file share & SecChat** — first-party SecurityOps apps embedded
  in-OS at their real origin for full usage: **Vaptvupt** opens the file share
  (`share.securityops.co`); **SecChat** is encrypted video chat. (Both require the
  site to allow framing from the SecurityOS origin.)
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
