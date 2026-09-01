# 🔐 Welcome to SecurityOS

**A private, Tor-first, security-focused web operating system** — a full desktop
that runs entirely in your browser. No install and no app telemetry.

> Double-click any app on the desktop or open the **Start menu**. New here? Read
> the **SecurityOS Handbook** in *Documents*.

---

## ✨ Why SecurityOS

- 🧅 **Tor by default.** The **Tor Browser** app routes every site through Tor
  (SOCKS5h), loads `.onion` services, and runs with **JavaScript off by default**
  ("Safest"). Tabs have independent circuits, real stop/reload/home controls, and
  a built-in proxy that can render many sites that normally refuse to embed.
- 🌐 **Full clearnet browsing.** **Clearnet Browser** starts at and searches through
  `securityops.co`, enables all scripts by default, and exposes a clearly marked
  native-window fallback for sites that need capabilities unavailable in the
  SecurityOS sandbox. It is direct and **not anonymous**.
- 🛡️ **Hardened & audited.** Strict Content-Security-Policy, no `unsafe-eval`,
  locked-down `Permissions-Policy`, `no-referrer`, anti-clickjacking, and a
  privacy proxy with an SSRF guard + response-header allowlist — adversarially
  reviewed.
- 🎟️ **Scoped network access.** Sandboxed apps receive short-lived capabilities
  bound to one app, route, isolation session, and script policy. A Tor token cannot
  be reused for direct access or another app. Public operators should still put
  SecurityOS behind authentication and keep capability-bearing URLs out of access
  logs.
- 🤫 **No app telemetry.** SecurityOS does not add browsing-history or analytics
  logging. The hosting provider's reverse-proxy policy is separate. Hitting
  **Shutdown** securely **overwrites your session with random data** before wiping.
- 🔒 **Real encryption, built in.** Encrypt/decrypt files & folders with
  **AES-256-GCM** straight from the **Terminal** (`encrypt <file> <password>`).
- 🧰 **A real toolkit.** The **Security Tools** suite (hashing, HMAC, JWT, encoders,
  password/entropy, regex, CIDR, ciphers, hash-ID, UUID — all offline), a curated
  **Security** launcher, and a real **Linux VM** (v86) you can route through Tor.
- 💬 **Private chat & calls.** **Matrix** is a full end-to-end-encrypted chat
  client with every request tunneled over Tor to `matrix.securityops.com.br` — it
  decrypts encrypted rooms, joins federated rooms, and keeps your keys **in memory
  only** (amnesic). **Keywave** offers a Tor-safe landing/control view and an explicit
  direct full client for end-to-end-encrypted text and video calls.
- 🧹 **Cleaner app catalog.** **WhatsApp**, **Telegram**, **Session**, and
  **CryptPad** have been completely removed. They have no desktop or Start-menu
  launchers and no supported in-OS launch path.
- 🔎 **Instant search.** Open the **Start menu** and just start typing — it searches
  every app and file and launches the match (Enter opens the top hit).
- 📁 **Zupt compression and encryption.** **Zupt** supports key generation,
  uploads and downloads with an explicit **Tor** or **Clearnet** route. Tor is the
  fail-closed default; Clearnet and the native full-client fallback are visibly
  marked as not anonymous. Web operations run on the ZUPT server (which receives
  uploaded plaintext/passwords/keys); use the local Vaptvupt engine for
  on-device-only secrets.
- 👁️ **First-party routed apps.** **GODS EYE**, **IRC**, and **Wiki** display
  `eye.securityops.co`, `irc.securityops.com.br`, and `wiki.securityops.co`. Each
  has the same explicit **Tor / Clearnet** switch as Zupt. IRC/GODS EYE Tor views
  are best-effort; their Clearnet views connect natively to the service origin and
  are direct/not anonymous.
- 📝 **A real Emacs, in the browser.** **Cloudmacs** runs a full Spacemacs (with
  org-mode and eww) — and shows up in *Open with* for text/code.
- ⏺️ **Capture your screen.** **Screen Capture** records or screenshots everything
  on screen (countdown, mic + system audio, quality/format presets) with an
  optional **webcam overlay** and fun effect themes (Matrix rain, sepia, blur…).
- 🧩 **Make it yours.** Draggable **desktop widgets** (clock, weather, RSS news over
  Tor, calendar, memory gauge, sticky note), a **lock screen** with an optional PIN
  and idle auto-lock, **internet Radio**, bundled music + the **Webamp** player,
  and a polished **Undercover mode** with a familiar enterprise-workspace layout,
  neutral SecurityOS branding, and no proprietary names, logos, or artwork.
- 🖥️ **A genuine desktop.** Files, windows, a UNIX-like Terminal (50+ commands),
  editors, media, emulators, and more.

## 🚀 Start here

| Want to… | Open |
| --- | --- |
| Find & launch any app | **Start menu** → start typing |
| Browse anonymously | **Tor Browser** (Start menu) |
| Browse public sites (not anonymous) | **Clearnet Browser** |
| Open the observability dashboard | **GODS EYE** (Tor / Clearnet selector) |
| Join SecurityOps IRC | **IRC** (Tor / Clearnet selector) |
| Read the SecurityOps knowledge base | **Wiki** (Tor / Clearnet selector) |
| Chat end-to-end encrypted (over Tor) | **Matrix** |
| Compress, encrypt or recover files | **Zupt** (Tor / Clearnet selector) |
| Encrypted video chat | **Keywave** (full client is direct, not anonymous) |
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
