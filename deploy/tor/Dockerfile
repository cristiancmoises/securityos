# Minimal Tor client/daemon for the SecurityOS Tor gateway.
#
# Built from Alpine instead of a prebuilt image so the stack is self-contained and
# needs no external registry auth (ghcr.io/hectorm/tor is auth-gated). Provides
# SOCKS + transparent proxy + DNS per deploy/tor-relay/torrc. Build context = deploy/.
FROM alpine:latest

# netcat (nc -U) is used by the healthcheck below to talk to Tor's control socket.
RUN apk add --no-cache tor netcat-openbsd

COPY tor-relay/torrc /etc/tor/torrc

# Bootstrap-aware healthcheck. Root-owned 0755 so the unprivileged tor user can
# execute it; it only reads the cookie + connects to the control socket (both in
# the tor-owned DataDirectory), so it needs no extra privileges.
COPY tor/healthcheck.sh /usr/local/bin/tor-healthcheck
RUN chmod 0755 /usr/local/bin/tor-healthcheck

USER tor
EXPOSE 9050 9040 5353

# Report healthy only once Tor has actually finished bootstrapping — NOT merely
# once the SOCKS listener opens (Tor opens that at startup, before it can reach
# the network). A plain `nc -z 9050` would flip to healthy on a half-dead Tor and
# make `depends_on: condition: service_healthy` start the proxy/web on a lie. The
# script asks Tor's cookie-authed control socket for status/bootstrap-phase.
# Generous start-period/retries cover a slow first consensus fetch.
HEALTHCHECK --interval=10s --timeout=10s --start-period=60s --retries=30 \
  CMD ["/usr/local/bin/tor-healthcheck"]

ENTRYPOINT ["tor", "-f", "/etc/tor/torrc"]
