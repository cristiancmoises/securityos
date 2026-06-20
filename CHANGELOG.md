# Changelog

All notable changes to **SecurityOS** (the privacy/security‑first web desktop, a
fork of [daedalOS](https://github.com/DustinBrett/daedalOS)). Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [2.14.0] — 2026-06-20

### Matrix — works end-to-end (real bug fixes)
Sign-in, syncing and sending were investigated end-to-end. The login and sync code
paths were verified correct — a persistent "can't sign in / stuck syncing" is an
**infrastructure** condition (Tor not running, or the `matrix.securityops.co`
homeserver unreachable over Tor, or wrong credentials), which the app already
surfaces with an actionable message. Four genuine **code** bugs were found and fixed:

- **Image/file attachments now display.** The SDK builds media URLs with
  `new URL(absolutePath, baseUrl)`, which silently **dropped the `/api/matrix`
  proxy prefix** — so every attachment fetch bypassed the Tor proxy and 404'd.
  Media requests now re-insert the prefix and load over Tor like everything else.
- **Uploads no longer time out over Tor.** `matrix-js-sdk`'s `uploadContent` uses an
  `XMLHttpRequest` with a hard-coded **30 s idle timeout**; the body flushes
  instantly to the same-origin proxy, then the request waits on the slow Tor leg,
  so a healthy upload aborted with *"Timeout"*. Uploads now go through a plain
  `fetch` (no idle timer), reliably over Tor.
- **The Matrix Tor proxy no longer leaks circuits.** When the browser aborts a
  `/sync` long-poll (or the window closes), the proxy now **tears down the upstream
  Tor request** instead of holding the socket/circuit open for up to 90 s — which
  previously accumulated orphaned sockets and degraded Matrix over a session.
- **No more duplicate rooms / uploads / joins.** The proxy retried *all* failed
  requests, including non-idempotent `POST`s the homeserver had **already
  processed** — a slow Tor response on create-room/upload/join could duplicate the
  action. Retries are now gated to idempotent methods (and not-yet-sent bodies).

### Radio — only working stations, exact countries
- **Country filter is now exact.** Picking a country used a fuzzy **name** match
  against stations' inconsistent free-text labels, so results leaked in from the
  wrong place. It now matches the **ISO 3166-1 country code** exactly, so each
  country shows stations actually *from* that country. (Stale name-based prefs from
  older builds are migrated away.)
- **Offline / non-playable stations removed.** The list now keeps only stations
  that actually work here: an **HTTPS** stream (http-only streams can never play on
  an HTTPS page — mixed content is blocked) that **passed the directory's last
  reachability check**, on top of the API's `hidebroken` filter.

### Messengers (WhatsApp · Telegram · Session) — honest Tor guidance
- Each launcher now includes an in-app **"Using … over Tor"** explainer: these
  clients can't run through the in-OS Tor proxy (they need WebSockets it blocks;
  WhatsApp/Telegram also forbid framing; Session has no web client), so the window
  is a **direct** connection. To use them anonymously, run **SecurityOS itself in
  the Tor Browser / Tails** — documented in-app and in the **SecurityOS Handbook**.

### Docs
- **README + in-desktop Handbook** updated: messengers + their Tor trade-off, the
  Radio improvements, and a corrected **VaptVupt** description — it embeds the
  share's **`.onion` over the Tor proxy** (uploads to 256 MiB, downloads stream in
  full, with a **Reload** / **Open in Tor Browser** toolbar), replacing the stale
  "real-origin `share.securityops.co`" wording.

## [2.13.0] — 2026-06-20

### New apps
- **WhatsApp, Telegram & Session** launchers. WhatsApp Web and Telegram Web can't
  be iframed (WhatsApp pins `frame-ancestors`, Telegram sends `X-Frame-Options:
  deny`) and rely on WebSockets the Tor proxy blocks, so each opens its **official
  web client in a real top-level window**, where it's fully functional (chats,
  calls, native uploads/downloads, QR login). **Session has no web client** (it's a
  desktop/mobile app), so its launcher opens the official download page instead. A
  clear **"Direct connection — NOT routed through Tor"** badge makes the privacy
  trade-off explicit. New brand icons + Desktop/Start-Menu shortcuts.

### Fixes
- **Matrix: no more silent "Connecting over Tor…".** On open, the app now does a
  real reachability probe of the Tor SOCKS proxy (`/api/tor-status`) and **bounds
  the circuit warm-up with a timeout** so the state always settles instead of
  hanging. If Tor is configured but **down**, the login screen says so and how to
  fix it (start Tor in Tor Control) and disables sign-in, instead of spinning.
- **Matrix: image drag-and-drop / paste.** Drop image(s)/files onto a chat — or
  paste a screenshot into the composer — to send them (encrypted in E2EE rooms).
- **Radio: dead servers.** Replaced the two hard-coded radio-browser mirrors with a
  resilient rotation over several known-good mirrors that **remembers the first one
  that answers** and times out dead hosts fast.
- **Radio: country filter ignored the selection.** Picking a country (or genre)
  searched the *previous* value because `search()` read stale state set in the same
  event tick. The chosen value is now passed through explicitly. Stream `error`
  events also surface ("This stream is offline or unsupported").
- **VaptVupt: upload & download errors.** The privacy proxy capped generic file
  **downloads at 25 MiB** (anything bigger truncated/failed) — attachments and
  binary/archive content-types now get a **dedicated 256 MiB download budget** (well
  above the 25 MiB HTML cap, below the 512 MiB media budget), so big shared files
  download in full. **Upload cap raised 64 MiB → 256 MiB.** The app also gained a
  toolbar (**Reload**, **Open in Tor Browser**) and an actionable slow-load hint.

### Tor Browser
- **User Bookmarks.** Save the current page (★ toggle), revisit and remove your own
  bookmarks; persisted in localStorage alongside the built-in onion bookmarks.
- Validated the Security Ops extension shim + the three-state NoScript control.

### UI/UX
- **Screen Capture redesign** — a cleaner "capture studio": responsive option grid,
  prominent gradient **Screenshot** / red **Record** actions, a refined recording
  pill and last-capture card, and a roomier default window.

### Hardening
- The privacy proxy now bounds **total in-flight buffered memory** across all
  upstream responses (and excludes redirects + anchors the attachment check), so a
  hostile page referencing many large "download" sub-resources can't OOM the
  container — closing a memory-DoS amplification the larger download budget exposed.
- Matrix swallows stray file drops window-wide (a drop with no room selected could
  otherwise navigate the page and tear down the OS session), and file attachments
  open via a gesture-safe window so the browser's pop-up blocker no longer eats them.

## [2.12.0] — 2026-06-19

### Fixes
- **The desktop could get stuck "blinking" / never finish loading.** Root cause: the
  top-level `ErrorBoundary` reloaded the page on *any* uncaught error with **no
  limit and no fallback UI** — so any component that threw during render/effect
  (typically from **corrupted/stale saved data** in IndexedDB / the session file /
  localStorage) reloaded forever. The boundary now **auto-reloads at most once**,
  then shows a real **recovery screen** ("Try again" / "Reset SecurityOS" — the
  reset clears localStorage + sessionStorage + IndexedDB) instead of looping.
- **Widgets are now wrapped in their own error boundary** so a single misbehaving
  widget can never take down the whole desktop (icons/wallpaper) again — it just
  fails silently and the desktop stays up.
- **Widgets first-run layout actually applies now** — the Clock (top-center) and
  News (top-right) were rendering at their static fallback positions because the
  draggable card kept its initial position and ignored the post-mount responsive
  layout. Cards now render straight from state when not being dragged.

### Docs
- Updated **README.md**, the in-OS **Welcome** (Desktop/README.md) and the
  **SecurityOS Handbook** to cover everything added since: Matrix (E2EE over Tor),
  SecChat, Radio, Cloudmacs (Emacs + telega/whatsappel/org/eww), Screen Capture
  (+ webcam effect themes), desktop Widgets (incl. Calendar + Post-it), the Lock
  screen, master volume, and the new recovery/resilience behavior.

### Boot resilience (from the deep review — these were the *real* causes)
- **A second, independent infinite-reload loop in the filesystem layer.** On a
  corrupt IndexedDB overlay, `writeFile` hit `ENOENT '/'` and called
  `window.location.reload()` **unconditionally** — and `resetStorage` couldn't
  clear the corrupt layer (it skipped the `browserfs` database), so every reload
  hit the same error. Now the reload is **capped** (sessionStorage guard) and
  `resetStorage` deletes the raw `browserfs` IndexedDB when the writable layer is
  unreachable, so a reset actually clears the corruption.
- **FS init now falls back to an in-memory filesystem** if BrowserFS fails to
  initialize the IndexedDB overlay (corrupt persisted layer) — the OS boots
  amnesically instead of with a dead/half-initialized filesystem.
- **The top-level ErrorBoundary now wraps the context providers** (process / FS /
  session), so a render-throw from the layer that restores persisted state shows
  the recovery screen instead of blanking past it.
- **A crashing app window can no longer take down the desktop** — the per-app
  error boundary now wraps the `Window` itself.
- **Hardened against corrupt saved state**: the wallpaper coerces a non-string
  saved value, and restored desktop **icon positions are validated** before being
  used as a React `style` (a malformed entry used to throw during render).

### App robustness (from the deep review)
- Opening a **stale/missing file** from a restored session no longer hangs the
  spinner or shows a blank window in **Marked, TinyMCE, Vim, Terminal, PDF,
  Photos, OpenType, and DevTools** (unhandled promise rejections → graceful
  fallbacks).
- **Radio** tolerates corrupt `localStorage` favorites (validated as an array).
- **ClassiCube** guards `window.CCModule` so a restored window size can't throw
  (it could trip the desktop reload loop).
- **Monaco editor** disposes its Ctrl-S / status-bar subscriptions (leak + dup
  saves); **Webamp** clears its Butterchurn cycle interval on close and guards
  preset selection against empty/exhausted lists.

## [2.11.0] — 2026-06-18

### Fixes
- **Matrix "stuck before login" — root-caused with a headless browser.** Reproduced
  the hang in Chromium: the login form renders fine, but the very first request
  (`POST /login`) lands on a **cold Tor circuit**, which takes 16–40s to build, so
  it looks frozen. (Measured: cold `POST /login` = 16.4s, warm = 1.4s; the proxy and
  E2EE were never the problem.) Fix: the app now **pre-warms the Tor circuit** the
  moment it opens (background `GET /versions`), so by the time you've typed your
  credentials the circuit is built and sign-in is ~1.5s. The login screen shows the
  circuit state (⏳ establishing / ✓ ready / slow) and a "first connection can take
  15–40s" hint, and a wrong password now says **"Invalid username or password"**
  instead of a scary "Connection error".
- **Cloudmacs: `term-cursor` package failed to install + missing folders.** The
  image had **no `git`**, so Spacemacs' built-in `spacemacs-editing-visual` layer
  couldn't clone its one GitHub-recipe package (`term-cursor`) — while the ~215
  MELPA tarball packages installed fine. Added `git` (+ `ca-certificates`, `gnupg`,
  `ripgrep`) to the image, and pre-create the `data/org` + `.telega` folders
  (telega state now persists across restarts).

### New
- **Webcam effects / themes** in Screen Capture — pick a theme for the webcam
  picture-in-picture (and a live preview): **Matrix (digital rain)**, Grayscale,
  Sepia, Neon/Invert, Blur, and a **Background blur** option (best-effort,
  CSP-clean; true segmentation would need a self-hosted model).
- **Widgets: Calendar** (month grid, today highlighted, prev/next) and a **Post-it**
  sticky note (editable, persisted).

### Changed
- **Widgets default layout** — on first start the desktop now shows the **Clock
  centered at top** and **News at top-right** (both visible); other widgets stay
  hidden until toggled. Existing saved layouts are untouched.
- **Removed the CPU widget** (the estimate was noisy/inaccurate).

## [2.10.0] — 2026-06-18

### New
- **Radio** app — listen to internet radio worldwide (radio-browser API), filter
  by country/genre, HTTPS streams, favorites.
- **Desktop widgets** (Rainmeter-style, draggable, toggleable): clock, weather
  (open-meteo, searchable city), JS-heap memory gauge, estimated CPU load, and an
  RSS news feed (fetched over Tor via the proxy).
- **Lock screen** + a **Lock** button in the Start Menu: frosted overlay with a
  big clock over the (blurred) wallpaper, optional PIN (salted SHA-256), idle
  auto-lock; stays locked across reload.
- **Master volume** — the taskbar volume now controls ALL web-OS sound: native
  `<audio>/<video>` plus WebAudio apps (Webamp, the v86 emulator, AudioContext
  games) via per-context master gain nodes, and Webamp's own mixer.

### Cloudmacs
- **TDLib** built into the image (`libtdjson` 1.8.65) + a C toolchain, so Telega
  is fully functional (`M-x telega-server-build`). Telega + **whatsappel** are
  loaded; **Spacemacs** boots with a **SecurityOps ASCII banner** and auto-installs
  everything on first open. Cloudmacs also appears in **"Open with"** for text/code.

### Fixes
- **Screen recorder: Stop now actually stops.** With the webcam picture-in-picture
  the recorder was recording the canvas `captureStream` (untracked) and the stop
  path never called `recorder.stop()` — so it kept going. Now it stops the recorder
  explicitly and tears down the canvas stream.
- **Matrix "Connecting over Tor…" stuck.** Diagnosed: crypto init is fast; the
  initial `/sync` failed on cold/flaky Tor. Added **server-side retry** in the
  matrix proxy so cold circuits succeed on retry (on top of the tight sync filter).
- **Video/VLC player bar icons** — visible again (dark glyphs on the light button
  chrome, instead of theme-light → invisible).
- **Vaptvupt download/upload "Method Not Allowed".** The Tor proxy now forwards
  **POST/multipart** bodies (64 MiB cap) over Tor — SSRF-guarded, cookie-less,
  fail-closed, redirects re-validated — so the share's upload form + downloads work
  through the proxy.

## [2.9.0] — 2026-06-18

### Cloudmacs — Spacemacs + productivity tools
- Cloudmacs now boots **Spacemacs** with productivity layers (org, git/**magit**,
  helm, treemacs, auto-completion, markdown, shell, syntax-checking,
  version-control, multiple-cursors) plus **EWW**, **Org-mode**, **Telega**
  (Telegram; package installed — a live connection also needs `telega-server`
  from TDLib), and **whatsappel** (the user's WhatsApp-in-Emacs package, mounted
  from `~/whatsappel` and put on the load-path; live use needs the wuzapi backend).
- Config persists on the host: Spacemacs in `~/.cloudmacs.d`, dotfile in
  `~/.spacemacs.d/init.el`. Packages install from MELPA on first open.

### Fixes
- **Video/VLC player bar icons** — the control-bar icons sat on a fixed light
  button and used the theme text color (light on light → invisible). Now a fixed
  dark icon, visible in every theme.
- **Matrix stuck on "Connecting over Tor…"** — the initial /sync now uses a tight
  filter (lazy-loaded members, capped timeline, no presence/ephemeral) so it
  finishes fast on a slow circuit, plus a watchdog note if it's still syncing.
- **Vaptvupt not loading** — reverted to the Tor-proxy embed (share.securityops.co
  sends `X-Frame-Options: DENY` / `frame-ancestors 'none'`, so a direct embed is
  refused). Loads reliably; downloads work (sandbox allows them). Native upload
  needs share.securityops.co to permit framing (then it can go direct).

### Screen recording
- Recording countdown, system-audio toggle, webcam PiP position + size, and an
  optional max-duration auto-stop.

## [2.8.0] — 2026-06-18

### Cloudmacs — full Emacs in the browser (replaces Emacs + VSCodium)
- Removed the simulated **Emacs** app and the **VSCodium** app; added
  **Cloudmacs** ([karlicoss/cloudmacs](https://github.com/karlicoss/cloudmacs)) —
  real Emacs served to the browser via **Gotty** (`emacsclient --tty`, session
  persists across reloads).
- Integrated into the all-in-one deploy: a loopback-only `cloudmacs` service in
  `docker-compose.yml` (`karlicoss/cloudmacs:latest`, `127.0.0.1:8090`, runs as
  uid 1000; config persists to `~/.cloudmacs.d`, files to `~/cloudmacs-data`).
  Build context vendored in `deploy/cloudmacs/`. CSP allows the cloudmacs origin.

### Matrix — fix "Connection Error" on connect
- A transient Tor hiccup during the **initial sync** no longer becomes a hard
  "Connection error" that bounces back to the login screen. The session is kept
  and the SDK auto-retries — the status stays "Connecting over Tor…" until the
  first sync completes. (The login path itself was verified working.)

### Vaptvupt — full file functionality
- The file-share app now embeds `share.securityops.co` **directly** (like
  SecChat) instead of the Tor-proxied onion, so native **download and upload**
  work (the HTML-rewriting proxy is GET-only and couldn't forward uploads).

### Screen recording — performance/quality + webcam choice
- Recording **quality presets** (Performance ~720p/2.5 Mbps · Balanced
  ~1080p/6 Mbps · High native/12 Mbps), **codec auto-select** (VP9→VP8→WebM→MP4),
  and a **webcam device picker** for the picture-in-picture overlay.

## [2.7.0] — 2026-06-18

### VSCodium — a real, full VS Code IDE (replaces DevStudio)
- The Monaco-based **DevStudio** is replaced by **VSCodium**: the full VS Code
  (Code-OSS) experience — extensions, integrated terminal, real
  build/test/debug — via a self-hosted **code-server** embedded in-OS (same
  first-party-embed pattern as SecChat/Vaptvupt).
- Added a loopback-only `vscode` service to `docker-compose.yml`
  (`127.0.0.1:8443`, `--auth none`, workspace at `~/vscodium-workspace`); the app
  embeds `http://localhost:8443` locally / `https://code.securityops.co` on a
  server, both allowlisted in CSP `frame-src`/`connect-src`. Shows a "start the
  server" panel with a Retry if it isn't running yet.

### Matrix — fixes the "Failed to construct URL" login error
- The SDK requires an **absolute** base URL; the relative `"/api/matrix"` threw
  *Failed to construct URL*. Now uses `window.location.origin + /api/matrix`
  (still the same-origin Tor proxy) so login/sync work.

### Screen Capture — even more
- **Pause/Resume** recording (timer pauses too), **PNG/JPEG** screenshot format,
  **24/30/60 fps** selector, **auto-open** the result (Photos/VideoPlayer), and a
  **webcam picture-in-picture** overlay for recordings.

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
