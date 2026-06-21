# 🆕 What's New in SecurityOS v2.21

This update fixes the four apps that weren't loading and makes their status
**honest** — so you can tell the difference between "still working on it" and
"this won't work, use the full client."

---

## 💬 Matrix — no more "stuck on Connecting over Tor…"

If Matrix used to hang forever on **"Connecting over Tor…"** even though your
password was correct, that's fixed.

- After you sign in, a flaky Tor moment can't pin the screen on *Connecting*
  anymore — it shows **"Syncing over Tor…"** (the truth: you're already logged in).
- If the Tor circuit is genuinely down, after a few tries you get a clear
  **"Couldn't sync over Tor after several tries"** instead of an endless spinner —
  and it keeps retrying in the background, so it **reconnects on its own** the moment
  Tor comes back. No need to restart the app.
- Sign-in itself is time-bounded, so a stalled connection can't freeze the login
  screen — you get a *try again* message instead.

> 💡 If you ever see the connection warning, open **Tor Control** to check Tor is
> running, then sign in again. The circuit is pre-warmed, so the retry is fast.

---

## 🔐 CryptPad · 🟢 WhatsApp · ✈️ Telegram — they actually load now

These run **inside the OS, over Tor** (so they work even on networks that block
them, and your IP is never exposed). They were loading **blank** in the real
deployment because the production proxy's fast Rust path was skipping the small
runtime "shim" these apps need to run in the sandbox.

- They now load with the **full runtime shim** (in-memory storage, an amnesic
  **IndexedDB** stand-in, and the realtime **WebSocket tunnel**) always present.
- **CryptPad** collaboration sockets are tunneled over Tor again.

### ⚠️ Honest limits — please read

The in-OS embed is **best-effort**. Because of browser security rules for sandboxed
pages, these heavy apps **cannot** fully work in-OS:

- **No offline mode / Service Workers**, and the storage is **amnesic** — it is
  wiped on reload. Don't rely on the embed to keep messages, drafts, or documents.
- Some services **block Tor exit IPs**, and WhatsApp's calls/multi-device crypto
  need features the sandbox can't provide.

✅ **For real, persistent use, click the `⧉ Window` button** in the app's toolbar —
it opens the full official client. Run SecurityOS inside the **Tor Browser** to keep
that over Tor too.

---

## 🔒 Safety

The whole change went through a multi-agent **adversarial security + correctness
review**. The sandbox isolation is unchanged — embedded third-party pages still
**cannot** touch the SecurityOS origin. Tor stays **fail-closed** (it never silently
falls back to a direct connection).

*Questions? See the **SecurityOS Handbook** and **TOR.md** in your Documents folder.*
