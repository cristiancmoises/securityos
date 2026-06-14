# 🔐 SecurityOS

**SecurityOS** is a privacy- and security-first **web operating system** — a hardened
fork of [daedalOS](https://github.com/DustinBrett/daedalOS) (Next.js + TypeScript).
It runs entirely in the browser and is built for students, researchers, and security
practitioners who want an anonymous, amnesic, self-contained workspace.

🌐 [os.securityops.co](https://os.securityops.co)

---

## ✨ Highlights

- **🧅 Two tabbed browsers, by threat model** — the **Tor Browser** routes every
  request through a server-side privacy proxy over Tor (SOCKS5h, so `.onion`
  resolves and clear-net hostnames never leak), while the **Clearnet Browser**
  opens any site in-app with a **LibreJS-style "good JS only"** filter. Both have
  real **tabs** (per-tab history; Ctrl/⌘- or middle-click for a new tab). The
  proxy is SSRF-guarded, fails closed if Tor is misconfigured, pins the
  SSRF-validated IP, forwards only an allowlist of response headers, rewrites
  links/forms to stay in-app, and logs nothing. See [Browsers](#-browsers).
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

## 🌐 Browsers

SecurityOS ships **two** browsers — pick by threat model. Both are **tabbed**
(per‑tab history; Ctrl/⌘‑ or middle‑click a link to open it in a new tab; `＋`
for a blank tab).

### 🧅 Tor Browser — *anonymity first*
- Every request is routed through **Tor** (SOCKS5h, including DNS), so `.onion`
  resolves and your IP is never revealed.
- **JavaScript is OFF by default** (toolbar toggle) to minimize the
  fingerprint and attack surface — Tor-Browser-"Safest" style.
- Bookmarks point at the SecurityOps **hidden services**. Use it for
  `.onion` sites and any browsing where your IP must stay hidden.

### 🌍 Clearnet Browser — *usability first*
- Opens ordinary `https://` sites **inside** the webOS. Home page and
  default **search engine** are **`securityops.co`**.
- **First-party SecurityOps sites load directly.** `securityops.co` and
  every `*.securityops.co` / `*.securityops.com.br` app is loaded from its
  **real origin** — full JavaScript, cookies, login and WebSockets — because
  these are interactive apps the rewriting proxy would break. (This is the
  fix for *"Couldn't load securityops.co through the privacy proxy"*.)
- **Every other site is fetched through the privacy proxy**, which:
  - strips `X-Frame-Options` / `Content-Security-Policy` so sites that
    normally block embedding still load in-app;
  - **blocks ads & trackers** — requests to known ad/tracking domains
    (a curated **EasyList + EasyPrivacy** subset, see
    [`utils/adblock.ts`](utils/adblock.ts)) are dropped at the network
    level and leftover ad containers are hidden, so you browse **ad-free**;
  - filters JavaScript **LibreJS-style** — first-party + trivial/free-licensed
    scripts run; **third-party / nonfree JS** (trackers, ads, fingerprinting)
    is blocked. The **JS** toolbar button toggles **"Allow all JS"** per page;
  - keeps "new tab" links **inside the app** (no escaping to your host browser).
- The **shield** button switches a third-party page between **proxied**
  (recommended — Tor-strippable, ad-blocked, JS-filtered) and a **direct**
  load (its real origin) for interactive/login sites.
- Typing a `.onion` URL here automatically hands it off to the **Tor
  Browser** (onions require Tor).

> **Note:** the built-in ad blocker is a curated, high-impact subset of
> EasyList/EasyPrivacy maintained in `utils/adblock.ts`; extend that file (or
> point it at a generated list) to broaden coverage. Ad/JS filtering applies to
> **proxied** pages only — first-party sites load direct and unmodified.

> **What loads, and what won't.** The rewriting proxy renders pages **server-side
> in an opaque, no-/limited-JS sandbox**, so it's deliberately *not* a full
> browser. First-party SecurityOps sites (loaded direct) and simple, mostly-static
> sites render cleanly; many arbitrary sites **won't** — they block datacenter/VPN/
> Tor exit IPs (Cloudflare challenges), require JavaScript + login, or break under
> URL rewriting. That's the inherent ceiling of a privacy proxy, not a bug. For
> those: use the **shield** toggle (loads any framable site at its real origin — no
> Tor/adblock), or the **Linux VM via Tor Control** for genuinely full, anonymous
> browsing of arbitrary sites.

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
