# 🔐 SecurityOS

**SecurityOS** is a privacy- and security-first **web operating system** — a hardened
fork of [daedalOS](https://github.com/DustinBrett/daedalOS) (Next.js + TypeScript).
It runs entirely in the browser and is built for students, researchers, and security
practitioners who want an anonymous, amnesic, self-contained workspace.

🌐 [os.securityops.co](https://os.securityops.co)

---

## ✨ Highlights

- **🧅 Tor Browser (anonymous navigation)** — a server-side privacy proxy routes
  browser requests over Tor (SOCKS5h,
  so `.onion` resolves and clear-net hostnames never leak), with **tabs** and a
  **NoScript-style 3-state JS control** (Off / first-party-only / All). It supports
  full tabbed navigation of `.onion` and clearnet sites; JavaScript is off by
  default. The proxy is SSRF-guarded, fails closed if Tor is
  misconfigured, pins the SSRF-validated IP, forwards only an allowlist of
  response headers, and performs no application-level request logging. See
  [Tor Browser](#-tor-browser).
- **🌐 Clearnet Browser** — a clearly labelled, full tabbed browser for ordinary
  public websites. It starts at and searches through `https://securityops.co`,
  enables all page scripts by default for compatibility, and includes bookmarks
  for the SecurityOps `.com.br` and `.co` services. Direct egress is always marked
  **not anonymous**, and an explicit native-window action covers sites that cannot
  run inside a sandboxed web desktop.
- **👁️ GODS EYE · 💬 SecurityOps IRC · 📚 Wiki** — first-party service apps for
  `eye.securityops.co`, `irc.securityops.com.br`, and `wiki.securityops.co`.
  Each offers an explicit **Tor / Clearnet** route. Tor fails closed through the
  privacy proxy, but these complex sandboxed views remain **best-effort**. IRC and
  GODS EYE use native service-origin iframes in Clearnet mode—direct, visibly not
  anonymous, and outside `/api/ws`; Wiki uses explicit direct server egress.
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
  same-origin Tor proxy** to `matrix.securityops.com.br`. It decrypts E2EE rooms,
  searches the user directory, browses/joins federated rooms, handles invites, and
  renders image/file attachments. It **pre-warms the Tor circuit on open** so the
  first login is fast (cold Tor otherwise makes the first request take 15–40s).
  **Amnesic** — keys live in memory only. See [Matrix](#-matrix).
- **🌊 Keywave** — the first-party encrypted chat/call service at
  `chat.securityops.co`. Its Tor view is deliberately **landing/control only**:
  WebRTC is blocked because ICE would bypass Tor, and the upstream client does not
  yet offer a media-less text handshake. The explicit top-level clearnet client is
  fully functional, but is **direct and not anonymous**.
- **📻 Radio** — listen to internet radio worldwide (radio-browser API). **Exact**
  country filtering (by ISO country code, not a fuzzy name match), genre filter, and
  **only working HTTPS stations** — offline and non-playable (http-only) ones are
  filtered out — plus favorites and resilient mirror failover.
- **📝 Cloudmacs (optional source)** — the full **Emacs** (Spacemacs) and Gotty
  integration remains available for explicitly authorized local deployments via
  the `cloudmacs` Compose profile. Its launcher and shortcuts are excluded from
  normal production images, and it is intentionally not deployed on the
  SecurityOS IONOS VPS.
- **📺 SecTube** — the SecurityOps video frontend, embedded for playback.
- **📁 Zupt web tools** — the renamed first-party compression, encryption,
  extraction and archive-verification service has explicit **Tor** (default,
  fail-closed) and **Clearnet** (direct, not anonymous) modes. The cookie-free
  privacy boundary keeps only ZUPT's Secure, HttpOnly CSRF cookie in a bounded
  server-memory session, enabling multipart forms and downloads without exposing it
  to the iframe. The embedded proxy caps individual uploads/downloads at 256 MiB;
  a clearly labelled **Full client · DIRECT** fallback opens the native site. The
  bundled local Vaptvupt engine and `.zupt` format retain their upstream identity;
  only the SecurityOS application is named **Zupt**.
- **🧹 App catalog cleanup** — **WhatsApp**, **Telegram**, **Session**, and
  **CryptPad** have been completely removed from SecurityOS. They have no desktop or
  Start-menu launchers, process entries, browser bookmarks, or dedicated app routes.
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
- **🪟 Undercover mode** — a polished, familiar enterprise-workspace disguise with
  a centered launcher, productivity layout, neutral branding, and original assets.
  It contains no proprietary operating-system name, logo, trademark, or artwork.
- **🛟 Resilience / recovery** — if corrupted saved data from an old version would
  otherwise stop the desktop from starting, SecurityOS shows a **recovery screen**
  (_Try again_ / _Reset_) instead of reloading forever.
- **🧰 Security Tools** — an offline suite (hashing, encoding, entropy, UUID, …).
- **⌨️ Expanded terminal** — UNIX-style commands plus `curl`/`wget` over Tor, `du`,
  `df`, `tree`, `stat`, and more.
- **🔎 Start-menu search** — open the Start menu and start typing to find **any app
  or file** and launch it (results dropdown with icons; **Enter** opens the top
  hit). Apps are matched by name from the process directory; documents come from the
  file index.
- **🖼️ Custom wallpaper** — set a background from an image URL or a proxied link;
  adjustable fit. **📋 Paste** any file/image from the clipboard straight onto the Desktop.

---

## 🧅 Tor Browser

SecurityOS has two deliberately separate browsers. Use **Tor Browser** for
anonymous browsing; use **Clearnet Browser** only when ordinary, non-anonymous
access is appropriate. The applications do not silently fall back between modes.

- Browser-managed HTTP(S), dynamic fetch/XHR and approved WebSocket requests are
  routed through **Tor** (SOCKS5h, including DNS) via a
  server-side privacy proxy, so `.onion` resolves and your real IP is never
  revealed. Clear-net sites load over Tor too; hostnames never leak to a local
  resolver.
- **Tabbed** — address-bar/bookmark history per tab; Ctrl/⌘- or middle-click a
  link opens it with a fresh tab circuit; `＋` opens a new tab.
- **NoScript-style 3-state JavaScript control** (toolbar): **Off** — _Safest_,
  all JS blocked + `script-src 'none'`; **NoScript** — first-party scripts only,
  third-party stripped server-side by the LibreJS filter; **All** — every script
  runs. Off by default.
- Bookmarks point at the SecurityOps **hidden services**.
- The proxy is SSRF-guarded, **fails closed** if Tor is misconfigured, **pins the
  SSRF-validated IP** (no DNS rebinding), forwards only an allowlist of response
  headers, rewrites links/forms to stay in-app, and performs no application-level
  request logging.

Each sandbox receives a short-lived signed route capability bound to its app
profile, Tor/direct mode, isolation session, and script policy. A Tor capability
cannot authorize direct egress; fixed-app capabilities cannot be reused against
another app/origin; only valid capabilities receive the narrow opaque-origin CORS
response needed for readable fetch/XHR. HTTP and WebSocket concurrency, queues,
payloads, and capability issuance are bounded. This boundary confines browser
code—it is not user authentication. Operators who expose the arbitrary-destination
Browser proxy publicly should add authenticated reverse-proxy access and redact
capability-bearing proxy URLs from access logs.

> **Compatibility.** The Tor Browser supports tabbed navigation and opt-in
> JavaScript, but a site can still reject Tor exits or depend on browser
> features unavailable in an opaque sandbox (such as service workers). Use the
> Linux VM via Tor Control when a destination needs a native browser environment.

## 🌐 Clearnet Browser & routed web apps

The **Clearnet Browser** has the same tab, address-bar history, bookmark and
JavaScript controls as Tor Browser, but uses direct egress (`direct=1`) and is
therefore **not an anonymity tool**. It starts at `https://securityops.co/`, sends
free-text searches to that same origin, and defaults to **All scripts** for normal
site compatibility. A persistent route/script badge makes that boundary visible;
the native-window button is an explicit, direct fallback for applications that need
browser capabilities the sandbox cannot provide. Its bookmarks cover the
SecurityOps `.com.br` and `.co` services.

**GODS EYE**, **SecurityOps IRC**, and **Wiki** share the same deliberate route
selector as Zupt. **Tor** uses the fail-closed proxy, but rendering complex
Socket.IO/Cesium applications inside its opaque sandbox is best-effort. In
**Clearnet**, IRC and GODS EYE load as native cross-origin iframes directly from
their service origins; Wiki instead uses explicit non-Tor SecurityOS server egress.
All direct paths are visibly not anonymous. The explicit **New circuit** action
rotates Tor isolation.

## 💬 SecurityOps IRC

IRC opens the SecurityOps **The Lounge** web client at `irc.securityops.com.br`.
In Tor mode, HTTP and the narrowly allowlisted Socket.IO endpoint are attempted
through the fail-closed proxy and `/api/ws`; this sandboxed client is best-effort.
In Clearnet mode, the iframe loads the native HTTPS origin and its Socket.IO
connection goes directly from the browser to the service—not through `/api/ws`.
Server-side account/history retention is governed by the SecurityOps IRC service,
not by this desktop.

GODS EYE follows the same privacy boundary: its Tor-proxied opaque-sandbox view is
best-effort because Cesium modules and workers may require capabilities the proxy
cannot reproduce. Clearnet mode embeds `https://eye.securityops.co/` natively at
the service origin for full compatibility and is direct/not anonymous.

---

## 💬 Matrix

SecurityOS ships a **full end-to-end-encrypted Matrix client** (matrix-js-sdk with
the **Rust crypto/WASM** stack), wired so that **every request is tunneled through
the same-origin Tor proxy** to the `matrix.securityops.com.br` homeserver — nothing
talks to Matrix off-Tor.

- **E2EE** — decrypts encrypted rooms; keys are **kept in memory only** (amnesic —
  nothing is written to disk).
- **Federation** — search the user directory, browse and join federated rooms, and
  accept/decline invites.
- **Attachments** — renders image and file attachments.
- **Fast first login** — the client **pre-warms the Tor circuit the moment you open
  it**, so login is quick. (A cold Tor circuit otherwise makes the first request
  take ~15–40s.)
- **Truthful, recoverable connection state** — a flaky `/sync` over Tor no longer
  pins the UI on "Connecting over Tor…" after a successful login; it shows
  "Syncing…", gives an honest "couldn't sync after several tries" if the circuit is
  down, and **flips back to "online" on its own** once Tor recovers. The login and
  first-sync phases are time-bounded so a stalled socket can't freeze sign-in.

---

## 🆕 Apps & how they work

- **Removed applications.** **WhatsApp**, **Telegram**, **Session**, and **CryptPad**
  are not part of the SecurityOS app catalog and have no supported launch path.
- **Zupt.** The embedded HTTPS service is selectable between
  fail-closed **Tor** routing and explicit **Clearnet** egress. Both stay inside an
  opaque-origin sandbox; a random per-mode session lets the proxy retain only the
  upstream CSRF cookie in memory so key generation, multipart uploads and downloads
  work. The historical `.onion` currently has no reachable descriptor, so Tor mode
  reaches `share.securityops.co` through Tor instead of silently going direct.
  **Trust boundary:** these web operations run on `share.securityops.co`; that
  service receives uploaded plaintext, passwords, and any supplied private key.
  Use the bundled local Vaptvupt/WASM workflow when those values must stay on-device.
- **GODS EYE · IRC · Wiki.** Each first-party service exposes the same explicit
  **Tor / Clearnet** control and never falls back across that privacy boundary.
  IRC and GODS EYE Tor embeds are best-effort; their Clearnet views are native,
  service-origin connections rather than `/api/ws` proxy sessions.
- **Keywave.** Tor mode renders only the service landing/control surface through an
  isolated, fail-closed HTTP/Socket.IO route. Calls and encrypted text currently
  start only after media permission in the upstream client, while WebRTC cannot be
  carried anonymously over this HTTP/Tor proxy. Use the explicitly marked direct
  top-level client for full chat/calls; it exposes your IP to Keywave/STUN/TURN.
- **Radio (improved).** Internet radio via radio-browser with **exact country**
  selection (ISO code, not a fuzzy name) and **only working stations** shown
  (HTTPS-playable + last-seen-online; offline/non-playable removed), resilient mirror
  failover, genre filter, and favorites. (Streams play direct, not over Tor.)
- **Matrix (fixed).** Full E2EE chat tunneled over Tor; this round fixed attachment
  **display**, **uploads** timing out over Tor, a proxy **circuit leak**, and
  **duplicate** actions on retry. A persistent "Connecting over Tor…" indicates Tor
  or the homeserver is unreachable (start Tor in **Tor Control**), not an app bug.
- **Start-menu search.** Type in the Start menu to find and launch any app or file.

## 🛡️ Security model

- **Strict OS-shell CSP** without `'unsafe-eval'` (WASM uses `'wasm-unsafe-eval'`), `frame-ancestors 'none'`,
  HSTS, COOP, CORP, and a locked-down **Permissions-Policy**.
- **Explicit egress modes:** Tor Browser fails closed through Tor; Clearnet Browser
  is visibly direct; Zupt, GODS EYE, IRC, and Wiki require an explicit Tor/Clearnet
  selection. The v86 VM defaults to a local Tor relay and stays offline if that
  bridge is unavailable; it never falls back to clearnet.
- **Confined proxy apps:** proxied executable resources, forms, workers and realtime
  connections are restricted to the concrete SecurityOS origin. ZUPT's sole cookie
  exception is exact-origin, 128-bit-session scoped, RAM-only and never returned to
  the browser.
- **No persistence by design** — see _Amnesia_ above.
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

The audited Cloudmacs exclusion applies to Dockerfile-built production images:
the build removes its optional static launch assets as well as compiling out its
catalog integration. Raw/non-Docker Next.js builds retain repository assets and
are not the supported IONOS release path. Every production operation uses the
ordered stack: preserved VPS base, immutable
`/root/securityos-runtime/docker-compose.release-<sha>.yml`, then
a root-owned copy of `deploy/ionos-no-cloudmacs.override.yml` installed at
`/root/securityos-runtime/ionos-no-cloudmacs.override.yml` last. That exclusion
is not auto-loaded; omitting it can recreate the retired service.

<details><summary>Other options</summary>

```bash
# Full stack — adds the memory-safe Rust proxy sidecar:
docker compose -f deploy/docker-compose.yml up -d --build

# Optional local Cloudmacs source (not part of the IONOS deployment):
NEXT_PUBLIC_ENABLE_CLOUDMACS=true \
  docker compose --profile cloudmacs up -d --build web cloudmacs

# Web image alone (bring your own Tor SOCKS at TOR_PROXY):
docker build -t securityos .
docker run -d -p 8088:3000 -e TOR_PROXY=socks5h://tor:9050 securityos
```

</details>

See [`CHANGELOG.md`](CHANGELOG.md) for what's new, and [`docs/`](docs) for
[`DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`TOR.md`](docs/TOR.md),
[`LIVE-ISO.md`](docs/LIVE-ISO.md),
[`GUIX-SETUP.md`](docs/GUIX-SETUP.md), and [`deploy/SECURITY-HEADERS.md`](deploy/SECURITY-HEADERS.md).

---

## 🧱 Architecture

| Layer             | What                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Frontend**      | Next.js + TypeScript + styled-components (the desktop, apps, virtual filesystem)                                    |
| **Privacy proxy** | `pages/api/proxy.ts` — server-side Tor fetch, SSRF guard, header allowlist, HTML rewriting                          |
| **Matrix proxy**  | same-origin Tor tunnel to `matrix.securityops.com.br` for the E2EE Matrix client (matrix-js-sdk + Rust crypto/WASM) |
| **Rust sidecar**  | `sidecar/` — memory-safe equivalent of the proxy fetch/rewrite path                                                 |
| **Crypto**        | `wasm/vaptvupt/` → `public/Program Files/Vaptvupt/vaptvupt.js` (the WASM engine)                                    |
| **Emulation**     | v86 (x86 Linux), BoxedWine, js-dos, Ruffle — all WebAssembly                                                        |
| **Deploy**        | `Dockerfile` + `deploy/` (compose, Tor image, nginx/Caddy, VM bootstrap, TAILS CI)                                  |

---

## ⚠️ Disclaimer & liability

SecurityOS is built by **one person**, Cristian Cezar Moisés, to **improve
privacy worldwide** and help people be **safer online** — and for the author's own
use. It is **for lawful, authorized use only**.

- **Use it ethically and legally.** The bundled tools (Tor Browser, Matrix chat,
  Vaptvupt encryption, network utilities) are for securing your _own_ systems,
  **authorized** research/testing with explicit permission, lawful privacy, and
  CTF/labs.
- **You are solely responsible** for what you do with it. **The project and its
  sole maintainer are NOT responsible or liable for any misuse, illegal,
  unauthorized, or harmful use.**
- **No warranty.** Provided _"as is"_, without warranty of any kind; to the
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
  engine) — **dual-licensed: GNU AGPL-3.0-or-later _or_ a separate Commercial
  license, at your option**. The AGPL's network-use clause (§13) means that if you
  run a _modified_ Vaptvupt as a network service, you must offer its users the
  corresponding source; a commercial license is the alternative for proprietary or
  closed-source use. Full terms are in
  [`LICENSE-VAPTVUPT.md`](LICENSE-VAPTVUPT.md), with the AGPL text in
  [`LICENSES/AGPL-3.0.txt`](LICENSES/AGPL-3.0.txt).

> **Naming:** _Vaptvupt_ is the tool; _`.zupt`_ is **only** its encrypted-file
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
