# 🔐 SecurityOS Handbook

Welcome. SecurityOS is a **privacy-first, security-education web desktop**. This
handbook is your starting point — everything here runs in your browser.

## What's inside

| Area | Where | Notes |
| ---- | ----- | ----- |
| **Security Tools** | Start ▸ *Security Tools* | 10 offline tools (hashing, encoding, JWT, passwords, regex, UUID, CIDR, ciphers, hash-ID, timestamps). No network, ever. |
| **Tor Control** | Start ▸ *Tor Control* | Route the emulated Linux VM through Tor. See `TOR.md`. |
| **Curated web tools** | Start ▸ *Security* (folder) | Vetted external references (CyberChef, ATT&CK, GTFOBins, …) opened in the in-OS Browser. |
| **Linux VM** | the V86 app | A real x86 Linux in the browser — see `V86 Linux Toolkit.md`. |
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

## Privacy model (read this)

Three things can touch the network, and you control each:

1. **The SecurityOS page itself** — anonymize by opening it in the **Tor Browser**
   (ideally via its `.onion`).
2. **The in-OS Browser app** (and the *Security* folder links) — these use **your
   real browser's connection**. They are only anonymous if (1) is in effect. A web
   page cannot force its own iframes through Tor.
3. **The Linux VM** — has its own network; route it via **Tor Control**.

SecurityOS ships hardened: a strict Content-Security-Policy, `no-referrer`, a
locked-down Permissions-Policy, and **no silent third-party connections** — the
VM's network is off until you opt in, and optional features (server clock, IPFS,
APOD wallpaper, IRC) only connect when you enable them.

## A suggested learning path

1. Open **Security Tools** and decode a JWT from <https://jwt.io> sample, hash
   "abc", and generate a strong password.
2. Read **`TOR.md`**; spin up the relay and route the VM through Tor.
3. Do the **`CTF Practice.md`** XSS exercise (safely sandboxed).
4. Boot the **V86** Linux and follow **`V86 Linux Toolkit.md`** to add tooling.
5. Explore the **Security** folder references (ATT&CK, GTFOBins, OWASP).

Stay ethical: only test systems you own or are explicitly authorized to assess.
