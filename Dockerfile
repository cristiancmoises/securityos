FROM node:26-alpine AS build

RUN apk add --no-cache git

# node:26-alpine no longer bundles yarn (it shipped with node:16-alpine before the
# node 16->26 bump). Install yarn classic explicitly so `RUN yarn` works.
RUN npm install -g yarn@1.22.22

# A git-pinned dep (utif) builds with webpack 4 in its install `prepare` script,
# which throws ERR_OSSL_EVP_UNSUPPORTED under node 26's OpenSSL 3. Enable the
# legacy provider so that prepare step (and any other legacy crypto) succeeds.
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR SecurityOS

# Install dependencies as their own cached layer FIRST, so editing source no
# longer triggers a full reinstall (the git-pinned utif/browserfs deps build via
# webpack during install, which is slow). Only package.json/yarn.lock changes do.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

# Side-installed (via npm, NOT package.json) deps, ALL IN ONE npm install:
#   - socks-proxy-agent: Tor SOCKS5h for the privacy + Matrix proxies.
#   - matrix-js-sdk + its Rust crypto WASM: the E2EE Matrix chat app (decrypts
#     encrypted rooms, search/join/invites/media).
# Why npm + --no-save: yarn-classic re-resolves the short-hash git deps
# (browserfs/utif) and dies with "Commit hash required" whenever package.json
# changes; npm adds these without touching the yarn lockfile (keeps `yarn` cached).
# Why ONE command: `npm install` prunes packages it considers extraneous (those
# not in package.json and not requested in THIS invocation), so installing matrix
# in a SEPARATE step would prune socks-proxy-agent. Keep them together.
# NODE_OPTIONS=--openssl-legacy-provider (set above) lets the git deps' webpack-4
# install step run under node's OpenSSL 3.
RUN npm install --no-save --no-package-lock --no-audit --no-fund \
    socks-proxy-agent@8.0.5 \
    ws@8.21.3 \
    matrix-js-sdk@41.7.0 \
    @matrix-org/matrix-sdk-crypto-wasm@18.3.1

# Privacy: no Next.js telemetry, ever (build or runtime). Placed after the cached
# dependency layer so toggling it doesn't trigger a full reinstall.
ENV NEXT_TELEMETRY_DISABLED=1

# Then bring in the app source and build.
COPY . .
RUN yarn build

# Keep build tooling, source files and the Next build cache out of the deployable
# image. Runtime still receives the complete tested dependency tree because the
# custom WebSocket server and API routes use packages that Next cannot all trace.
RUN rm -rf /SecurityOS/.next/cache

FROM node:26-alpine AS runtime

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--openssl-legacy-provider

ENV NODE_ENV=production

WORKDIR /SecurityOS

COPY --from=build /SecurityOS/.next ./.next
COPY --from=build /SecurityOS/node_modules ./node_modules
COPY --from=build /SecurityOS/public ./public
COPY --from=build /SecurityOS/next.config.js ./next.config.js
COPY --from=build /SecurityOS/package.json ./package.json
COPY --from=build /SecurityOS/scripts/securityHeaders.js ./scripts/securityHeaders.js
COPY --from=build /SecurityOS/server.js ./server.js

EXPOSE 3000
# Serve the already-built app (the image's `yarn build` produced .next). Avoids
# the wasteful full rebuild that `yarn start` (next build && next start) ran on
# every container start. -H 0.0.0.0 makes it reachable via the published port.
# Invoke the next binary directly (not via `yarn next`): under the read-only root
# filesystem (deploy/docker-compose) yarn would fail trying to write yarn-error.log.
# Custom server (server.js) = Next's production server + a same-origin WebSocket
# tunnel at /api/ws (for allowlisted embedded-app realtime sockets, including
# Keywave and the SecurityOps IRC client).
# It falls back to serving without the tunnel if the ws module is unavailable, so
# the desktop always boots.
CMD ["node", "server.js"]
