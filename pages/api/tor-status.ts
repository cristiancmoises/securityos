import net from "net";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Reports whether the server-side Tor SOCKS proxy is actually reachable.
 *
 * The in-OS Browser / Tor Browser route every fetch through TOR_PROXY
 * (socks5h://tor:9050 in deploy/docker-compose). This endpoint does a real TCP
 * connect to that SOCKS port so Tor Control can show a truthful "connected"
 * state instead of merely echoing config. No logging, no caching (amnesic).
 */

const TOR_PROXY = process.env.TOR_PROXY || "";
const PROBE_TIMEOUT_MS = 2_500;

const probe = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });

const handler = async (
  _req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Referrer-Policy", "no-referrer");

  const configured = Boolean(TOR_PROXY);
  let reachable = false;

  if (configured) {
    try {
      const parsed = new URL(TOR_PROXY);

      // Only ever probe a SOCKS proxy host. TOR_PROXY is operator-set, but this
      // guards against a malformed value turning the health probe into an
      // arbitrary-host TCP connect (defense in depth).
      if (parsed.protocol.startsWith("socks") && parsed.hostname) {
        reachable = await probe(parsed.hostname, Number(parsed.port) || 9050);
      }
    } catch {
      reachable = false;
    }
  }

  res.status(200).json({
    // The browser only learns up/down — never the host:port (defense in depth).
    configured,
    tor: configured && reachable,
  });
};

export default handler;
