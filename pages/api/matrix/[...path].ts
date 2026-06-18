import http from "http";
import https from "https";
import type { NextApiRequest, NextApiResponse } from "next";
import { SocksProxyAgent } from "socks-proxy-agent";

/**
 * SecurityOS Matrix proxy.
 *
 * A catch-all route that forwards Matrix Client-Server API calls to ONE fixed
 * homeserver, over Tor, on behalf of the first-party Matrix chat app
 * (components/apps/Matrix). The app only ever talks to THIS same-origin endpoint
 * (e.g. /api/matrix/_matrix/client/v3/login); we relay it to the homeserver.
 *
 * Tor: when TOR_PROXY is set (e.g. socks5h://tor:9050 via the deploy compose),
 * every request is routed through Tor's SOCKS5h proxy — DNS is resolved AT Tor, so
 * the homeserver hostname never leaks to a local resolver and the real IP is never
 * exposed. We fail CLOSED: if TOR_PROXY is configured but the agent didn't build,
 * we return 502 rather than silently connecting direct (which would leak the IP
 * while the user believes they are on Tor).
 *
 * No SSRF: HOMESERVER is hardcoded and the only host we ever connect to. The
 * forwarded path MUST start with `_matrix/`, so this endpoint can ONLY ever reach
 * matrix.securityops.co's documented Client-Server API — it can never be coerced
 * into acting as an open proxy to an arbitrary host.
 *
 * Privacy: only Authorization / Content-Type / Accept are forwarded upstream (no
 * cookies, no other headers). The response relays only the upstream status, the
 * Content-Type and the body bytes, with Cache-Control: no-store and
 * Referrer-Policy: no-referrer. No logging.
 *
 * Server-only: exists under `next start` (Docker default); absent in static export.
 */

// Read the RAW request body ourselves so non-GET bodies (login JSON, message
// JSON) are forwarded byte-for-byte and unaltered.
export const config = {
  api: { bodyParser: false },
};

const HOMESERVER = "https://matrix.securityops.co";

// /sync long-polls up to ~30s; give it a comfortable ceiling so a healthy
// long-poll (or a slow initial sync / key upload over Tor) is never killed
// mid-flight.
const REQUEST_TIMEOUT_MS = 90_000;
// Sized for chat media: the E2EE client uploads (POST _matrix/media/v3/upload)
// and downloads (GET _matrix/client/v1/media/download) attachments through here.
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

const TOR_PROXY = process.env.TOR_PROXY || "";
// Never let a malformed TOR_PROXY value take down the route at module load. A
// bad/absent agent degrades to a clean "Tor unavailable" 502 (fail closed), it
// never degrades to a direct connection.
let socksAgent: SocksProxyAgent | undefined;
try {
  socksAgent = TOR_PROXY ? new SocksProxyAgent(TOR_PROXY) : undefined;
} catch {
  socksAgent = undefined;
}

// Only these client headers are ever forwarded upstream. Cookies and everything
// else are dropped.
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept"];

type UpstreamResponse = {
  body: Buffer;
  contentType: string;
  status: number;
};

// Collect the raw request stream into a Buffer (capped). bodyParser is disabled,
// so this is the unmodified body the client sent.
const readRawBody = (req: NextApiRequest): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("request-too-large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

// Forward one request to the homeserver through the Tor SOCKS agent. Mirrors
// proxy.ts: Node https.request with `{ agent: socksAgent }`, capped body, manual
// timeout. We never auto-follow redirects (the Matrix API doesn't use them for
// the Client-Server endpoints we proxy).
const forwardToHomeserver = (
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined
): Promise<UpstreamResponse> =>
  new Promise((resolve, reject) => {
    // Fail CLOSED: when Tor is configured (TOR_PROXY set) but the agent failed to
    // build, never open a direct connection — surface it as a Tor error.
    if (TOR_PROXY && !socksAgent) {
      reject(new Error("tor-unavailable"));
      return;
    }

    const request = https.request(
      targetUrl,
      {
        agent: socksAgent,
        headers,
        method,
      },
      (response: http.IncomingMessage) => {
        const chunks: Buffer[] = [];
        let total = 0;

        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            request.destroy(new Error("response-too-large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const contentTypeHeader = response.headers["content-type"];

          resolve({
            body: Buffer.concat(chunks),
            contentType: Array.isArray(contentTypeHeader)
              ? contentTypeHeader[0]
              : contentTypeHeader || "application/json",
            status: response.statusCode || 502,
          });
        });
        response.on("error", reject);
      }
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () =>
      request.destroy(new Error("timeout"))
    );
    request.on("error", reject);
    if (body && body.length > 0) request.write(body);
    request.end();
  });

const sendTorError = (res: NextApiResponse, error: string): void => {
  res
    .status(502)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "no-store")
    .setHeader("Referrer-Policy", "no-referrer")
    .end(JSON.stringify({ errcode: "M_SECURITYOS_TOR", error }));
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  // Reconstruct the upstream path from the catch-all segments. ONLY the documented
  // Matrix Client-Server API (`_matrix/...`) may be reached — this is what makes
  // the endpoint single-host with no SSRF: it can never address anything but
  // matrix.securityops.co's /_matrix/ tree.
  const segments = Array.isArray(req.query.path) ? req.query.path : [];
  const joinedPath = segments.map((s) => encodeURIComponent(s)).join("/");

  if (!joinedPath.startsWith("_matrix/")) {
    res
      .status(400)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .end(
        JSON.stringify({
          errcode: "M_SECURITYOS_BAD_PATH",
          error: "Only _matrix/ Client-Server API paths are allowed",
        })
      );
    return;
  }

  // Preserve the original query string (e.g. /sync's ?since=&timeout=). Strip our
  // own catch-all `path` param, which Next injects into req.query.
  const rawUrl = req.url || "";
  const queryIndex = rawUrl.indexOf("?");
  const queryString = queryIndex === -1 ? "" : rawUrl.slice(queryIndex);
  const targetUrl = `${HOMESERVER}/${joinedPath}${queryString}`;

  // Allowlist the forwarded headers — Authorization (Bearer token), Content-Type,
  // Accept only. No cookies, no client IP, no anything else.
  const headers: Record<string, string> = {};

  FORWARD_REQUEST_HEADERS.forEach((name) => {
    const value = req.headers[name];

    if (typeof value === "string") headers[name] = value;
    else if (Array.isArray(value) && value[0]) headers[name] = value[0];
  });

  const method = (req.method || "GET").toUpperCase();
  let body: Buffer | undefined;

  try {
    if (method !== "GET" && method !== "HEAD") {
      body = await readRawBody(req);
    }
  } catch {
    res
      .status(413)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .end(
        JSON.stringify({
          errcode: "M_TOO_LARGE",
          error: "Request body too large",
        })
      );
    return;
  }

  try {
    const upstream = await forwardToHomeserver(
      targetUrl,
      method,
      headers,
      body
    );

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.end(upstream.body);
  } catch (error) {
    // Any Tor/network failure becomes a clean 502 JSON — never an unhandled throw.
    const message = (error as Error)?.message || "upstream failure";

    sendTorError(
      res,
      message === "tor-unavailable"
        ? "Tor unavailable"
        : `Could not reach the homeserver over Tor (${message})`
    );
  }
};

export default handler;
