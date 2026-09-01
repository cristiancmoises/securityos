# SecurityOS privacy-proxy sidecar — memory-safe Rust, built static against musl.
#
#   docker build -t securityos-proxy-sidecar sidecar/
# Enabled by setting PROXY_SIDECAR_URL on the web container (see docker-compose).

# ---- build ----------------------------------------------------------------
FROM rust:alpine AS build

# ring (rustls crypto) needs a C toolchain; cc-rs looks for `cc`/`gcc`.
RUN apk add --no-cache build-base musl-dev
ENV CC=gcc

WORKDIR /build
# Cache deps: copy manifests first, then sources.
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked && strip target/release/securityos-proxy

# ---- runtime --------------------------------------------------------------
FROM alpine:latest

# Unprivileged, no shell needed beyond what alpine ships.
RUN adduser -D -H -s /sbin/nologin proxy
USER proxy

COPY --from=build /build/target/release/securityos-proxy /usr/local/bin/securityos-proxy

EXPOSE 8077
ENV PORT=8077
ENTRYPOINT ["/usr/local/bin/securityos-proxy"]
