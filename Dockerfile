FROM node:26-alpine

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
RUN yarn

# socks-proxy-agent (Tor SOCKS5h for the privacy proxy) is side-installed via npm,
# NOT added to package.json: yarn-classic re-resolves the short-hash git deps
# (browserfs/utif) and dies with "Commit hash required" whenever package.json
# changes. npm adds it without touching the yarn lockfile (keeps `yarn` cached).
RUN npm install --no-save --no-package-lock --no-audit --no-fund socks-proxy-agent@^8.0.4

# Privacy: no Next.js telemetry, ever (build or runtime). Placed after the cached
# dependency layer so toggling it doesn't trigger a full reinstall.
ENV NEXT_TELEMETRY_DISABLED=1

# Then bring in the app source and build.
COPY . .
RUN yarn build

ENV NODE_ENV=production
EXPOSE 3000
# Serve the already-built app (the image's `yarn build` produced .next). Avoids
# the wasteful full rebuild that `yarn start` (next build && next start) ran on
# every container start. -H 0.0.0.0 makes it reachable via the published port.
# Invoke the next binary directly (not via `yarn next`): under the read-only root
# filesystem (deploy/docker-compose) yarn would fail trying to write yarn-error.log.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
