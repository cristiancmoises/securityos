# SecurityOS Cloudmacs image.
#
# Two fixes/additions over the upstream karlicoss/cloudmacs image:
#   1) gotty is installed to /root/go/bin (not on PATH, /root not traversable by
#      the unprivileged emacs user) → the container crash-loops with
#      "gotty: No such file or directory". We copy it onto a PATH dir.
#   2) TDLib (libtdjson) is built + installed so Telega is FULLY functional:
#      `M-x telega-server-build` (or telega's auto-build) compiles telega-server
#      against it. Alpine 3.21 has no tdlib package, so we build from source.
# Upstream: https://github.com/karlicoss/cloudmacs (see ./LICENSE).

# ── Stage 1: build TDLib (tdjson) — alpine 3.21 to match the cloudmacs runtime ──
FROM alpine:3.21 AS tdlib
RUN apk add --no-cache git cmake g++ make gperf openssl-dev zlib-dev linux-headers
RUN git clone --depth 1 https://github.com/tdlib/td.git /td
WORKDIR /td/build
# Release build of the full lib + tdjson, installed to /usr/local. -j4 keeps peak
# RAM reasonable (tdlib's C++ units are memory-hungry). This is the slow step
# (~20-40 min the first time); the layer is cached afterwards.
RUN cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local .. \
 && cmake --build . --target install -j4

# ── Stage 2: cloudmacs + gotty fix + TDLib runtime/headers + toolchain ──
FROM karlicoss/cloudmacs:latest
USER root
RUN cp /root/go/bin/gotty /usr/local/bin/gotty \
 && chmod 0755 /usr/local/bin/gotty \
 && gotty --version
# libtdjson + headers from the builder, plus the toolchain + libs so telega can
# build telega-server against TDLib at first use.
COPY --from=tdlib /usr/local/lib/ /usr/local/lib/
COPY --from=tdlib /usr/local/include/td /usr/local/include/td
RUN apk add --no-cache build-base openssl-dev zlib-dev \
 && (ldconfig /usr/local/lib 2>/dev/null || true)
ENV LD_LIBRARY_PATH=/usr/local/lib

# ENTRYPOINT (asEnvUser) and CMD (gotty … emacsclient --tty) are inherited.
