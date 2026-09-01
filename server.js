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
const KEYWAVE_CLEARNET_HOST = "chat.securityops.co";
const MAX_WS_ISO_AGENTS = 256;
const MAX_WS_QUEUE_BYTES = 8 * 1024 * 1024;
const MAX_WS_QUEUE_MESSAGES = 256;

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
  socksAgent =
    TOR_PROXY && SocksProxyAgent ? new SocksProxyAgent(TOR_PROXY) : undefined;
} catch {
  socksAgent = undefined;
}
const wsIsoAgents = new Map();

const sanitizeIsoToken = (raw) =>
  typeof raw === "string" && /^[\da-f]{32}$/.test(raw) ? raw : "";

const agentForIso = (iso) => {
  if (!iso || !socksAgent || !SocksProxyAgent) return socksAgent;

  const cached = wsIsoAgents.get(iso);

  if (cached) {
    wsIsoAgents.delete(iso);
    wsIsoAgents.set(iso, cached);

    return cached;
  }

  try {
    const proxyUrl = new URL(TOR_PROXY);

    proxyUrl.username = iso;
    proxyUrl.password = iso;

    const agent = new SocksProxyAgent(proxyUrl.href);

    wsIsoAgents.set(iso, agent);
    if (wsIsoAgents.size > MAX_WS_ISO_AGENTS) {
      const oldest = wsIsoAgents.keys().next().value;

      if (oldest !== undefined) wsIsoAgents.delete(oldest);
    }

    return agent;
  } catch {
    return socksAgent;
  }
};

// Allowlist of hosts the tunnel may reach — the embedded apps' realtime endpoints
// only. This is the WS analogue of the HTTP proxy's SSRF allowlist: it stops the
// tunnel from being abused as an open WebSocket relay to arbitrary/internal hosts.
const WS_ALLOW = [
  /(^|\.)securityops\.co$/i, // office.securityops.co (CryptPad) + first-party
  // office.securityops.co 301-redirects to the public CryptPad (pad.envs.net), so
  // CryptPad's realtime WebSocket targets that host after the redirect. Anchored
  // suffix match (NOT a loose substring) so it can't match pad.envs.net.evil.com.
  /(^|\.)envs\.net$/i,
  /(^|\.)whatsapp\.com$/i,
  /(^|\.)whatsapp\.net$/i,
  /(^|\.)telegram\.org$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)web\.telegram\.org$/i,
  // The IRC app tunnels IRC-over-WebSocket to Libera.Chat's KiwiIRC gateway
  // (web.libera.chat/webirc/websocket/). Anchored suffix covers web./irc.libera.chat.
  /(^|\.)libera\.chat$/i,
  // First-party IRC-over-WebSocket gateway used by the SecurityOps IRC app.
  /^irc\.securityops\.com\.br$/i,
];

const hostAllowed = (host) => WS_ALLOW.some((re) => re.test(host));

// Keywave only needs Engine.IO v4's WebSocket transport at the canonical
// Socket.IO path. Its direct full client connects to chat.securityops.co itself;
// this same-origin tunnel is Tor-only and must never honor `direct=1`.
const keywaveRouteAllowed = (url, direct) => {
  const host = url.hostname.toLowerCase();

  if (host !== KEYWAVE_CLEARNET_HOST) return true;

  return (
    !direct &&
    url.protocol === "wss:" &&
    url.pathname === "/socket.io/" &&
    url.searchParams.get("EIO") === "4" &&
    url.searchParams.get("transport") === "websocket"
  );
};

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res, parse(req.url, true));
    });

    if (WebSocketServer && WebSocket) {
      const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 64 * 1024 * 1024,
      });

      server.on("upgrade", (req, clientSocket, head) => {
        let target;
        let direct = false;
        let upstreamAgent;
        try {
          const reqUrl = new URL(req.url, "http://localhost");

          if (reqUrl.pathname !== "/api/ws") {
            clientSocket.destroy();

            return;
          }

          const raw = reqUrl.searchParams.get("url") || "";
          direct = reqUrl.searchParams.get("direct") === "1";
          const iso = sanitizeIsoToken(reqUrl.searchParams.get("iso"));
          const u = new URL(raw);

          if (
            (u.protocol !== "wss:" && u.protocol !== "ws:") ||
            !hostAllowed(u.hostname) ||
            !keywaveRouteAllowed(u, direct)
          ) {
            clientSocket.destroy();

            return;
          }
          // The first-party IRC integration is The Lounge/Socket.IO. Narrow this
          // host to its TLS Engine.IO endpoint so the generic tunnel cannot reach
          // unrelated paths or downgrade it to plaintext WebSocket.
          if (
            u.hostname.toLowerCase() === "irc.securityops.com.br" &&
            (u.protocol !== "wss:" || u.pathname !== "/socket.io/")
          ) {
            clientSocket.destroy();

            return;
          }
          // Fail CLOSED, mirroring proxy.ts's httpRequest guard: if Tor is configured
          // (TOR_PROXY set) but the SOCKS agent didn't build (missing socks-proxy-agent
          // module, or a malformed TOR_PROXY), NEVER open a non-direct tunnel — it
          // would connect over a direct clearnet socket and leak the real IP while the
          // user believes they're on Tor. direct=1 (Tor-blocked messengers) is exempt.
          upstreamAgent = direct ? undefined : agentForIso(iso);
          if (!direct && !upstreamAgent) {
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
              agent: upstreamAgent,
              // Redirects could leave the validated host allowlist. A client must
              // reconnect to an explicitly validated target instead.
              followRedirects: false,
              handshakeTimeout: 30_000,
              headers: {
                // WebSocket Origin uses the page's HTTP(S) origin, never a
                // ws(s):// origin. Some Engine.IO servers accept the upgrade
                // and then immediately close when this scheme is wrong.
                Origin: new URL(target).origin.replace(/^ws/, "http"),
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
          let queuedBytes = 0;
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
            } else if (upstream.readyState === WebSocket.CONNECTING) {
              const dataBytes = Array.isArray(data)
                ? data.reduce((total, item) => total + item.byteLength, 0)
                : data.byteLength;

              if (
                queue.length >= MAX_WS_QUEUE_MESSAGES ||
                queuedBytes + dataBytes > MAX_WS_QUEUE_BYTES
              ) {
                closeBoth();

                return;
              }

              queue.push([data, isBinary]);
              queuedBytes += dataBytes;
            } else {
              closeBoth();
            }
          });
          upstream.on("open", () => {
            queue.forEach(([d, b]) => upstream.send(d, { binary: b }));
            queue.length = 0;
            queuedBytes = 0;
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
