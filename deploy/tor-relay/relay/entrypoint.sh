#!/usr/bin/env bash
# Transparently route this container's egress through Tor, then start the v86
# WebSocket relay. Every TCP connection the guest opens is redirected to Tor's
# TransPort, and DNS is sent to Tor's DNSPort — so the guest exits over Tor and
# cannot leak its real IP via a direct connection.
set -euo pipefail

TOR_HOST="${TOR_HOST:-tor}"
TOR_TRANS_PORT="${TOR_TRANS_PORT:-9040}"
TOR_DNS_PORT="${TOR_DNS_PORT:-5353}"
RELAY_PORT="${RELAY_PORT:-8081}"

TOR_IP="$(getent hosts "$TOR_HOST" | awk '{print $1; exit}')"
if [ -z "${TOR_IP}" ]; then
  echo "FATAL: cannot resolve Tor host '${TOR_HOST}'" >&2
  exit 1
fi
echo "[relay] Tor at ${TOR_IP} (trans=${TOR_TRANS_PORT} dns=${TOR_DNS_PORT})"

# --- Fail-closed transparent proxy via iptables -----------------------------
# Send all outbound DNS to Tor's DNSPort.
iptables -t nat -A OUTPUT -p udp --dport 53 -j DNAT --to-destination "${TOR_IP}:${TOR_DNS_PORT}"
iptables -t nat -A OUTPUT -p tcp --dport 53 -j DNAT --to-destination "${TOR_IP}:${TOR_DNS_PORT}"

# Allow loopback and the connection to the Tor container itself.
iptables -t nat -A OUTPUT -o lo -j RETURN
iptables -t nat -A OUTPUT -d "${TOR_IP}" -j RETURN

# Redirect every other outbound TCP connection to Tor's TransPort.
iptables -t nat -A OUTPUT -p tcp --syn -j DNAT --to-destination "${TOR_IP}:${TOR_TRANS_PORT}"

# FAIL CLOSED: drop any non-TCP egress (UDP/ICMP) that isn't DNS, so nothing
# bypasses Tor. (Tor is TCP-only; the guest's raw UDP/ICMP will not work.)
iptables -A OUTPUT -d "${TOR_IP}" -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -p tcp -j ACCEPT
iptables -A OUTPUT -p udp --dport "${TOR_DNS_PORT}" -j ACCEPT
iptables -A OUTPUT -j REJECT

echo "[relay] starting websockproxy on :${RELAY_PORT} (egress -> Tor)"
# websockproxy entrypoints vary by version; adjust to match the pinned commit.
# The common forms are below — keep whichever matches your build.
if [ -f ./websockproxy.py ]; then
  exec python3 ./websockproxy.py --port "${RELAY_PORT}"
elif [ -f ./relay.py ]; then
  exec python3 ./relay.py --port "${RELAY_PORT}"
else
  echo "FATAL: websockproxy entrypoint not found; see deploy/tor-relay/README.md" >&2
  exit 1
fi
