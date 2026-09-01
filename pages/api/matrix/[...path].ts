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
 * Tor: TOR_PROXY is mandatory (e.g. socks5h://tor:9050 via the deploy compose).
 * Every upstream request uses that SOCKS5h agent, including Tor-side DNS. If the
 * agent is absent or malformed, the route returns 502 instead of silently opening
 * a direct connection. This protects the SecurityOS server's upstream route; the
 * user's connection to SecurityOS and Matrix account metadata remain observable
 * to the services that handle them.
 *
 * No SSRF: HOMESERVER is hardcoded and the only host we ever connect to. The
 * forwarded path MUST be in the `_matrix/client/` or `_matrix/media/` family, so
 * this endpoint can only reach matrix.securityops.com.br's Client-Server APIs — it
 * cannot become an arbitrary-host, federation, admin, or key relay.
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

const HOMESERVER = "https://matrix.securityops.com.br";

// /sync long-polls up to ~30s, but matrix-js-sdk's own client-side abort is
// pollTimeout(30s) + BUFFER_PERIOD(80s) = ~110s for steady-state syncs. Keep our
// ceiling ABOVE that so the proxy never kills a healthy long-poll (or a slow
// initial sync / key upload over Tor) before the SDK would.
const REQUEST_TIMEOUT_MS = 120_000;
// Sized for chat media: the E2EE client uploads (POST _matrix/media/v3/upload)
// and downloads (GET _matrix/client/v1/media/download) attachments through here.
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

const TOR_PROXY = process.env.TOR_PROXY || "";
// Never let a missing or malformed TOR_PROXY value take down the route at module
// load. A bad/absent agent degrades to a clean "Tor unavailable" 502 (fail
// closed); this Tor-only endpoint never degrades to a direct connection.
let socksAgent: SocksProxyAgent | undefined;
try {
  socksAgent = TOR_PROXY ? new SocksProxyAgent(TOR_PROXY) : undefined;
} catch {
  socksAgent = undefined;
}

// Only these client headers are ever forwarded upstream. Cookies and everything
// else are dropped.
const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept"];
const ALLOWED_METHODS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
]);
const ALLOWED_PATH_PREFIXES = ["_matrix/client/", "_matrix/media/"];
const ALLOWED_NORMALIZED_PATH_PREFIXES = ALLOWED_PATH_PREFIXES.map(
  (prefix) => `/${prefix}`
);

const hasPathControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;

    if (codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }

  return false;
};

const isTraversalSegment = (value: string): boolean =>
  value === "." || value === "..";

// Next normally hands catch-all segments to us decoded once. Repeatedly unwrap
// percent encoding so a STRUCTURAL segment spelled `%2e%2e` or `%252e%252e`
// cannot survive our pre-normalization allowlist. Do not split a decoded catch-all
// segment on `/`: Matrix aliases and opaque IDs may legally contain encoded
// slashes, percent signs, and even slash-delimited `.` data. Each Next path segment
// is re-encoded with encodeURIComponent below, so those characters remain opaque
// (`%2F`, `%25`) in the upstream URL rather than becoming path delimiters.
const isUnsafePathSegment = (segment: string): boolean => {
  let value = segment;

  // Every successful decode shortens the string, so this bound reaches a stable
  // value without imposing an arbitrary nesting limit on an opaque Matrix ID.
  for (let depth = 0; depth <= segment.length; depth += 1) {
    if (isTraversalSegment(value) || hasPathControlCharacter(value)) {
      return true;
    }

    try {
      const decoded = decodeURIComponent(value);

      if (decoded === value) return false;
      value = decoded;
    } catch {
      // A literal/malformed percent sequence is re-encoded below as `%25`; it
      // cannot alter the upstream path structure.
      return false;
    }
  }

  return false;
};

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
  body: Buffer | undefined,
  clientReq: NextApiRequest
): Promise<UpstreamResponse> =>
  new Promise((resolve, reject) => {
    // Fail CLOSED even when TOR_PROXY is absent. This endpoint is Tor-only, so an
    // undefined agent must never become Node's implicit direct HTTPS connection.
    if (!socksAgent) {
      reject(new Error("tor-unavailable"));
      return;
    }

    let settled = false;
    // Whether the request body has been fully flushed upstream. Until it has, the
    // homeserver cannot have acted on it, so a failure is safe to replay; once it
    // has, replaying could DUPLICATE a non-idempotent POST (create-room, upload).
    let sent = false;

    // Settle exactly once and detach the client-disconnect listener.
    const finish = (run: () => void): void => {
      if (settled) return;
      settled = true;
      clientReq.off("close", onClientGone);
      run();
    };

    // If the browser aborts (the SDK aborting a /sync long-poll or an upload, or the
    // Matrix window closing), tear the upstream Tor request down immediately instead
    // of leaking the socket/circuit until the 90s timeout — and stop the retry loop.
    function onClientGone(): void {
      finish(() => {
        request.destroy();
        reject(new Error("client-gone"));
      });
    }

    const fail = (error: Error): void => {
      // Tag replay-safety so forwardWithRetry never re-sends a request whose body
      // the homeserver may already have processed.
      (error as Error & { replaySafe?: boolean }).replaySafe = !sent;
      finish(() => reject(error));
    };

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

          finish(() =>
            resolve({
              body: Buffer.concat(chunks),
              contentType: Array.isArray(contentTypeHeader)
                ? contentTypeHeader[0]
                : contentTypeHeader || "application/json",
              status: response.statusCode || 502,
            })
          );
        });
        response.on("error", fail);
      }
    );

    clientReq.on("close", onClientGone);
    request.setTimeout(REQUEST_TIMEOUT_MS, () =>
      request.destroy(new Error("timeout"))
    );
    request.on("error", fail);
    if (body && body.length > 0) {
      // Mark as sent BEFORE the async write resolves: once any body byte is on its
      // way the homeserver may act on it, so a non-idempotent request must never be
      // replayed. (Closes the race where the 'finish' event lagged a fast post-write
      // error and left a sent POST wrongly marked replay-safe.)
      sent = true;
      request.write(body);
    }
    request.end();
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Cold/flaky Tor circuits make the FIRST requests fail (which surfaced in the
// client as a stuck "Connecting over Tor…" — the initial /sync kept erroring).
// Retry connection-level failures a few times so a WARMING circuit succeeds instead
// of bubbling up an error. We do NOT retry a genuine upstream HTTP response (those
// resolve), only Tor/socket failures (those reject).
//
// CRUCIAL: never REPLAY a request the homeserver may already have processed. GET/
// HEAD/PUT/DELETE/OPTIONS are idempotent (PUT .../send/{txnId} is transaction-
// deduped server-side), so retrying is always safe. A non-idempotent POST
// (createRoom, media upload, join-by-alias) that already reached the server would be
// DUPLICATED by a blind retry (two rooms, two uploads, double join) — so for those
// we only retry while the body has NOT yet been sent (forwardToHomeserver tags the
// rejection with `replaySafe`). We also stop immediately on a fail-closed Tor
// misconfig or a client that has disconnected.
const MAX_FORWARD_ATTEMPTS = 3;
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const forwardWithRetry = async (
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer | undefined,
  clientReq: NextApiRequest
): Promise<UpstreamResponse> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FORWARD_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await forwardToHomeserver(
        targetUrl,
        method,
        headers,
        body,
        clientReq
      );
    } catch (error) {
      lastError = error;
      const message = (error as Error)?.message;

      // A fail-closed Tor misconfig won't fix itself, and a disconnected client
      // wants nothing back — don't waste retries on either.
      if (message === "tor-unavailable" || message === "client-gone") break;

      // Creating a sync FILTER (POST /user/{id}/filter) is idempotent in effect —
      // an identical filter just returns the same filter_id — and it GATES the first
      // /sync, so it must survive a cold-circuit hiccup. Treat it as replay-safe even
      // though it's a POST, while create-room / media-upload / join stay gated.
      const isSafePost =
        method.toUpperCase() === "POST" &&
        /\/user\/[^/]+\/filter(?:\?|$)/.test(targetUrl);
      const replaySafe =
        IDEMPOTENT_METHODS.has(method.toUpperCase()) ||
        isSafePost ||
        (error as { replaySafe?: boolean })?.replaySafe === true;

      if (!replaySafe) break;

      if (attempt < MAX_FORWARD_ATTEMPTS) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(attempt * 800);
      }
    }
  }

  throw lastError;
};

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
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Reconstruct the upstream path from the catch-all segments. Only Matrix client
  // and media API families may be reached — federation/admin/key endpoints remain
  // inaccessible even though the upstream host itself is fixed.
  const segments = Array.isArray(req.query.path) ? req.query.path : [];
  const joinedPath = segments.map((s) => encodeURIComponent(s)).join("/");

  if (
    segments.some((segment) => isUnsafePathSegment(segment)) ||
    !ALLOWED_PATH_PREFIXES.some((prefix) => joinedPath.startsWith(prefix))
  ) {
    res
      .status(400)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .end(
        JSON.stringify({
          errcode: "M_SECURITYOS_BAD_PATH",
          error: "Only Matrix client and media API paths are allowed",
        })
      );
    return;
  }

  // Preserve the original query string (e.g. /sync's ?since=&timeout=). Strip our
  // own catch-all `path` param, which Next injects into req.query.
  const rawUrl = req.url || "";
  const queryIndex = rawUrl.indexOf("?");
  const queryString = queryIndex === -1 ? "" : rawUrl.slice(queryIndex);
  // CRITICAL: Next's catch-all matcher DROPS a trailing-slash empty segment, so
  // joinedPath loses it — but Synapse REQUIRES the slash on some endpoints, notably
  // GET /_matrix/client/v3/pushrules/ (the global ruleset). matrix-js-sdk calls that
  // BEFORE the first /sync; without the slash Synapse 400s, the SDK retries forever,
  // and the client is stuck "syncing" after a successful login. Restore the slash
  // from req.url's path portion. (SSRF guard is unaffected — joinedPath is still the
  // allow-listed `_matrix/`-prefixed value; a lone trailing "/" can't escape it.)
  const pathPortion = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  const trailingSlash = pathPortion.endsWith("/") ? "/" : "";
  const targetUrl = new URL(
    `${HOMESERVER}/${joinedPath}${trailingSlash}${queryString}`
  );

  // URL parsing normalizes dot segments. Re-check the normalized path so a value
  // accepted above can never escape from client/media into federation or admin.
  if (
    targetUrl.origin !== HOMESERVER ||
    !ALLOWED_NORMALIZED_PATH_PREFIXES.some((prefix) =>
      targetUrl.pathname.startsWith(prefix)
    )
  ) {
    res
      .status(400)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .end(
        JSON.stringify({
          errcode: "M_SECURITYOS_BAD_PATH",
          error: "Only Matrix client and media API paths are allowed",
        })
      );
    return;
  }

  // Allowlist the forwarded headers — Authorization (Bearer token), Content-Type,
  // Accept only. No cookies, no client IP, no anything else.
  const headers: Record<string, string> = {};

  FORWARD_REQUEST_HEADERS.forEach((name) => {
    const value = req.headers[name];

    if (typeof value === "string") headers[name] = value;
    else if (Array.isArray(value) && value[0]) headers[name] = value[0];
  });

  const method = (req.method || "GET").toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    res
      .status(405)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .end(
        JSON.stringify({
          errcode: "M_UNRECOGNIZED",
          error: "Method not allowed",
        })
      );
    return;
  }

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
    const upstream = await forwardWithRetry(
      targetUrl.href,
      method,
      headers,
      body,
      req
    );

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.end(upstream.body);
  } catch (error) {
    // Any Tor/network failure becomes a clean 502 JSON — never an unhandled throw.
    const message = (error as Error)?.message || "upstream failure";

    // The browser already disconnected (we aborted the upstream because of it) —
    // there is nobody to send a response to, so don't write to a dead socket.
    if (message === "client-gone" || res.writableEnded) return;

    sendTorError(
      res,
      message === "tor-unavailable"
        ? "Tor unavailable"
        : "Could not reach the homeserver over Tor"
    );
  }
};

export default handler;
