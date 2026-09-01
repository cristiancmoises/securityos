# 🔐 Welcome to SecurityOS

**A private, Tor-first, security-focused web operating system** — a full desktop
that runs entirely in your browser. No install, no tracking, no logs.

> Double-click any app on the desktop or open the **Start menu**. New here? Read
> the **SecurityOS Handbook** in *Documents*.

---

## ✨ Why SecurityOS

- 🧅 **Tor by default.** The **Tor Browser** app routes every site through Tor
  (SOCKS5h), loads `.onion` services, and runs with **JavaScript off by default**
  ("Safest"). A built-in proxy even unblocks sites that normally refuse to embed.
- 🛡️ **Hardened & audited.** Strict Content-Security-Policy, no `unsafe-eval`,
  locked-down `Permissions-Policy`, `no-referrer`, anti-clickjacking, and a
  privacy proxy with an SSRF guard + response-header allowlist — adversarially
  reviewed.
- 🤫 **No logs, no telemetry.** Nothing you browse or type is recorded. Hitting
  **Shutdown** securely **overwrites your session with random data** before wiping.
- 🔒 **Real encryption, built in.** Encrypt/decrypt files & folders with
  **AES-256-GCM** straight from the **Terminal** (`encrypt <file> <password>`).
- 🧰 **A real toolkit.** The **Security Tools** suite (hashing, HMAC, JWT, encoders,
  password/entropy, regex, CIDR, ciphers, hash-ID, UUID — all offline), a curated
  **Security** launcher, and a real **Linux VM** (v86) you can route through Tor.
- 💬 **Private chat & calls.** **Matrix** is a full end-to-end-encrypted chat
  client with every request tunneled over Tor to `matrix.securityops.co` — it
  decrypts encrypted rooms, joins federated rooms, and keeps your keys **in memory
  only** (amnesic). **SecChat** is end-to-end-encrypted video chat.
- 🟢 **Private messaging.** **Session** stays on the desktop; WhatsApp and Telegram
  remain available from the Start menu. Their official clients need a real window;
  use Tor Browser or Tails for anonymous access.
- 🔎 **Instant search.** Open the **Start menu** and just start typing — it searches
  every app and file and launches the match (Enter opens the top hit).
- 📁 **Encrypted file sharing over Tor.** **VaptVupt** opens the SecurityOps file
  share's `.onion` through the privacy proxy — upload and download files in the
  window (with an *Open in Tor Browser* fallback for script-heavy actions).
- 🔐 **Encrypted office suite, over Tor.** **CryptPad** (`office.securityops.co` —
  docs, sheets, code, drive) runs **inside the OS over Tor**, with real-time
  collaboration carried by a built-in WebSocket tunnel; upload/download in the window.
- 📝 **A real Emacs, in the browser.** **Cloudmacs** runs a full Spacemacs (with
  org-mode, eww, **telega** for Telegram, and **whatsappel** for WhatsApp) — and
  shows up in *Open with* for text/code.
- ⏺️ **Capture your screen.** **Screen Capture** records or screenshots everything
  on screen (countdown, mic + system audio, quality/format presets) with an
  optional **webcam overlay** and fun effect themes (Matrix rain, sepia, blur…).
- 🧩 **Make it yours.** Draggable **desktop widgets** (clock, weather, RSS news over
  Tor, calendar, memory gauge, sticky note), a **lock screen** with an optional PIN
  and idle auto-lock, **internet Radio**, bundled music + the **Webamp** player,
  and an **Undercover mode** that makes the desktop look like Windows 11 for
  blending in.
- 🖥️ **A genuine desktop.** Files, windows, a UNIX-like Terminal (50+ commands),
  editors, media, emulators, and more.

## 🚀 Start here

| Want to… | Open |
| --- | --- |
| Find & launch any app | **Start menu** → start typing |
| Browse anonymously | **Tor Browser** (Start menu) |
| Browse public sites (not anonymous) | **Clearnet Browser** |
| Open the observability dashboard | **GODS EYE** |
| Join SecurityOps IRC over Tor | **IRC** |
| Chat end-to-end encrypted (over Tor) | **Matrix** |
| Message privately | **Session** (desktop) · WhatsApp / Telegram (Start menu) |
| Share files (encrypted, over Tor) | **VaptVupt** |
| Edit docs/sheets (encrypted, over Tor) | **CryptPad** |
| Encrypted video chat | **SecChat** |
| Listen to internet radio | **Radio** |
| Edit code/text in real Emacs | **Cloudmacs** |
| Record your screen | **Screen Capture** |
| Lock the desktop | Start menu → **Lock** |
| Configure Tor / route the Linux VM | **Tor Control** |
| Use offline crypto/encoding tools | **Security Tools** |
| Encrypt a file | **Terminal** → `encrypt myfile.txt <password>` |
| Run real Linux (apt/guix/compilers) | **V86** Linux VM → see *V86 Linux Toolkit* in Documents |
| Learn the system | **SecurityOS Handbook** (Documents) |

---

## 👨‍💻 About the author

**Cristian Cezar Moisés** — Information Security student, builder of privacy &
security tooling.

- 🌐 Portfolio — <https://cristiancezarmoises.com>
- 🐙 GitHub — <https://github.com/cristiancmoises>
- ⑂ Forgejo (projects) — <https://git.securityops.co/cristiancmoises>
- 💼 LinkedIn — <https://www.linkedin.com/in/cristiancezarmoises>
- 📺 YouTube — <https://www.youtube.com/@securityops>
- 🐧 Guix config — <https://codeberg.org/berkeley/guix-config>
- 🔗 Project home — <https://os.securityops.co> · Wiki — <https://wiki.securityops.co>

### Featured projects
- **Evelin** — a post-quantum SSH successor (Rust). `git.securityops.co/cristiancmoises/evelin`
- **Vaptvupt** — VAPT tooling (C). `git.securityops.co/cristiancmoises/vaptvupt`
- **BTP** — `git.securityops.co/cristiancmoises/btp` (open it from the Start menu)

---

*Built on the [daedalOS](https://github.com/DustinBrett/daedalOS) foundation by
Dustin Brett. MIT licensed. Use ethically — only test systems you own or are
authorized to assess.*
