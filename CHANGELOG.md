# Changelog

All notable changes to **SecurityOS** (the privacy/security‑first web desktop, a
fork of [daedalOS](https://github.com/DustinBrett/daedalOS)). Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [2.6.0] — 2026-06-18

### DevStudio — a real in-browser IDE
- New **DevStudio** app: file-tree explorer over the virtual FS, **Monaco** editor
  with tabs (dirty indicator, Ctrl+S save), and a bottom **Output** console.
- **Run / test / debug** that is CSP-clean (no CDN, nothing leaves Tor):
  JavaScript runs in a **sandboxed Web Worker** (blob URL); **TypeScript/JSX**
  is transpiled with the bundled compiler then run; a `test()/assert()` harness
  reports pass/fail; full stack traces stream to the console (step-debug via
  browser devtools). Compiled languages (C/C++/Go/…) hand off to the bundled
  **Linux VM (V86)** / **Terminal**. Ctrl+Enter / F5 to run.

### Matrix — connection hardening
- **Encryption init is now non-fatal**: if E2EE/WASM can't start, you still
  connect (unencrypted rooms work; encrypted show as locked) instead of being
  blocked entirely — with a clear in-app notice.
- **lazyLoadMembers** on initial sync (much smaller/faster first sync over Tor),
  bumped the Matrix proxy timeout to 90s for slow circuits, and surface the
  exact homeserver error text on failure.

### Screen Capture — improvements
- Screenshot **countdown** (Now/3s/5s), **copy to clipboard**, **microphone
  audio** toggle for recordings, a live **recording timer**, and a **last-capture
  preview** thumbnail.

### Desktop fixes
- **Default wallpaper** is now the **SecurityOps logo** (also added to the
  Background menu).
- **Fixed desktop icon overlap on load**: icons stay hidden until the session's
  saved positions are loaded, so they paint already in place instead of
  auto-flowing and then jumping over each other.

## [2.5.0] — 2026-06-17

### Matrix — a full, end-to-end-encrypted client
- **Real E2EE via matrix-js-sdk + Rust crypto (WASM).** Encrypted rooms now
  **decrypt and display** — fixes the previous "can't see my messages" (the old
  hand-rolled client silently dropped every `m.room.encrypted` event). All traffic
  still goes only through the same-origin `/api/matrix` **Tor** proxy.
- **Search people** (user directory) and start **encrypted DMs**; **Discover &
  join** federated rooms (public room directory + join by alias/`!id`); **accept
  or decline invites**.
- **Image & file visualization**, including **encrypted attachments** (fetched
  with the auth token and decrypted client-side via WebCrypto AES-CTR), plus image
  upload. Crypto keys are kept **in memory only** (amnesic).

### Emacs — Spacemacs experience
- Spacemacs-dark theme + **Powerline** mode-line + header-line buffer tabs;
  many more commands & keybindings (M-y kill-ring, query-replace, case ops,
  recenter, comment-line, M-x completion); **SPC leader + which-key** popup.
- **Org-mode** behaviors (headline folding, TODO cycling, sibling headlines,
  agenda) and **simulated Telega + whatsappel** panels (offline). `.org`/`.el`
  now open in Emacs.

### Tor Browser — faster & safer
- **Keep-alive socket pooling** to Tor (big latency win, isolation preserved),
  **async + size-bounded decompression** (fixes event-loop stalls and gzip
  bombs), **lazy-loaded images**, in-memory caching of immutable sub-resources,
  and a strict CSP on non-HTML responses.

### Desktop
- **Taskbar Volume control** (click slider, scroll to change, mute) wired to a
  persisted global media volume.
- **Screen Capture** app (+ taskbar/desktop/Start-menu entries): screenshot →
  Pictures, screen recording → Desktop, via `getDisplayMedia` (captures app
  iframes too).
- **Wallpapers:** restored the animated set (Matrix 2D/3D, Vanta Waves, Hexells)
  and surfaced the themed library in the Background menu (Emacs, Guix, Matrix,
  Christ, Security, Hacking, Anonymity, Nature, Technology, Forensics, Gentoo) +
  new **BSD / Unix / Space / Art** themes.
- **Music:** expanded the public-domain (CC0) Bach *Goldberg Variations* set.
- **Desktop folders** Documents / Images / Music, and **`dev.md`** + **`terms.md`**
  on the desktop (maintainer info + usage rules & liability).

### Undercover (Windows 11 disguise)
- Win11 Fluent light tokens, generic (trademark-free) folder/app display names,
  and a stacked clock — toggles cleanly back to the SecurityOS theme.

### Docs
- README **Disclaimer & liability** section and `docs/TERMS.md` — SecurityOS is
  for lawful, authorized use only; the sole maintainer is not responsible for
  misuse; no warranty.

## [2026-06-14]

### Tor Browser — tabbed browsing
- **Tabs in the Tor Browser.** Tab strip with a
  `＋` new‑tab button and per‑tab close; tabs stay mounted so scroll/state is
  preserved on switch. Per‑tab history (back/forward), address bar and bookmarks
  act on the active tab. Tab labels show the page **title** (reported by the
  in‑page shim) with a clean hostname fallback.
- **Open in current vs. new tab**, like a normal browser: plain click → current
  tab; **Ctrl/⌘‑click or middle‑click → new tab**; pop‑ups (`window.open`) → new
  tab. Done via the in‑page proxy shim posting a validated `__sosNewTab` message
  (each browser only accepts its own `/api/proxy` URLs). In the Tor Browser's
  default no‑JS *Safest* mode the sandbox forbids scripts, so links open in the
  current tab and new tabs come from `＋`.
- **UI/UX polish:** larger, clearer toolbar buttons (no longer clipped into a
  fixed box) with proper hover/disabled states, an address bar that flexes to
  fill, and a readable tab strip with an active‑tab accent.

### Apps
- **Vaptvupt** now opens the SecurityOps **file share** (`share.securityops.co`)
  as a direct first‑party embed (real origin, cookies, full usage) — login,
  upload, manage and download shares. (Requires the site to allow framing from
  the SecurityOS origin.) File **encryption** is unchanged and still available
  via the Terminal (`vaptvupt`/`encrypt`/`decrypt`) and the file‑manager
  right‑click menu.

### Removed
- **The Clearnet Browser app is removed** — SecurityOS is **Tor-only**: all web
  access goes through the Tor Browser. `.html` files now open in the text editors
  (view source); http links / the Run dialog open the Tor Browser.

### Tor Browser
- Start page + address‑bar search point at the verified live darknet search
  hidden service; bookmarks are the operator's `.onion` services.
- **NoScript-style 3-state JavaScript control** (toolbar): **Off** — *Safest*,
  all JS blocked + `script-src 'none'`; **NoScript** — first-party scripts only,
  third-party stripped server-side by the LibreJS filter; **All** — every script
  runs. Off by default; the iframe drops `allow-scripts` in Off mode.

### Privacy proxy & security hardening
- **Mode‑aware CSP**: strict same‑origin CSP in no‑JS (anonymity) mode; minimal
  CSP in JS mode so ordinary sites render (fixes "refused to connect" on embeds
  and lazy‑loaded images).
- **Accurate error pages**: a down `.onion` now reads *"this .onion looks
  offline (Tor is working)"* instead of blaming Tor; only a genuine SOCKS‑hop
  failure reports *"Tor is unreachable."*
- **On‑page search forms work**: GET forms are rewritten to carry the target +
  mode flags as hidden inputs (a GET submit no longer drops the proxied URL).
- **SSRF / anonymity (security audit fixes):** the SSRF guard and Tor routing
  are gated on the live SOCKS agent (a broken `TOR_PROXY` can no longer skip the
  guard or silently connect direct — it **fails closed**); the SSRF‑validated IP
  is **pinned** through to the socket (no DNS rebinding); a **cumulative byte
  budget** spans redirect hops; the URL rewriter covers unquoted attributes and
  `background/cite/manifest/usemap/longdesc`; origin is pinnable via
  `SECURITYOS_ORIGIN`.
- **Tor healthcheck** verifies real bootstrap (`status/bootstrap-phase`), not
  just an open SOCKS port.

### Deploy
- **One command:** `docker compose up -d` (web + Tor, hardened & amnesic) → open
  `http://localhost:8088`. The full stack with the memory‑safe Rust proxy
  sidecar remains at `deploy/docker-compose.yml`.

## Earlier
- Full English UI, Tor active by default, SecurityOS branding, in‑OS Browser /
  Tor Browser, SecChat, SecTube, Vaptvupt (WASM) file encryption, SecTools,
  v86 Linux VM, security‑headers hardening, and the Tor‑routed deployment.
- Initial fork from daedalOS.
