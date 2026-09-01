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
> - **Clearnet Browser** → explicit direct mode, visibly **not anonymous**. It
>   never silently replaces Tor Browser.
> - **Zupt / GODS EYE / IRC / Wiki** → an explicit switch selects fail-closed Tor
>   or visibly direct Clearnet for each app session. Complex IRC/GODS EYE Tor
>   embeds are best-effort; their Clearnet views connect natively to the service.
> - **The v86 Linux VM** → has its _own_ network stack that exits through a
>   WebSocket relay. Layers 2–3 route **that** through Tor independently of how
>   you reached the site.

---

## Layer 1 — Onion service + privacy hardening

### Privacy hardening (always on)

SecurityOS ships hardened against silent third-party egress:

- **No automatic clearnet relay.** The v86 VM defaults to the local Tor bridge
  (`ws://127.0.0.1:8081/`). If that bridge is unavailable, networking fails
  closed; Clearnet and Custom relays remain explicit choices in Tor Control.
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

1. Serve SecurityOS (e.g. the custom Node server `node server.js`, or nginx/Caddy from
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
session. Do not use Clearnet Browser, and keep Zupt, GODS EYE, IRC, and Wiki in
their **Tor** mode while maintaining a Tor-only posture.

---

## Layers 2 & 3 — Route the v86 Linux VM through Tor

The emulated Linux talks to a **WebSocket relay** that bridges its packets onto
the internet. SecurityOS selects the local Tor relay by default. Run the bundled
Tor-routed bridge before the VM needs network access; if it is unavailable, the
guest stays offline and never falls back to clearnet. Use **Tor Control** to
confirm the selection or explicitly choose Disabled, Clearnet, or Custom.

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
2. **Tor** is selected by default (`ws://127.0.0.1:8081/`). Keep it selected, or
   choose **Custom** and enter `wss://your-host/` for a remote/TLS relay.
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
sandbox. Tor starts at **Off**. Clearnet starts at **All** for compatibility, uses
`https://securityops.co/` as both home and search origin, and offers an explicit
native-window action for sites that cannot operate in the sandbox. That action is
direct and never appears in Tor Browser.

Hardening: SSRF-guarded (every hop incl. redirects is DNS-resolved and blocked if
it lands on a private/loopback/link-local/metadata/IPv6-mapped address), a strict
response-header allowlist (no attacker caching/CORS/Clear-Site-Data passthrough),
`no-store`, `no-referrer`, and no browser cookies/authorization forwarded. Active
resources, workers, forms and approved WebSockets are forced back through the
concrete SecurityOS origin; WebRTC is blocked.

Opaque frames receive a short-lived server-signed capability from the top-level
desktop. The signature binds the app profile, Tor/direct route, isolation token,
and script policy; changing any one of those values fails with 403. Fixed apps are
also restricted to their exact SecurityOps origin, while the general Browser
profile remains user-directed. Only a valid scoped capability receives the narrow
`Access-Control-Allow-Origin: null` response needed for sandboxed fetch/XHR, and
preflights terminate locally. HTTP and WebSocket concurrency, queues, payloads,
and capability issuance are bounded.

This is a browser-confinement boundary, not visitor authentication. A public
deployment that exposes the arbitrary-destination Browser proxy should put
SecurityOS behind an authenticated reverse proxy and suppress/redact access logs
for `/api/proxy`, `/api/ws`, and their short-lived capability query values.

The sole cookie exception is dedicated **ZUPT Web** mode: for the exact
`https://share.securityops.co` origin, the proxy retains only its Secure, HttpOnly
`csrf_token` in a bounded RAM-only jar keyed by mode + a lowercase 128-bit session.
It rejects Domain cookies and cross-origin redirects and never returns Set-Cookie to
the iframe. This enables ZUPT forms over Tor without making the general proxy a
credentialed browser. ZUPT operations are still server-side—the service receives
uploaded plaintext/passwords/keys—and embedded transfers are capped at 256 MiB.

### Routed first-party apps

**Zupt**, **GODS EYE**, **SecurityOps IRC**, and **Wiki** share one route model:

- **Tor** appends no direct override, uses an isolated token, and fails closed if
  SOCKS5h is unavailable. The IRC Socket.IO connection is attempted through the
  narrowly allowlisted `/api/ws` tunnel, but IRC and GODS EYE remain best-effort in
  an opaque sandbox; Cesium workers and other advanced runtime behavior may fail.
- **Clearnet** displays **DIRECT · NOT ANONYMOUS** and never claims Tor protection.
  Zupt and Wiki request ordinary SecurityOS server egress with `direct=1`. IRC and
  GODS EYE instead use native cross-origin iframes: their HTTP, Socket.IO, modules,
  and workers connect directly to the live service origin, not through `/api/ws`.
- Proxy routes keep separate in-memory isolation tokens. Switching reloads the
  selected origin without silently crossing the privacy boundary, and **New
  circuit** rotates Tor explicitly.

These apps target `share.securityops.co`, `eye.securityops.co`,
`irc.securityops.com.br`, and `wiki.securityops.co`, respectively. Same-origin and
sandbox restrictions still apply; a first-party service can reject Tor exits or
require native browser capabilities that a web desktop cannot safely emulate.
For IRC and GODS EYE, choose the explicitly direct Clearnet/native client when full
The Lounge or Cesium behavior is required and exposing the browser connection is
acceptable.

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
