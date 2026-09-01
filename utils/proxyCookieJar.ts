/**
 * A deliberately tiny, server-only cookie bridge for embedded first-party apps.
 *
 * The general privacy proxy remains credential-less. This store accepts only the
 * ZUPT CSRF cookie, only from an exact allowlisted host, and only inside a random
 * app isolation session. Cookies never reach the browser and disappear on process
 * restart, expiry, or LRU eviction.
 */

type StoredCookie = {
  expiresAt: number;
  origin: string;
  path: string;
  secure: boolean;
  value: string;
};

type CookieSession = {
  cookies: Map<string, StoredCookie>;
  createdAt: number;
  lastAccess: number;
};

type EphemeralCsrfCookieJarOptions = {
  absoluteSessionTtlMs?: number;
  allowedOrigins: readonly string[];
  maxCookieBytes?: number;
  maxCookieTtlMs?: number;
  maxCookiesPerSession?: number;
  maxNewSessionsPerMinute?: number;
  maxSessions?: number;
  maxTotalCookieBytes?: number;
  now?: () => number;
  sessionTtlMs?: number;
};

const DEFAULT_ABSOLUTE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MAX_COOKIE_BYTES = 4096;
const DEFAULT_MAX_COOKIES_PER_SESSION = 8;
const DEFAULT_MAX_COOKIE_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MAX_NEW_SESSIONS_PER_MINUTE = 120;
const DEFAULT_MAX_SESSIONS = 256;
const DEFAULT_MAX_TOTAL_COOKIE_BYTES = 512 * 1024;
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const SESSION_KEY_RE = /^(?:direct|tor):[\da-f]{32}$/;

const defaultCookiePath = (pathname: string): string => {
  if (!pathname.startsWith("/") || pathname === "/") return "/";

  const lastSlash = pathname.lastIndexOf("/");

  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
};

const pathMatches = (requestPath: string, cookiePath: string): boolean =>
  requestPath === cookiePath ||
  (requestPath.startsWith(cookiePath) &&
    (cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/"));

const cookieKey = (cookie: Pick<StoredCookie, "origin" | "path">): string =>
  `${cookie.origin}\n${cookie.path}`;

export const proxyCookieSessionKey = (
  isoToken: string,
  direct: boolean
): string => `${direct ? "direct" : "tor"}:${isoToken}`;

export class EphemeralCsrfCookieJar {
  private readonly absoluteSessionTtlMs: number;

  private readonly allowedOrigins: Set<string>;

  private readonly maxCookieBytes: number;

  private readonly maxCookiesPerSession: number;

  private readonly maxCookieTtlMs: number;

  private readonly maxNewSessionsPerMinute: number;

  private readonly maxSessions: number;

  private readonly maxTotalCookieBytes: number;

  private readonly now: () => number;

  private readonly sessionTtlMs: number;

  private readonly sessions = new Map<string, CookieSession>();

  private readonly sessionCreations: number[] = [];

  public constructor({
    absoluteSessionTtlMs = DEFAULT_ABSOLUTE_SESSION_TTL_MS,
    allowedOrigins,
    maxCookieBytes = DEFAULT_MAX_COOKIE_BYTES,
    maxCookiesPerSession = DEFAULT_MAX_COOKIES_PER_SESSION,
    maxCookieTtlMs = DEFAULT_MAX_COOKIE_TTL_MS,
    maxNewSessionsPerMinute = DEFAULT_MAX_NEW_SESSIONS_PER_MINUTE,
    maxSessions = DEFAULT_MAX_SESSIONS,
    maxTotalCookieBytes = DEFAULT_MAX_TOTAL_COOKIE_BYTES,
    now = Date.now,
    sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  }: EphemeralCsrfCookieJarOptions) {
    this.absoluteSessionTtlMs = absoluteSessionTtlMs;
    this.allowedOrigins = new Set(
      allowedOrigins.map((origin) => new URL(origin).origin.toLowerCase())
    );
    this.maxCookieBytes = maxCookieBytes;
    this.maxCookiesPerSession = maxCookiesPerSession;
    this.maxCookieTtlMs = maxCookieTtlMs;
    this.maxNewSessionsPerMinute = maxNewSessionsPerMinute;
    this.maxSessions = maxSessions;
    this.maxTotalCookieBytes = maxTotalCookieBytes;
    this.now = now;
    this.sessionTtlMs = sessionTtlMs;
  }

  private allowed(url: URL, sessionKey: string): boolean {
    return (
      SESSION_KEY_RE.test(sessionKey) &&
      this.allowedOrigins.has(url.origin.toLowerCase()) &&
      url.protocol === "https:"
    );
  }

  private cookieBytes(): number {
    let total = 0;

    this.sessions.forEach((session) => {
      session.cookies.forEach((cookie) => {
        total += Buffer.byteLength(
          `${cookie.origin}${cookie.path}csrf_token=${cookie.value}`,
          "utf8"
        );
      });
    });

    return total;
  }

  private prune(now: number): void {
    this.sessions.forEach((session, key) => {
      if (
        now - session.lastAccess >= this.sessionTtlMs ||
        now - session.createdAt >= this.absoluteSessionTtlMs
      ) {
        this.sessions.delete(key);
        return;
      }

      session.cookies.forEach((cookie, keyName) => {
        if (cookie.expiresAt <= now) session.cookies.delete(keyName);
      });

      if (session.cookies.size === 0) this.sessions.delete(key);
    });

    while (
      this.sessionCreations.length > 0 &&
      now - this.sessionCreations[0] >= 60_000
    ) {
      this.sessionCreations.shift();
    }
  }

  private touch(sessionKey: string, session: CookieSession, now: number): void {
    this.sessions.delete(sessionKey);
    this.sessions.set(sessionKey, { ...session, lastAccess: now });
  }

  public getCookieHeader(sessionKey: string, url: URL): string | undefined {
    if (!this.allowed(url, sessionKey)) return undefined;

    const now = this.now();

    this.prune(now);

    const session = this.sessions.get(sessionKey);

    if (!session) return undefined;

    const origin = url.origin.toLowerCase();
    const matches = [...session.cookies.values()]
      .filter(
        (cookie) =>
          cookie.origin === origin &&
          cookie.expiresAt > now &&
          (!cookie.secure || url.protocol === "https:") &&
          pathMatches(url.pathname || "/", cookie.path)
      )
      .sort((left, right) => right.path.length - left.path.length);

    this.touch(sessionKey, session, now);

    return matches.length > 0
      ? matches.map((cookie) => `csrf_token=${cookie.value}`).join("; ")
      : undefined;
  }

  public storeSetCookie(
    sessionKey: string,
    url: URL,
    setCookie: string[] | string | undefined
  ): void {
    if (!this.allowed(url, sessionKey) || !setCookie) return;

    const now = this.now();

    this.prune(now);

    const values = Array.isArray(setCookie) ? setCookie : [setCookie];

    values.forEach((header) => {
      if (
        Buffer.byteLength(header, "utf8") > this.maxCookieBytes ||
        !/^csrf_token=/i.test(header)
      ) {
        return;
      }

      const parts = header.split(";");
      const firstEquals = parts[0].indexOf("=");

      if (firstEquals < 0 || parts[0].slice(0, firstEquals) !== "csrf_token") {
        return;
      }

      let value = parts[0].slice(firstEquals + 1).trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Prevent control/header delimiters from ever entering an outbound Cookie
      // header. ZUPT's signed CSRF token uses only ordinary visible characters.
      if (
        [...value].some((character) => {
          const code = character.codePointAt(0) || 0;

          return (
            code <= 32 || code === 127 || character === ";" || character === ","
          );
        })
      ) {
        return;
      }

      let expiresAt = now + this.maxCookieTtlMs;
      let path = defaultCookiePath(url.pathname || "/");
      let secure = false;
      let deleteCookie = value.length === 0;
      let maxAgeSeen = false;
      let domainSeen = false;
      let httpOnlySeen = false;

      parts.slice(1).forEach((rawAttribute) => {
        const attribute = rawAttribute.trim();
        const equals = attribute.indexOf("=");
        const name = (equals < 0 ? attribute : attribute.slice(0, equals))
          .trim()
          .toLowerCase();
        const attributeValue =
          equals < 0 ? "" : attribute.slice(equals + 1).trim();

        switch (name) {
          case "domain":
            domainSeen = true;
            break;
          case "expires": {
            if (maxAgeSeen) break;

            const parsed = Date.parse(attributeValue);

            if (Number.isFinite(parsed)) {
              if (parsed <= now) deleteCookie = true;
              else expiresAt = Math.min(parsed, now + this.maxCookieTtlMs);
            }
            break;
          }
          case "httponly":
            httpOnlySeen = true;
            break;
          case "max-age": {
            const seconds = Number(attributeValue);

            if (Number.isFinite(seconds)) {
              maxAgeSeen = true;
              if (seconds <= 0) deleteCookie = true;
              else {
                expiresAt = Math.min(
                  now + seconds * 1000,
                  now + this.maxCookieTtlMs
                );
              }
            }
            break;
          }
          case "path":
            if (attributeValue.startsWith("/")) path = attributeValue;
            break;
          case "secure":
            secure = true;
            break;
          default:
            break;
        }
      });

      // Only host-only Secure cookies are eligible. Rejecting Domain entirely is
      // stricter than ordinary browser matching and prevents any suffix spreading.
      if (domainSeen || !httpOnlySeen || !secure) return;

      const origin = url.origin.toLowerCase();
      const key = cookieKey({ origin, path });
      let session = this.sessions.get(sessionKey);

      if (deleteCookie) {
        session?.cookies.delete(key);
        if (session?.cookies.size === 0) {
          this.sessions.delete(sessionKey);
        }
        return;
      }

      if (!session) {
        if (this.sessionCreations.length >= this.maxNewSessionsPerMinute) {
          return;
        }
        this.sessionCreations.push(now);
        session = {
          cookies: new Map<string, StoredCookie>(),
          createdAt: now,
          lastAccess: now,
        };
      }

      session.cookies.delete(key);
      session.cookies.set(key, {
        expiresAt,
        origin,
        path,
        secure,
        value,
      });

      while (session.cookies.size > this.maxCookiesPerSession) {
        const oldest = session.cookies.keys().next().value;

        if (oldest === undefined) break;
        session.cookies.delete(oldest);
      }

      this.touch(sessionKey, session, now);
    });

    while (
      this.sessions.size > this.maxSessions ||
      this.cookieBytes() > this.maxTotalCookieBytes
    ) {
      const oldest = this.sessions.keys().next().value;

      if (oldest === undefined) break;
      this.sessions.delete(oldest);
    }
  }
}
