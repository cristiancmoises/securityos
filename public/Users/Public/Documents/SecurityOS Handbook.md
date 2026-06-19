# 🔐 SecurityOS Handbook

Welcome. SecurityOS is a **privacy-first, security-education web desktop**. This
handbook is your starting point — everything here runs in your browser.

## What's inside

| Area | Where | Notes |
| ---- | ----- | ----- |
| **Security Tools** | Start ▸ *Security Tools* | 10 offline tools (hashing, encoding, JWT, passwords, regex, UUID, CIDR, ciphers, hash-ID, timestamps). No network, ever. |
| **Matrix** | Start ▸ *Matrix* | Full end-to-end-encrypted Matrix chat, every request tunneled over Tor to `matrix.securityops.co`. Keys live in memory only (amnesic). See *Private chat* below. |
| **SecChat** | Start ▸ *SecChat* | End-to-end-encrypted video chat (`chat.securityops.co`). |
| **Radio** | Start ▸ *Radio* | Internet radio worldwide (radio-browser API) — filter by country/genre, HTTPS streams, favorites. |
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
