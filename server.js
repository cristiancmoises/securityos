// Custom Next.js server that adds a same-origin WebSocket tunnel at /api/ws.
//
// WHY: the HTTP privacy proxy (pages/api/proxy.ts) can fetch+rewrite a site over
// Tor and render it sandboxed, but it CANNOT carry the WebSocket connections that
// real-time web apps (CryptPad's collaborative engine, Telegram/WhatsApp Web) need.
// This tunnel lets an embedded app's `wss://` connect THROUGH SecurityOS — over Tor
// when TOR_PROXY is set (e.g. CryptPad/office.securityops.co), or direct when the
// app blocks Tor exits (the messengers, which already carry a "not over Tor" badge).
//
// SAFETY: everything except the /api/ws upgrade is handled by Next exactly as
// `next start` would. The WS bits are wrapped so that if the `ws`/`socks-proxy-agent`
// modules are missing the server STILL boots and serves the OS (the tunnel is simply
// unavailable) — a WS dependency hiccup must never take the whole desktop down.

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const TOR_PROXY = process.env.TOR_PROXY || "";

// Optional WS deps — load defensively so a missing module can't break boot.
let WebSocketServer;
let WebSocket;
let SocksProxyAgent;
try {
  ({ WebSocketServer, WebSocket } = require("ws"));
  ({ SocksProxyAgent } = require("socks-proxy-agent"));
} catch {
  // Tunnel disabled; the OS still serves over HTTP.
}

let socksAgent;
try {
  socksAgent = TOR_PROXY && SocksProxyAgent ? new SocksProxyAgent(TOR_PROXY) : undefined;
} catch {
  socksAgent = undefined;
}

// Allowlist of hosts the tunnel may reach — the embedded apps' realtime endpoints
// only. This is the WS analogue of the HTTP proxy's SSRF allowlist: it stops the
// tunnel from being abused as an open WebSocket relay to arbitrary/internal hosts.
const WS_ALLOW = [
  /(^|\.)securityops\.co$/i, // office.securityops.co (CryptPad) + first-party
  /(^|\.)whatsapp\.com$/i,
  /(^|\.)whatsapp\.net$/i,
  /(^|\.)telegram\.org$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)web\.telegram\.org$/i,
];

const hostAllowed = (host) => WS_ALLOW.some((re) => re.test(host));

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res, parse(req.url, true));
    });

    if (WebSocketServer && WebSocket) {
      const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });

      server.on("upgrade", (req, clientSocket, head) => {
        let target;
        let direct = false;
        try {
          const reqUrl = new URL(req.url, "http://localhost");

          if (reqUrl.pathname !== "/api/ws") {
            clientSocket.destroy();

            return;
          }

          const raw = reqUrl.searchParams.get("url") || "";
          direct = reqUrl.searchParams.get("direct") === "1";
          const u = new URL(raw);

          if (
            (u.protocol !== "wss:" && u.protocol !== "ws:") ||
            !hostAllowed(u.hostname)
          ) {
            clientSocket.destroy();

            return;
          }
          target = u.toString();
        } catch {
          clientSocket.destroy();

          return;
        }

        wss.handleUpgrade(req, clientSocket, head, (client) => {
          const protocols = (req.headers["sec-websocket-protocol"] || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          let upstream;
          try {
            upstream = new WebSocket(target, protocols, {
              // Tor by default; direct only when the embed opts in (Tor-blocked apps).
              agent: direct ? undefined : socksAgent,
              followRedirects: true,
              handshakeTimeout: 30_000,
              headers: {
                Origin: new URL(target).origin,
                "User-Agent": req.headers["user-agent"] || "",
              },
              maxPayload: 64 * 1024 * 1024,
            });
          } catch {
            try {
              client.close();
            } catch {
              // ignore
            }

            return;
          }

          const queue = [];
          const closeBoth = () => {
            try {
              client.close();
            } catch {
              // ignore
            }
            try {
              upstream.close();
            } catch {
              // ignore
            }
          };

          client.on("message", (data, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) {
              upstream.send(data, { binary: isBinary });
            } else {
              queue.push([data, isBinary]);
            }
          });
          upstream.on("open", () => {
            queue.forEach(([d, b]) => upstream.send(d, { binary: b }));
            queue.length = 0;
          });
          upstream.on("message", (data, isBinary) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(data, { binary: isBinary });
            }
          });
          upstream.on("close", closeBoth);
          upstream.on("error", closeBoth);
          client.on("close", () => {
            try {
              upstream.close();
            } catch {
              // ignore
            }
          });
          client.on("error", closeBoth);
        });
      });
    }

    server.listen(port, hostname, () => {
      // eslint-disable-next-line no-console
      console.log(
        `SecurityOS on http://${hostname}:${port}` +
          (WebSocketServer ? " (WS tunnel: /api/ws)" : " (WS tunnel disabled)")
      );
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("SecurityOS server failed to start:", error);
    process.exit(1);
  });
