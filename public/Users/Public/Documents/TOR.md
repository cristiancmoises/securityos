# 🧅 Tor & Privacy in SecurityOS

SecurityOS integrates Tor across **four layers**. They solve different problems.

**Mental model.** SecurityOS runs in *your* browser. Three things can reach the
network, and Tor applies to each separately:

- **The SecurityOS page itself** → anonymized by opening it in the **Tor Browser**
  (ideally via its **.onion**).
- **Tor Browser app** → uses the server-side SOCKS5h privacy proxy and fails closed
  if Tor is unavailable.
- **Clearnet Browser** → deliberately uses direct/non-anonymous access and shows a
  persistent warning.
- **Zupt / GODS EYE / IRC / Wiki** → start in fail-closed Tor mode and offer an
  explicit Clearnet choice. IRC/GODS EYE Tor embeds are best-effort; their
  Clearnet views connect natively to the service origin and are not anonymous.
- **The v86 Linux VM** → has its **own** network that exits through a WebSocket
  relay. The **Tor Control** app routes *that* through Tor, independently.

---

## Privacy hardening (always on)

- **No automatic clearnet relay.** The VM defaults to the local Tor bridge at
  `ws://127.0.0.1:8081/`. If it is unavailable, the VM stays offline; Clearnet
  and Custom relays remain explicit choices in **Tor Control**.
- Strict Content-Security-Policy, `Referrer-Policy: no-referrer`, a locked-down
  `Permissions-Policy`, and DNS-prefetch disabled.
- Removed/neutered silent third-party calls (Start logo, jspaint Firebase
  collaboration & CORS proxies). Other egress (NTP "server" clock, APOD
  wallpaper, IPFS) only fires when you enable that feature.

---

## Route the Linux VM through Tor

The emulated Linux talks to a **WebSocket relay** that bridges its packets to the
internet. The local Tor relay is selected by default and fails closed when the
bridge is unavailable. To make that route operational:

1. Run the Tor-routed relay on a host you control (ships in the repo at
   `deploy/tor-relay/` — `docker compose up -d --build`). It listens on
   `ws://<host>:8081/`.
2. Open **Tor Control** (Start menu → *Tor Control*).
3. Keep the default **Tor** selection (`ws://127.0.0.1:8081/`), or choose
   **Custom** for a remote `wss://your-host/`.
4. **Close and reopen the V86 app** — the relay is read when the VM boots.

### Verify from *inside* the VM

```
curl https://check.torproject.org/api/ip      →   {"IsTor":true, ...}
```

### Limits

Tor is **TCP-only**: the guest's UDP and ICMP (`ping`) won't work; DNS is
resolved through Tor. The relay's firewall **fails closed**, so nothing bypasses
Tor. Expect higher latency, and some sites block Tor exit nodes.

---

## Publish a .onion mirror

Run SecurityOS behind the bundled Tor as a v3 hidden service — see the repo's
`deploy/tor-relay/torrc` (uncomment the `HiddenService` block) and
`deploy/SECURITY-HEADERS.md`. The same hardened headers apply on every deploy
target, so the .onion is protected identically.

---

## Most private posture

Tor Browser + the .onion address, VM relay set to **Tor** (or **Disabled** if the
VM needs no network), selectable service apps kept in **Tor**, and all clearnet
features (IPFS, server clock) turned off. Do not assume best-effort IRC/GODS EYE
Tor embeds provide full native-client functionality.
