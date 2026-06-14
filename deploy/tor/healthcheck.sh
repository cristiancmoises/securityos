#!/bin/sh
# Tor container healthcheck — reports healthy only once Tor has actually finished
# bootstrapping, NOT merely once the SOCKS listener is open.
#
# Tor opens SocksPort/DNSPort/TransPort at startup, before it has fetched a
# consensus or built a single circuit. A plain `nc -z 9050` therefore flips the
# container to "healthy" on a Tor that cannot reach the network at all — and
# `depends_on: condition: service_healthy` then starts the proxy/web on that lie,
# so every request fails closed while Docker believes the stack is fine.
#
# Instead we ask Tor itself, over a local cookie-authenticated control socket
# (unix only, no TCP), for status/bootstrap-phase and require PROGRESS=100 / done.
set -u

SOCK="/var/lib/tor/control.sock"
COOKIE="/var/lib/tor/control_auth_cookie"

# Both appear only after Tor has started and opened its control port.
[ -S "$SOCK" ] || exit 1
[ -r "$COOKIE" ] || exit 1

# AUTHENTICATE wants the 32-byte cookie hex-encoded. od is the only hex tool
# guaranteed in busybox; strip spaces/newlines (and any '*' run marker, which a
# random 32-byte cookie effectively never triggers) to get a clean hex string.
HEX="$(od -An -tx1 "$COOKIE" 2>/dev/null | tr -d ' \n*')"
[ -n "$HEX" ] || exit 1

# Send AUTHENTICATE + GETINFO + QUIT in one shot and read the whole reply.
REPLY="$(printf 'AUTHENTICATE %s\r\nGETINFO status/bootstrap-phase\r\nQUIT\r\n' "$HEX" \
  | nc -U -w 5 "$SOCK" 2>/dev/null)" || exit 1

# Healthy only when bootstrap is complete. Tor reports e.g.
#   250-status/bootstrap-phase=NOTICE BOOTSTRAP PROGRESS=100 TAG=done SUMMARY="Done"
case "$REPLY" in
  *"PROGRESS=100"*|*"TAG=done"*) exit 0 ;;
  *) exit 1 ;;
esac
