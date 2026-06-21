# 🔐 SecurityOS Handbook

Welcome. SecurityOS is a **privacy-first, security-education web desktop**. This
handbook is your starting point — everything here runs in your browser.

## What's new (v2.14 → v2.17)

- **CryptPad** — the encrypted office suite (`office.securityops.co`) now runs
  **inside the OS over Tor**, via a new same-origin **WebSocket tunnel** that also
  lets other real-time apps work through the proxy.
- **Matrix sign-in fix.** The post-login "stuck on syncing" was a real proxy bug
  (a dropped trailing slash on `/pushrules/`) — now fixed; sign-in completes.
- **Security hardening.** Closed a WebRTC real-IP leak (scripts mode), made encrypted
  Matrix attachments verify their hash, and tightened the SSRF + Radio-favicon paths.
- **Start-menu search works.** Open the Start menu and type — it finds and launches
  any app or file (it was previously a non-functional placeholder).
- **WhatsApp, Telegram & Session** launchers (open the official clients in a real
  window) with clear, honest **over-Tor** guidance — see *Messengers & Tor* below.
- **Matrix fixes:** image/file attachments now display, uploads no longer time out
  over Tor, and the Tor tunnel no longer leaks circuits or duplicates actions. (A
  stuck "Connecting over Tor…" means Tor or the homeserver is unreachable — not a
  bug; start Tor in *Tor Control*.)
- **Radio:** exact country filtering and **only working stations** (offline/non-HTTPS
  ones are filtered out).
- **VaptVupt:** clearer file-share window (upload/download over Tor; *Open in Tor
  Browser* for script-heavy actions).

## What's inside

| Area | Where | Notes |
| ---- | ----- | ----- |
| **Start-menu search** | Open Start, then type | Searches every app and file and launches the match — **Enter** opens the top hit. |
| **Security Tools** | Start ▸ *Security Tools* | 10 offline tools (hashing, encoding, JWT, passwords, regex, UUID, CIDR, ciphers, hash-ID, timestamps). No network, ever. |
| **Matrix** | Start ▸ *Matrix* | Full end-to-end-encrypted Matrix chat, every request tunneled over Tor to `matrix.securityops.co`. Keys live in memory only (amnesic). See *Private chat* below. |
| **SecChat** | Start ▸ *SecChat* | End-to-end-encrypted video chat (`chat.securityops.co`). |
| **Radio** | Start ▸ *Radio* | Internet radio worldwide (radio-browser API) — **exact** country filter (ISO code), genre filter, **only working HTTPS stations** (offline/non-playable ones removed), favorites. |
| **WhatsApp / Telegram / Session** | Start ▸ each app | **Launchers** that open the official client in a real top-level window. ⚠ These connect **directly, NOT over Tor** (they need WebSockets the Tor proxy blocks; Session has no web client). To use them over Tor, route your whole browser/device through Tor — see *Messengers & Tor* below. |
| **VaptVupt** | Start ▸ *VaptVupt* | The first-party encrypted file share, embedded **over Tor** (its `.onion` through the privacy proxy). Upload & download files in the window; for advanced/script-heavy actions use **Open in Tor Browser** from its toolbar. |
| **CryptPad** | Start ▸ *CryptPad* | The first-party **encrypted office suite** (`office.securityops.co` — docs, sheets, code, drive), embedded **on its own origin** so its storage + realtime work (the privacy sandbox blocks storage, which is why CryptPad showed a "storage disabled" alert). It's a **direct** connection — run SecurityOS in the Tor Browser for Tor. Toolbar: Reload, **Window**, **Tor Browser**. |
| **Cloudmacs** | Start ▸ *Cloudmacs* | A full **Emacs** (Spacemacs) in the browser, with org-mode, eww, **telega** (Telegram) and **whatsappel** (WhatsApp). Also in *Open with* for text/code. |
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
  to `matrix.securityops.co` — it decrypts encrypted rooms, searches the user
  directory, browses/joins federated rooms, handles invites, and renders
  image/file attachments. Your **keys live in memory only** (amnesic). It
  **pre-warms the Tor circuit when you open it**, so the first login is fast (a cold
  circuit would otherwise take ~15–40s).
- **SecChat** is end-to-end-encrypted video chat.
- **Cloudmacs** is a full **Emacs** (Spacemacs) in the browser — org-mode, eww, and
  even **telega** (Telegram) and **whatsappel** (WhatsApp) — and it shows up in
  *Open with* for text/code files.
- **Radio** plays internet radio worldwide; **Webamp** plays the bundled music.
- **Screen Capture** records or screenshots your screen (mic + system audio,
  quality/format/codec presets, a countdown and max-duration) with an optional
  **webcam overlay** and effect themes (Matrix rain, grayscale, sepia, neon, blur,
  background blur).

## Messengers & Tor (WhatsApp · Telegram · Session)

SecurityOS includes **launchers** for WhatsApp, Telegram and Session. They are
**honest launchers, not embeds** — and here's why:

- **WhatsApp Web** pins `frame-ancestors` and **Telegram Web** sends
  `X-Frame-Options: deny`, so neither can be placed in a SecurityOS window iframe.
- All of them talk over **WebSockets**, which the SecurityOS Tor proxy
  **deliberately blocks** (a raw WebSocket would tunnel straight out and bypass
  Tor). So they cannot run through the in-OS proxy.
- **Session has no web client at all** — it's a desktop/mobile app on the Oxen
  service-node network.

So each app opens its **official client in a real top-level browser window**, where
it is *fully* functional — chats, voice/video calls, native uploads/downloads, QR
login. The window shows a clear **"Direct connection — NOT routed through Tor"**
badge, because that window uses your browser's normal connection.

**To use them over Tor (anonymously):** route your *whole browser or device*
through Tor first, then launch the app:

1. Open **SecurityOS itself in the Tor Browser** (ideally via its `.onion`) — then
   the launched WhatsApp/Telegram window is already over Tor.
2. Or run SecurityOS inside **Tails**, or a system/router configured for
   system-wide Tor.
3. **Session** routes its *own* traffic over its onion network once installed — its
   launcher only opens the official download page (do that step in the Tor Browser
   to stay anonymous).

> A web page cannot force a top-level window it opens onto Tor — only *you* can, by
> putting the browser/OS on Tor. That's the honest trade-off these launchers make
> explicit instead of pretending otherwise.

## Make it yours

- **Desktop widgets** (Rainmeter-style) are draggable, toggleable, and remembered:
  a clock, weather, an **RSS news** feed fetched **over Tor**, a calendar, a JS-heap
  memory gauge, and a sticky note.
- The **lock screen** is a frosted overlay with a big clock; set an optional **PIN**
  (salted SHA-256), enable **idle auto-lock**, and it stays locked across reload.
  Lock from the **Start menu**.
- The **taskbar volume** is a true **master volume** — it controls *all* web-OS
  sound, including WebAudio apps like Webamp and the v86 emulator.
- **Undercover mode** repaints the desktop to look like Windows 11, for blending in.
- If old, corrupted saved data would otherwise stop the desktop from starting,
  SecurityOS shows a **recovery screen** (*Try again* / *Reset*) instead of
  reloading forever.

## Privacy model (read this)

Three things can touch the network, and you control each:

1. **The SecurityOS page itself** — anonymize by opening it in the **Tor Browser**
   (ideally via its `.onion`).
2. **The in-OS Browser app** (and the *Security* folder links) — these use **your
   real browser's connection**. They are only anonymous if (1) is in effect. A web
   page cannot force its own iframes through Tor. (**Matrix** is the exception — it
   routes through the Tor proxy itself.)
3. **The Linux VM** — has its own network; route it via **Tor Control**.
4. **The messenger launchers** (WhatsApp / Telegram / Session) — open a **top-level
   window on your real connection** (they can't go through the Tor proxy; see
   *Messengers & Tor*). Anonymous only if (1) is in effect.

SecurityOS ships hardened: a strict Content-Security-Policy, `no-referrer`, a
locked-down Permissions-Policy, and **no silent third-party connections** — the
VM's network is off until you opt in, and optional features (server clock, IPFS,
APOD wallpaper) only connect when you enable them.

## A suggested learning path

1. Open **Security Tools** and decode a JWT from <https://jwt.io> sample, hash
   "abc", and generate a strong password.
2. Read **`TOR.md`**; spin up the relay and route the VM through Tor.
3. Do the **`CTF Practice.md`** XSS exercise (safely sandboxed).
4. Boot the **V86** Linux and follow **`V86 Linux Toolkit.md`** to add tooling.
5. Explore the **Security** folder references (ATT&CK, GTFOBins, OWASP).

Stay ethical: only test systems you own or are explicitly authorized to assess.
