# Minimal Tor client/daemon for the SecurityOS Tor gateway.
#
# Built from Alpine instead of a prebuilt image so the stack is self-contained and
# needs no external registry auth (ghcr.io/hectorm/tor is auth-gated). Provides
# SOCKS + transparent proxy + DNS per deploy/tor-relay/torrc. Build context = deploy/.
FROM alpine:latest

# netcat is only used by the healthcheck below to confirm the SOCKS port is up.
RUN apk add --no-cache tor netcat-openbsd

COPY tor-relay/torrc /etc/tor/torrc

USER tor
EXPOSE 9050 9040 5353

# Report healthy once the SOCKS5 port accepts connections, so the web container's
# `depends_on: condition: service_healthy` waits for Tor before starting (this is
# what makes "onions load + Tor enabled by default" reliable). The proxy still
# retries, so a brief bootstrap delay after the port opens is handled gracefully.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=18 \
  CMD nc -z 127.0.0.1 9050 || exit 1

ENTRYPOINT ["tor", "-f", "/etc/tor/torrc"]
