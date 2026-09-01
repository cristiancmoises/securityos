# 🔐 SecurityOS Handbook

Welcome. SecurityOS is a **privacy-first, security-education web desktop**. This
handbook is your starting point — everything here runs in your browser.

## What's new (v2.24)

- **Two explicit browsing modes.** **Tor Browser** supports tabbed navigation of
  `.onion` and public sites over Tor, with per-tab circuit isolation and an opt-in
  JavaScript safety control. **Clearnet Browser** starts at and searches through
  `https://securityops.co`, allows all scripts by default, exposes a native-window
  compatibility action, and stays plainly marked **not anonymous**.
- **One honest route control.** **Zupt**, **GODS EYE**, **SecurityOps IRC**, and
  **Wiki** all provide the same explicit **Tor / Clearnet** selector. Tor fails
  closed through the privacy proxy, but IRC/GODS EYE complex embeds are
  best-effort. Their Clearnet views connect natively to the service origin and are
  visibly direct/not anonymous; Wiki and Zupt use explicit direct server egress.
- **App catalog cleanup.** The Vaptvupt app is now named **Zupt**. **WhatsApp**,
  **Telegram**, **Session**, and **CryptPad** have been completely removed from the
  desktop, Start menu, app catalog, and supported launch paths.
- **Undercover and icons.** Undercover now uses a polished, familiar enterprise
  workspace made entirely from neutral SecurityOS UI and original code-native
  assets. The new and renamed apps have distinct multi-size icons.

## Earlier improvements

- **Matrix sign-in fix.** The post-login "stuck on syncing" was a real proxy bug
  (a dropped trailing slash on `/pushrules/`) — now fixed; sign-in completes.
- **Security hardening.** Closed a WebRTC real-IP leak (scripts mode), made encrypted
  Matrix attachments verify their hash, and tightened the SSRF + Radio-favicon paths.
- **Start-menu search works.** Open the Start menu and type — it finds and launches
  any app or file (it was previously a non-functional placeholder).
- **Matrix fixes:** image/file attachments now display, uploads no longer time out
  over Tor, and the Tor tunnel no longer leaks circuits or duplicates actions. (A
  stuck "Connecting over Tor…" means Tor or the homeserver is unreachable — not a
  bug; start Tor in *Tor Control*.)
- **Radio:** exact country filtering and **only working stations** (offline/non-HTTPS
  ones are filtered out).
- **Zupt:** full key, compression, extraction and verification forms in
  selectable **Tor** or clearly marked **Clearnet** mode, plus a native direct
  fallback. Tor is the default and never falls back to clearnet automatically.

## What's inside

| Area | Where | Notes |
| ---- | ----- | ----- |
| **Start-menu search** | Open Start, then type | Searches every app and file and launches the match — **Enter** opens the top hit. |
| **Security Tools** | Start ▸ *Security Tools* | 10 offline tools (hashing, encoding, JWT, passwords, regex, UUID, CIDR, ciphers, hash-ID, timestamps). No network, ever. |
| **Matrix** | Start ▸ *Matrix* | Full end-to-end-encrypted Matrix chat, every request tunneled over Tor to `matrix.securityops.com.br`. Keys live in memory only (amnesic). See *Private chat* below. |
| **Keywave** | Start ▸ *Keywave* | End-to-end-encrypted chat at `chat.securityops.co`. Tor mode keeps HTTP/Socket.IO in the fail-closed proxy and blocks WebRTC; the explicit clearnet window is the full text/media client and is not anonymous. |
| **Radio** | Start ▸ *Radio* | Internet radio worldwide (radio-browser API) — **exact** country filter (ISO code), genre filter, **only working HTTPS stations** (offline/non-playable ones removed), favorites. |
| **Tor Browser** | Desktop / Start ▸ *Tor Browser* | Tabbed `.onion` and public-site navigation over Tor. JavaScript is off by default; choose NoScript or All only when needed. Some sites can still reject Tor exits or require native browser features. |
| **Clearnet Browser** | Desktop / Start ▸ *Clearnet Browser* | Full tabs, history, bookmarks, stop/reload/home controls, and a native-window fallback for public websites. Starts at and searches `securityops.co`, with **All scripts** enabled. **Direct egress; not anonymous.** |
| **GODS EYE** | Desktop / Start ▸ *GODS EYE* | Best-effort Tor-sandboxed dashboard for `eye.securityops.co`; Clearnet embeds the native service origin for full Cesium compatibility and is not anonymous. |
| **IRC** | Desktop / Start ▸ *IRC* | SecurityOps The Lounge client at `irc.securityops.com.br`; Tor HTTP/Socket.IO is best-effort through the fail-closed proxy, while Clearnet connects natively to the service rather than `/api/ws`. |
| **Wiki** | Desktop / Start ▸ *Wiki* | SecurityOps knowledge base at `wiki.securityops.co` with explicit **Tor / Clearnet** routing. |
| **Zupt** | Start ▸ *Zupt* | First-party compression/encryption tools with selectable **Tor** (default, fail-closed) and **Clearnet** (not anonymous) routes. The ephemeral proxy session supports key generation, uploads and downloads; **Full client · DIRECT** leaves the sandbox. |
| **Cloudmacs** | Start ▸ *Cloudmacs* | A full **Emacs** (Spacemacs) in the browser, with org-mode and eww. Also in *Open with* for text/code. |
| **Screen Capture** | Start ▸ *Screen Capture* | Screen recording + screenshots (mic/system audio, presets) with an optional webcam overlay and effect themes. |
| **Tor Control** | Start ▸ *Tor Control* | Route the emulated Linux VM through Tor. See `TOR.md`. |
| **Curated web tools** | Start ▸ *Security* (folder) | Vetted external references (CyberChef, ATT&CK, GTFOBins, …) opened in the in-OS Browser. |
| **Linux VM** | the V86 app | A real x86 Linux in the browser — see `V86 Linux Toolkit.md`. |
| **Desktop widgets & Lock** | right-click desktop / Start ▸ *Lock* | Draggable widgets (clock, weather, RSS news over Tor, calendar, memory, sticky note); a lock screen with optional PIN + idle auto-lock. |
| **CTF practice** | `CTF Practice.md` | A hands-on, sandboxed exercise + external practice grounds. |

## The 10 offline Security Tools

All run **100% client-side** (Web Crypto / native APIs) — nothing you type
leaves your machine:

- **Hash & HMAC** — SHA-1/256/384/512 + keyed HMAC (hex & base64).
- **Encoder / Decoder** — Base64, Base64URL, Hex, URL, HTML entities (UTF-8 safe).
- **JWT Decoder** — decode header/claims, expiry status, optional HS256 verify.
- **Password & Entropy** — strength/entropy analyzer + CSPRNG generator.
- **Regex Tester** — live matches & capture groups (Unicode-safe).
- **UUID & Random** — v4 UUIDs and CSPRNG bytes (hex/base64/array).
- **CIDR / Subnet** — IPv4 network/broadcast/mask/host-range math.
- **Cipher Playground** — ROT13, Caesar, Atbash, XOR, Morse.
- **Hash Identifier** — guess a hash's algorithm by shape.
- **Timestamp Converter** — Unix ↔ ISO/UTC/local + relative time.

## Private chat, calls & more

- **Matrix** is a full **end-to-end-encrypted** chat client. Unlike the in-OS
  Browser, **every Matrix request is tunneled through Tor** (the same-origin proxy)
  to `matrix.securityops.com.br` — it decrypts encrypted rooms, searches the user
  directory, browses/joins federated rooms, handles invites, and renders
  image/file attachments. Your **keys live in memory only** (amnesic). It
  **pre-warms the Tor circuit when you open it**, so the first login is fast (a cold
  circuit would otherwise take ~15–40s).
- **Keywave** exposes two honest modes: Tor-routed landing/control with WebRTC blocked,
  and a user-selected direct top-level client for full encrypted text/video. The
  upstream client does not currently establish encrypted text without its media
  handshake, so the Tor view does not claim chat support. Direct mode reveals your
  network address to Keywave and its STUN/TURN service.
- **Zupt Web runs remotely.** The Tor route hides your IP from the service, but the
  service still processes uploaded plaintext, passwords, and supplied private keys.
  Use local Vaptvupt/WASM for secrets that must never leave this device. Embedded
  uploads/downloads are capped at 256 MiB; use **Full client · DIRECT** for work that
  exceeds the sandbox compatibility limits.
- **Cloudmacs** is a full **Emacs** (Spacemacs) in the browser — org-mode and eww —
  and it shows up in *Open with* for text/code files.
- **Radio** plays internet radio worldwide; **Webamp** plays the bundled music.
- **Screen Capture** records or screenshots your screen (mic + system audio,
  quality/format/codec presets, a countdown and max-duration) with an optional
  **webcam overlay** and effect themes (Matrix rain, grayscale, sepia, neon, blur,
  background blur).

## Removed applications

**WhatsApp**, **Telegram**, **Session**, and **CryptPad** are not shipped as
SecurityOS applications. Their process entries, shortcuts, dedicated assets, and
supported in-OS launch paths have been removed.

## Make it yours

- **Desktop widgets** (Rainmeter-style) are draggable, toggleable, and remembered:
  a clock, weather, an **RSS news** feed fetched **over Tor**, a calendar, a JS-heap
  memory gauge, and a sticky note.
- The **lock screen** is a frosted overlay with a big clock; set an optional **PIN**
  (salted SHA-256), enable **idle auto-lock**, and it stays locked across reload.
  Lock from the **Start menu**.
- The **taskbar volume** is a true **master volume** — it controls *all* web-OS
  sound, including WebAudio apps like Webamp and the v86 emulator.
- **Undercover mode** applies a polished, familiar enterprise-workspace layout with
  neutral SecurityOS branding and original, code-native visuals. It does not use a
  proprietary operating-system name, logo, trademark, or artwork.
- If old, corrupted saved data would otherwise stop the desktop from starting,
  SecurityOS shows a **recovery screen** (*Try again* / *Reset*) instead of
  reloading forever.

## Privacy model (read this)

Four things can touch the network, and you control each:

1. **The SecurityOS page itself** — anonymize by opening it in the **Tor Browser**
   (ideally via its `.onion`).
2. **Tor Browser** — sends managed browsing through the server-side SOCKS5h proxy
   and fails closed if Tor is unavailable. **Clearnet Browser** is a separate,
   visibly direct/non-anonymous application.
3. **The Linux VM** — has its own network; route it via **Tor Control**.
4. **Selectable service apps** — Zupt, GODS EYE, IRC, and Wiki show their chosen
   Tor or Clearnet route and never switch silently. IRC/GODS EYE Tor views are
   best-effort; their Clearnet views connect natively to the service origin.

SecurityOS ships hardened: a strict Content-Security-Policy, `no-referrer`, a
locked-down Permissions-Policy, and **no silent third-party connections** — the
VM defaults to a local Tor relay and fails closed if its bridge is unavailable;
clearnet remains opt-in. Optional features (server clock, IPFS, APOD wallpaper)
only connect when you enable them.

## A suggested learning path

1. Open **Security Tools** and decode a JWT from <https://jwt.io> sample, hash
   "abc", and generate a strong password.
2. Read **`TOR.md`**; spin up the relay and route the VM through Tor.
3. Do the **`CTF Practice.md`** XSS exercise (safely sandboxed).
4. Boot the **V86** Linux and follow **`V86 Linux Toolkit.md`** to add tooling.
5. Explore the **Security** folder references (ATT&CK, GTFOBins, OWASP).

Stay ethical: only test systems you own or are explicitly authorized to assess.
