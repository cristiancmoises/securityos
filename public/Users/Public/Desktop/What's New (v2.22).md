# 🆕 What's New in SecurityOS v2.22

A new **IRC** app, plus real fixes for Matrix, CryptPad, WhatsApp and Telegram —
grounded in what actually breaks, not guesswork.

---

## 💬 IRC — a real Libera.Chat client, in-OS, over Tor

There's now a first-party **IRC** app (find it on the Desktop or Start menu). It's
a proper client — not an embedded web page:

- Connects to **Libera.Chat** by speaking the IRC protocol over the same-origin
  WebSocket tunnel, **over Tor**. Your real IP is never exposed.
- Channels, private messages, nick list (with op/voice), topics, `/commands`
  (`/join`, `/msg`, `/me`, `/nick`, `/topic`, `/whois`, `/raw`, …), and clickable links.
- **Validates** your nickname and channels before connecting, so a typo gives a clear
  message instead of a silent failure.
- Optional **SASL login** (NickServ account + password) — often required to use
  channels from a Tor exit. Kept **in memory only**.
- **Amnesic**: nick, history and any password are forgotten when you close the window.

> Tip: Libera restricts unregistered users coming from Tor. If you can't join
> channels, register a nick and use the **Registered account (SASL)** fields.

---

## 🔒 Matrix — encrypted attachments now tell you the truth

Text chat and end-to-end encryption already work. The gap was **encrypted image /
file attachments**: on a plain-`http://` LAN address the browser disables the
WebCrypto (`crypto.subtle`) that attachment encryption needs, so sends/opens failed
with a cryptic error.

- Now you get a clear message: *"Encrypted attachments need a secure context — open
  SecurityOS over HTTPS or http://localhost."* Text messages keep working regardless.
- In encrypted rooms on an insecure origin, the 📎 attach button is disabled with an
  explanation **before** you pick a file.
- **The real fix**: open SecurityOS over **HTTPS** or **http://localhost** and
  encrypted attachments work normally.

---

## ⚡ CryptPad — faster, and safer when it can't fully load

- **Compression over Tor**: the privacy proxy now requests gzip/brotli, so CryptPad's
  multi-megabyte code transfers **3–5× fewer bytes** over Tor — the biggest lever on
  the "too slow" problem.
- Static scripts/styles now carry a **browser-cache** header, so a reload doesn't
  re-fetch them all over Tor again.
- **Fail-closed sandbox**: if CryptPad tries to open its own cross-origin sub-frame
  (which the privacy sandbox can't run), that request is now **blocked** instead of
  quietly leaking outside Tor.

> Honest limit: CryptPad's editor relies on a same-origin sandbox frame the privacy
> embed can't provide, so deep editing may still need the **Window** or **Tor Browser**
> button. That's a design boundary, not a bug.

---

## 📱 WhatsApp & Telegram — better odds of actually loading

- **Fresh Tor exit on Reload**: each embed now gets its **own Tor circuit**, and the
  **↻ Reload** button rotates to a **new exit IP**. WhatsApp/Telegram block some Tor
  exits, and before this, reloading kept landing on the *same* blocked exit.
- **Service-worker & cache shims**: these apps used to crash to a blank screen the
  instant they touched a service worker or the Cache API in the privacy sandbox. Those
  now degrade gracefully, so the app can finish booting (e.g. reach the QR / login).

> Honest limit: WhatsApp Web needs a service worker for full messaging and rejects many
> Tor exits, so it may still be partial — use **Window** for the full client, and run
> SecurityOS inside **Tor Browser** to keep that over Tor.

---

Everything above stays **fail-closed over Tor**, in the **opaque-origin sandbox** (no
`allow-same-origin`), behind the same SSRF and WebSocket-host allowlists. These changes
never weaken those guarantees.
