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
- 🖥️ **A genuine desktop.** Files, windows, a UNIX-like Terminal (50+ commands),
  editors, media, emulators, and more.

## 🚀 Start here

| Want to… | Open |
| --- | --- |
| Browse anonymously | **Tor Browser** (Start menu) |
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
- 💼 LinkedIn — <https://www.linkedin.com/in/cristian-cezar-mois%C3%A9s>
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
