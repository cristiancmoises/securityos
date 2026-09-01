import type { NextApiRequest, NextApiResponse } from "next";
import {
  CAPABILITY_TTL_SECONDS,
  issueProxyCapability,
  type ProxyProfile,
  type ProxyRoute,
  type ProxyScriptPolicy,
} from "utils/proxyCapability";

export const config = {
  api: { bodyParser: { sizeLimit: "1kb" } },
};

const ISSUANCE_WINDOW_MS = 60_000;
const MAX_ISSUANCE_PER_WINDOW = 240;
const issuanceWindows = new Map<string, { count: number; resetAt: number }>();

const canIssueFor = (clientKey: string, now = Date.now()): boolean => {
  if (issuanceWindows.size > 1024) {
    issuanceWindows.forEach((window, key) => {
      if (window.resetAt <= now) issuanceWindows.delete(key);
    });
    while (issuanceWindows.size > 2048) {
      const oldest = issuanceWindows.keys().next().value;

      if (oldest === undefined) break;
      issuanceWindows.delete(oldest);
    }
  }

  const current = issuanceWindows.get(clientKey);

  if (!current || current.resetAt <= now) {
    issuanceWindows.set(clientKey, {
      count: 1,
      resetAt: now + ISSUANCE_WINDOW_MS,
    });

    return true;
  }

  if (current.count >= MAX_ISSUANCE_PER_WINDOW) return false;

  current.count += 1;

  return true;
};

const requestOrigin = (req: NextApiRequest): string => {
  const pinned = (process.env.SECURITYOS_ORIGIN || "").replace(/\/+$/, "");

  if (pinned) return pinned;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ===
    "https"
      ? "https"
      : "http";

  return `${proto}://${req.headers.host || ""}`;
};

const handler = (req: NextApiRequest, res: NextApiResponse): void => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // This custom header is deliberately required. A sandboxed opaque-origin page
  // cannot add it without a CORS preflight, and this endpoint never grants CORS.
  // The same-origin desktop can send it normally.
  if (req.headers["x-securityos-client"] !== "desktop") {
    res.status(403).json({ error: "Desktop client required" });
    return;
  }

  const fetchSite = req.headers["sec-fetch-site"];

  if (fetchSite !== "same-origin") {
    res.status(403).json({ error: "Cross-origin request refused" });
    return;
  }

  const { origin } = req.headers;

  if (origin !== requestOrigin(req)) {
    res.status(403).json({ error: "Origin refused" });
    return;
  }

  if (!canIssueFor(req.socket.remoteAddress || "unknown")) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many capability requests" });
    return;
  }

  const body = req.body as unknown;
  const request =
    typeof body === "object" && body
      ? (body as {
          iso?: unknown;
          profile?: unknown;
          route?: unknown;
          scriptPolicy?: unknown;
        })
      : {};
  const { iso, profile, route, scriptPolicy } = request;

  if (
    (route !== "direct" && route !== "tor") ||
    !["browser", "godseye", "irc", "keywave", "wiki", "zupt"].includes(
      profile as string
    ) ||
    (scriptPolicy !== "all" &&
      scriptPolicy !== "noscript" &&
      scriptPolicy !== "off") ||
    typeof iso !== "string" ||
    (iso !== "" && !/^[\da-f]{32}$/.test(iso))
  ) {
    res.status(400).json({ error: "Invalid capability scope" });
    return;
  }

  res.status(200).json({
    capability: issueProxyCapability(route as ProxyRoute, {
      iso,
      profile: profile as ProxyProfile,
      scriptPolicy: scriptPolicy as ProxyScriptPolicy,
    }),
    expiresIn: CAPABILITY_TTL_SECONDS,
    route,
  });
};

export default handler;
