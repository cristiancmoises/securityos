# Vaptvupt — Dual License (AGPL-3.0 **or** Commercial)

**Vaptvupt** is the encryption / decryption tool bundled with SecurityOS. It
produces and reads encrypted files in the **`.zupt`** format. (Note: *Vaptvupt*
is the name of the tool; *`.zupt`* is only the file-format / extension — never a
name for the tool itself.)

Vaptvupt is **dual-licensed**. You may use, copy, modify, and distribute it under
the terms of **either** of the two licenses below, **at your option**:

---

## Option 1 — Open Source: GNU AGPL-3.0-or-later

Vaptvupt is free software under the **GNU Affero General Public License, version 3
or (at your option) any later version**. The full text is in
[`LICENSES/AGPL-3.0.txt`](LICENSES/AGPL-3.0.txt).

Under the AGPL you are free to run, study, share, and modify Vaptvupt, **provided
that**:

- you keep it under the AGPL and preserve the copyright and license notices;
- if you **distribute** Vaptvupt or a derivative, you make the **complete
  corresponding source code** available under the AGPL; and
- crucially, if you let users interact with a modified Vaptvupt **over a network**
  (for example, hosting it as a web service), you must offer **those users** the
  complete corresponding source of your modified version. This network-use clause
  (AGPL §13) is the main reason the AGPL was chosen over the GPL.

If those obligations are acceptable to you, **no permission or payment is
required** — just comply with the AGPL.

## Option 2 — Commercial License

If you **cannot or do not want** to comply with the AGPL — for example you want to:

- embed Vaptvupt in a **proprietary / closed-source** product,
- offer it as a **hosted service without disclosing your source code**, or
- obtain a warranty, indemnity, or written support terms,

then you may instead obtain a **commercial license**, which removes the AGPL’s
copyleft and network-disclosure obligations.

> Commercial licensing contact: **Cristian Cezar Moisés** —
> `ethicalhacker@riseup.net` · <https://os.securityops.co>

---

## Scope

This dual license covers the **Vaptvupt** components only:

- `components/apps/Vaptvupt/` (the encryption app UI)
- `components/apps/VaptvuptGui/` (the GUI front end)
- the `.zupt` format implementation and the Rust crypto **sidecar** under `sidecar/`

The **rest of SecurityOS** (the desktop, apps, and infrastructure forked from
[daedalOS](https://github.com/DustinBrett/daedalOS)) remains under the **MIT
License** — see [`LICENSE`](LICENSE).

**SPDX identifier for Vaptvupt:**
`AGPL-3.0-or-later OR LicenseRef-Vaptvupt-Commercial`

Copyright © 2025 Cristian Cezar Moisés. All rights reserved.
