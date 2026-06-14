# v86 websockproxy relay, with its egress transparently routed through Tor.
#
# websockproxy is the reference WebSocket<->network bridge that speaks v86's
# Ethernet-frame relay protocol (the same one wss://relay.widgetry.org uses).
# We don't modify it — instead the entrypoint forces all of this container's
# TCP/DNS traffic through the `tor` service, so the guest exits over Tor.

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates iptables python3 python3-pip python3-dev \
        build-essential libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

# Build websockproxy. Pin to a commit in production (see README) rather than HEAD.
RUN git clone --depth 1 https://github.com/benjamincburns/websockproxy.git /opt/websockproxy \
    && pip3 install --no-cache-dir --break-system-packages -r /opt/websockproxy/requirements.txt || true

WORKDIR /opt/websockproxy

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
