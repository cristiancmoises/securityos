// @ts-check

const isProduction = process.env.NODE_ENV === "production";

const bundleAnalyzer = process.env.npm_config_argv?.includes(
  "build:bundle-analyzer"
);

const webpack = require("webpack");

const { securityHeaders } = require("./scripts/securityHeaders");

/**
 * @type {import("next").NextConfig}
 * */
const nextConfig = {
  // NOTE: headers() are applied by the Node server (`next start`, the Dockerfile
  // default). A pure `next export` to a static host ignores them — that path is
  // covered by public/_headers, the <meta> CSP in pages/_document.tsx, and the
  // sample reverse-proxy configs under deploy/. See deploy/SECURITY-HEADERS.md.
  async headers() {
    // Apply the strict headers to everything EXCEPT /api/proxy. The privacy proxy
    // must NOT inherit X-Frame-Options/frame-ancestors (the OS itself frames it) or
    // our strict CSP (it would break the proxied page's own resources). Proxied
    // content is isolated by the opaque-origin sandbox in the Browser app instead,
    // and the proxy route sets its own minimal headers (no-store, no-referrer).
    return [{ headers: securityHeaders, source: "/((?!api/proxy).*)" }];
  },
  compiler: {
    reactRemoveProperties: isProduction,
    removeConsole: isProduction,
    styledComponents: {
      displayName: !isProduction,
      minify: isProduction,
      pure: true,
    },
  },
  // NOTE: `legacyBrowsers`/`swcFileReading`/`optimizeFonts`/`swcMinify` were
  // removed — they are Next 12-era keys that Next 16 rejects (the repo was bumped
  // to Next 16 by Dependabot without updating this config).
  //
  // Next 16 no longer runs ESLint during builds; lint via `yarn eslint` in CI.
  // TypeScript validation remains enabled and is part of the production build.
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Do NOT auto-redirect "/path/" -> "/path". The Matrix homeserver REQUIRES the
  // trailing slash on some endpoints (e.g. GET /_matrix/client/v3/pushrules/); the
  // default 308 redirect stripped it before our /api/matrix proxy could forward it,
  // which 404'd at Synapse and hung the client on "syncing". With this off, the
  // proxy receives the exact path (the handler reconstructs the slash from req.url).
  skipTrailingSlashRedirect: true,
  webpack: (config) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
        const mod = resource.request.replace(/^node:/, "");

        switch (mod) {
          case "buffer":
            resource.request = "buffer";
            break;
          case "stream":
            resource.request = "readable-stream";
            break;
          default:
            // Strip the `node:` prefix and pass through. Server-only code (e.g. the
            // privacy proxy's socks-proxy-agent) legitimately imports node:net/tls/
            // dns; webpack externalizes those server-side. (Previously this threw.)
            resource.request = mod;
        }
      })
    );

    // `playlist-parser` (used by the Webamp app) hard-requires the deprecated
    // `xmldom`, which isn't in the dependency tree — webpack can't resolve it and
    // fails the build. Resolve it to an empty module so the build succeeds; only
    // XML playlist formats (XSPF/WPL) in Webamp degrade — M3U/PLS still work. For
    // full support, add `@xmldom/xmldom` and alias `xmldom` to it instead.
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...config.resolve.alias, xmldom: false };

    // matrix-js-sdk's Rust crypto (@matrix-org/matrix-sdk-crypto-wasm) ships a
    // .wasm; let webpack emit it as a same-origin async chunk under /_next/static
    // (instantiated via WebAssembly.instantiate — permitted by our
    // 'wasm-unsafe-eval' CSP). Keeping it same-origin means the crypto never
    // leaves Tor and never hits a CDN. Mirrors the other in-browser WASM apps.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    return config;
  },
};

module.exports = bundleAnalyzer
  ? require("@next/bundle-analyzer")({
      enabled: isProduction,
    })(nextConfig)
  : nextConfig;
