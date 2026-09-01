# 🧅 Tor & Privacy in SecurityOS

SecurityOS integrates Tor across **four independent layers**. They solve
different problems — understand which one you actually need.

| #   | Layer                                 | What it anonymizes                                    | Needs a server? |
| --- | ------------------------------------- | ----------------------------------------------------- | --------------- |
| 1   | **Onion service + privacy hardening** | The SecurityOS site itself (your access to it)        | The web host    |
| 2   | **v86 VM via Tor**                    | The emulated Linux VM's network traffic               | A relay host    |
| 3   | **Tor Control app + relay backend**   | UI + the SOCKS/transparent-proxy plumbing for layer 2 | A relay host    |
| 4   | **Docs / launcher**                   | Nothing — guidance & links                            | No              |

> **Mental model.** SecurityOS runs in _your_ browser. Three different things
> can talk to the network, and Tor is applied to each separately:
>
> - **The page itself** (loading SecurityOS) → anonymized by accessing it over
>   the **Tor Browser / .onion** (layer 1).
> - **Tor Browser app** → uses the server-side SOCKS5h proxy and fails closed if
>   Tor is unavailable.
> - **Clearnet Browser / GODS EYE** → explicit direct mode, visibly **not
>   anonymous**. They never silently replace Tor Browser.
> - **The v86 Linux VM** → has its _own_ network stack that exits through a
>   WebSocket relay. Layers 2–3 route **that** through Tor independently of how
>   you reached the site.

---

## Layer 1 — Onion service + privacy hardening

### Privacy hardening (always on)

SecurityOS ships hardened against silent third-party egress:

- **No auto-connect to any relay.** The v86 VM's network is **off by default**
  (`emulatorRelayUrl: ""`) — no traffic leaves until you opt in via Tor Control.
- The Start-menu logo, jspaint Firebase collaboration, and jspaint CORS proxies
  (which leaked to third parties) were removed/neutered.
- A strict CSP, `Referrer-Policy: no-referrer`, `Permissions-Policy` lockdown,
  and `X-DNS-Prefetch-Control: off` are applied — see
  [`deploy/SECURITY-HEADERS.md`](../deploy/SECURITY-HEADERS.md).
- Other opt-in egress (NTP "server" clock, APOD wallpaper, IPFS gateways)
  only fires when _you_ enable that feature.

### Publishing a .onion mirror

Run SecurityOS as a Tor v3 hidden service so users can reach it without exit
nodes. Using the bundled Tor (see `deploy/tor-relay/torrc`):

1. Serve SecurityOS (e.g. the Node server `next start`, or nginx/Caddy from
   `deploy/`) as a container/service named `securityos-web`.
2. In `deploy/tor-relay/torrc`, uncomment the `HiddenService*` block and point
   `HiddenServicePort 80 securityos-web:3000` at it.
3. Start it and read the address:
   ```sh
   docker compose -f deploy/tor-relay/docker-compose.yml up -d
   docker compose -f deploy/tor-relay/docker-compose.yml exec tor \
     cat /var/lib/tor/securityos/hostname
   ```
4. Because the CSP/headers work on any deploy target (see SECURITY-HEADERS.md),
   the .onion mirror is hardened identically.

**Tip for the .onion:** keep optional direct features disabled for a Tor-only
session. Clearnet Browser and GODS EYE are intentionally direct and display that
fact; do not open them while maintaining a Tor-only posture.

---

## Layers 2 & 3 — Route the v86 Linux VM through Tor

The emulated Linux talks to a **WebSocket relay** that bridges its packets onto
the internet. By default SecurityOS leaves this disabled. To send the VM's
traffic through Tor, run the Tor-routed relay and select **Tor** in the
**Tor Control** app.

### Why a transparent proxy (not plain SOCKS)

This v86 build uses the **legacy Ethernet-frame relay protocol** (`NetworkAdapter`
in `libv86.js`), not the newer per-stream WISP protocol. The relay therefore
receives raw Ethernet frames and must NAT them onto real TCP connections. SOCKS5
operates at the TCP-stream level, so we route the **relay's egress** through Tor
transparently (iptables → Tor `TransPort`/`DNSPort`) rather than handing Tor a
SOCKS connection per stream.

```
v86 guest ──Ethernet frames──▶ [relay] ──TCP (iptables-redirected)──▶ [tor] ──▶ internet
                                                                  DNS ─▶ Tor DNSPort
```

### Run the relay

```sh
cd deploy/tor-relay
docker compose up -d --build
# Relay listens on ws://<host>:8081/  (put TLS in front for wss:// — see ../nginx.conf)
```

See [`deploy/tor-relay/README.md`](../deploy/tor-relay/README.md) for pinning the
relay to a known commit and production hardening.

### Point SecurityOS at it

1. Open **Tor Control** (Start menu → _Tor Control_).
2. Choose **Tor** (uses `ws://127.0.0.1:8081/` by default) — or **Custom** and
   enter `wss://your-host/` if the relay is remote/behind TLS.
3. **Close and reopen the V86 app** (the relay is read at VM boot).

### Verify (from _inside_ the VM)

```sh
curl https://check.torproject.org/api/ip      # → {"IsTor":true,"IP":"<exit node>"}
```

### Limitations (read these)

- **Tor is TCP-only.** The guest's UDP and ICMP (e.g. `ping`) will not work. DNS
  is resolved via Tor's `DNSPort`. The relay's iptables rules **fail closed** —
  non-TCP, non-DNS egress is dropped, so nothing silently bypasses Tor.
- Latency is high and some sites block Tor exit nodes. This is expected.
- The relay sees the guest's plaintext for non-TLS connections (same as any
  router). Use TLS inside the guest. Run the relay only on infra you control.

---

## In-OS Browser privacy proxy (`/api/proxy`)

The in-OS **Tor Browser** and **Clearnet Browser** both render remote pages through
the server-side proxy (`pages/api/proxy.ts`). It exists to solve two problems at
once:

- **"Many sites don't load"** — most sites send `X-Frame-Options`/CSP
  `frame-ancestors` that forbid being embedded in an iframe. The proxy fetches
  the page server-side and serves it back with those headers stripped, so it
  renders in an opaque-origin sandbox.
- **Explicit routing** — Tor Browser uses SOCKS5h and fails closed; Clearnet Browser
  sends `direct=1` to use ordinary server egress and is persistently marked **not
  anonymous**. Neither mode silently falls back to the other.

Tor tabs use independent 128-bit isolation tokens, which become distinct SOCKS
authentication values and therefore distinct Tor circuit pools. The JavaScript
control is independent of routing: **Off** strips scripts, **NoScript** keeps only
first-party/free-compatible scripts, and **All** permits page JavaScript inside the
sandbox.

Hardening: SSRF-guarded (every hop incl. redirects is DNS-resolved and blocked if
it lands on a private/loopback/link-local/metadata/IPv6-mapped address), a strict
response-header allowlist (no attacker caching/CORS/Clear-Site-Data passthrough),
`no-store`, `no-referrer`, and no browser cookies/authorization forwarded. Active
resources, workers, forms and approved WebSockets are forced back through the
concrete SecurityOS origin; WebRTC is blocked.

The sole cookie exception is dedicated **ZUPT Web** mode: for the exact
`https://share.securityops.co` origin, the proxy retains only its Secure, HttpOnly
`csrf_token` in a bounded RAM-only jar keyed by mode + a lowercase 128-bit session.
It rejects Domain cookies and cross-origin redirects and never returns Set-Cookie to
the iframe. This enables ZUPT forms over Tor without making the general proxy a
credentialed browser. ZUPT operations are still server-side—the service receives
uploaded plaintext/passwords/keys—and embedded transfers are capped at 256 MiB.

**Keywave** also has a dedicated exact-origin route. Its HTTP/Socket.IO landing and
control traffic follows one isolation token over Tor, but WebRTC remains blocked.
The current upstream client gates encrypted text on its media handshake, so full
chat/calls require the explicit direct top-level client and are not anonymous.

> **Residual leaks (be honest):** a server-side HTML rewriter cannot catch
> everything. A runtime shim re-routes `fetch`/XHR/`EventSource`/`sendBeacon` and
> approved WebSockets through the proxy, while CSP confines common active-resource
> sinks. Browser behavior and complex applications still evolve, so this is not a
> substitute for a native anonymity browser. For
> **strong** anonymity, browse from the **v86 Linux VM via Tor Control**, or open
> SecurityOS itself in the **Tor Browser**. The proxy is a major usability + base
> privacy win, not a perfect anonymizer.

---

## Layer 4 — Quick reference

- **Anonymize your access to SecurityOS** → open it in the **Tor Browser**, ideally
  via its **.onion** (layer 1).
- **Anonymize the Linux VM** → run the relay + pick **Tor** in Tor Control (layers 2–3).
- **Most private posture** → Tor Browser + .onion, VM relay set to **Tor** (or
  **Disabled** if the VM needs no network), all clearnet features off.

For the security-headers/CSP details that back the privacy hardening, see
[`deploy/SECURITY-HEADERS.md`](../deploy/SECURITY-HEADERS.md).
