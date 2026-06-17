# Licensing

SecurityOS is an **independent, one-person project** — built and maintained solely
by **Cristian Cezar Moisés** (no team, no company).

Licensing is **per component**. There is no single license for the whole project;
which terms apply depends on *which part* you're using.

## At a glance

| Component | License | Canonical file |
|---|---|---|
| **SecurityOS** — the desktop / OS itself | **MIT** | [`LICENSE`](LICENSE) |
| **Vaptvupt** — the encryption tool & its **`.zupt`** format / engine | **GNU AGPL-3.0-or-later *or* Commercial** (your option) | [`LICENSE-VAPTVUPT.md`](LICENSE-VAPTVUPT.md) |

## SecurityOS (the OS) — MIT

The desktop, apps, and infrastructure are released under the **MIT License**.
SecurityOS is a fork of [daedalOS](https://github.com/DustinBrett/daedalOS) by
Dustin Brett, which is also MIT — so [`LICENSE`](LICENSE) carries both copyrights
(Cristian Cezar Moisés for SecurityOS, Dustin Brett for daedalOS).

## Vaptvupt (and `.zupt`) — AGPL-3.0-or-later **or** Commercial

**Vaptvupt** — the bundled encryption / decryption tool, and the **`.zupt`**
encrypted-file format / engine it implements — is **dual-licensed**. You may use it
under **either** of the following, **at your option**:

- **GNU AGPL-3.0-or-later** — free software. You may run, study, share, and modify
  Vaptvupt, provided you keep it under the AGPL, preserve the notices, and release
  the corresponding source of anything you distribute. Its **network-use clause
  (§13)** also means that if you run a *modified* Vaptvupt as a **network service**,
  you must offer **that service's users** the complete corresponding source of your
  modified version. The full text is in [`LICENSES/AGPL-3.0.txt`](LICENSES/AGPL-3.0.txt).
- **Commercial license** — the alternative when the AGPL's copyleft and
  network-disclosure obligations don't fit, e.g. embedding Vaptvupt in a proprietary
  / closed-source product or hosting it without disclosing your source. Contact
  **Cristian Cezar Moisés** — `ethicalhacker@riseup.net`.

Full terms, scope, and the SPDX identifier
(`AGPL-3.0-or-later OR LicenseRef-Vaptvupt-Commercial`) are in
[`LICENSE-VAPTVUPT.md`](LICENSE-VAPTVUPT.md).

> **Naming:** *Vaptvupt* is the **tool**; *`.zupt`* is **only** its encrypted-file
> format / extension — never a name for the tool itself.

## Third-party components

Upstream and bundled third-party code keeps its own licenses — see the relevant
source headers and `THIRD-PARTY-NOTICES`.
