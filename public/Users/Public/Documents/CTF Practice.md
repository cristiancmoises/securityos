# 🚩 CTF Practice

Hands-on security practice — start with the bundled, fully-sandboxed lab, then
move to live practice grounds. **Only ever test systems you own or are explicitly
authorized to assess.**

## Included exercise: DOM XSS Lab

Open **`XSS Lab.html`** from this Documents folder (it opens in the in-OS
Browser). It is deliberately vulnerable **for learning only**, and it runs inside
the Browser's hardened `srcDoc` sandbox (no `allow-same-origin`), so it executes
in an opaque origin and **cannot affect SecurityOS** — practice freely.

### Challenge
Make a JavaScript `alert()` fire using the input box.

### Walkthrough (try first, then peek)
<details><summary>Hint</summary>
The input is written to the page with <code>innerHTML</code>. Inline
<code>&lt;script&gt;</code> tags don't execute when set via innerHTML, but
element event handlers do.
</details>

<details><summary>Solution</summary>
Enter: <code>&lt;img src=x onerror=alert(1)&gt;</code> — the broken image fires
its <code>onerror</code> handler. <code>&lt;svg onload=alert(1)&gt;</code> works too.
</details>

### The fix (defensive lesson)
The bug is assigning untrusted input to `innerHTML`. Remediate by either:
- Using **`textContent`** — it renders text and never parses markup, or
- **Sanitizing** with `DOMPurify.sanitize(value)` before `innerHTML`.

This is exactly the class of bug SecurityOS itself fixed in its `.whtml`
thumbnail renderer — see the project's security notes.

## Practice grounds (external, intentionally vulnerable / legal to attack)

These are designed for you to attack legally:

- **PortSwigger Web Security Academy** — <https://portswigger.net/web-security> (free, best-in-class web labs)
- **OWASP Juice Shop** — <https://owasp.org/www-project-juice-shop/> (run locally)
- **TryHackMe** — <https://tryhackme.com/> · **Hack The Box** — <https://www.hackthebox.com/>
- **picoCTF** — <https://picoctf.org/> (beginner-friendly CTF)
- **OverTheWire (Bandit)** — <https://overthewire.org/wargames/bandit/> (Linux/SSH basics)
- **CTFtime** — <https://ctftime.org/> (upcoming competitions & writeups)
- **XSS Game (Google)** — <https://xss-game.appspot.com/>

Open any of these from Start ▸ *Security* or paste the URL into the Browser.

## Using SecurityOS tools during a CTF

- **Encoder / Decoder** + **CyberChef** — decode base64/hex/URL blobs, magic-detect.
- **Hash Identifier** + **Hash & HMAC** — fingerprint and reproduce hashes.
- **JWT Decoder** — inspect/forge-test tokens (try the HS256 `none`/weak-secret pitfalls).
- **Cipher Playground** — ROT/Caesar/XOR/Atbash for classic-crypto challenges.
- **Linux VM (V86)** — a real Linux for binary/forensics work; route it via **Tor Control** if needed.

Document your steps, respect scope, and report responsibly.
