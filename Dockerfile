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
COPY --from=build /SecurityOS/utils/proxyCapability.js ./utils/proxyCapability.js

EXPOSE 3000
# Serve the already-built app (the image's `yarn build` produced .next). Avoids
# the wasteful full rebuild that `yarn start` performs before launching this server
# every container start. -H 0.0.0.0 makes it reachable via the published port.
# Invoke the next binary directly (not via `yarn next`): under the read-only root
# filesystem (deploy/docker-compose) yarn would fail trying to write yarn-error.log.
# Custom server (server.js) = Next's production server + a same-origin WebSocket
# tunnel at /api/ws (for allowlisted embedded-app realtime sockets, including
# Keywave and the SecurityOps IRC client).
# It falls back to serving without the tunnel if the ws module is unavailable, so
# the desktop always boots.
CMD ["node", "server.js"]
