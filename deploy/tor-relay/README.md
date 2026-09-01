# SecurityOS Tor-routed v86 relay

Runs the v86 WebSocket network relay with its egress forced through Tor, so the
in-browser Linux VM exits over Tor circuits. See the full guide in
[`docs/TOR.md`](../../docs/TOR.md).

## Quick start

```sh
docker compose up -d --build
# Relay: ws://<host>:8081/   →  set this in the SecurityOS "Tor Control" app.
```

## Files

| File                  | Purpose                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`  | `tor` + `relay` services on an isolated bridge network                                                  |
| `torrc`               | Tor `SocksPort`/`TransPort`/`DNSPort` (+ optional `.onion` mirror)                                      |
| `relay/Dockerfile`    | Builds the v86 websockproxy relay                                                                       |
| `relay/entrypoint.sh` | iptables rules: redirect the relay's TCP→Tor TransPort, DNS→DNSPort, **fail closed** on everything else |

## Production hardening

- **Pin the relay.** `relay/Dockerfile` clones `benjamincburns/websockproxy` at
  `HEAD` for convenience. Pin to a reviewed commit (`git checkout <sha>`) and
  review the code — it terminates the guest's TCP connections.
- **Confirm the entrypoint.** websockproxy's launch command varies by version;
  `entrypoint.sh` tries `websockproxy.py` then `relay.py`. Adjust to match the
  commit you pin, then rebuild.
- **TLS.** Browsers on an HTTPS SecurityOS cannot open a `ws://` relay (mixed
  content / CSP). Put a TLS proxy in front (see `../nginx.conf`) and use
  `wss://your-host/` in Tor Control.
- **Verify Tor.** Inside the VM: `curl https://check.torproject.org/api/ip`
  should return `"IsTor":true`.
- **Limits.** Tor is TCP-only — the guest's UDP/ICMP won't work; DNS goes via
  Tor's `DNSPort`. The iptables policy drops anything that would bypass Tor.

## Why transparent proxy and not SOCKS?

This v86 build speaks the legacy Ethernet-frame relay protocol (not WISP), so
the relay NATs raw frames to TCP. We route that TCP through Tor at the network
layer (iptables) rather than per-stream SOCKS. Details in `docs/TOR.md`.
