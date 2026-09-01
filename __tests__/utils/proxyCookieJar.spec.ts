import {
  EphemeralCsrfCookieJar,
  proxyCookieSessionKey,
} from "utils/proxyCookieJar";

const ZUPT_ROOT = new URL("https://share.securityops.co/");
const ZUPT_ORIGIN = "https://share.securityops.co";
const TOR_SESSION = proxyCookieSessionKey("a".repeat(32), false);
const DIRECT_SESSION = proxyCookieSessionKey("b".repeat(32), true);

const makeJar = (now: () => number = () => 1_000): EphemeralCsrfCookieJar =>
  new EphemeralCsrfCookieJar({
    allowedOrigins: [ZUPT_ORIGIN],
    now,
  });

describe("ephemeral ZUPT CSRF cookie bridge", () => {
  test("replays only the CSRF cookie inside the same mode/session", () => {
    const jar = makeJar();

    jar.storeSetCookie(
      TOR_SESSION,
      ZUPT_ROOT,
      "csrf_token=signed.value-123; Secure; HttpOnly; Path=/; SameSite=Strict"
    );

    expect(jar.getCookieHeader(TOR_SESSION, ZUPT_ROOT)).toBe(
      "csrf_token=signed.value-123"
    );
    expect(jar.getCookieHeader(DIRECT_SESSION, ZUPT_ROOT)).toBeUndefined();
    expect(
      jar.getCookieHeader("tor:not-a-valid-session", ZUPT_ROOT)
    ).toBeUndefined();
  });

  test("never spreads a cookie to another host or plaintext URL", () => {
    const jar = makeJar();

    jar.storeSetCookie(
      TOR_SESSION,
      ZUPT_ROOT,
      "csrf_token=domain-cookie; Domain=.securityops.co; Secure; Path=/"
    );

    expect(
      jar.getCookieHeader(TOR_SESSION, new URL("https://chat.securityops.co/"))
    ).toBeUndefined();
    expect(
      jar.getCookieHeader(TOR_SESSION, new URL("http://share.securityops.co/"))
    ).toBeUndefined();
    expect(jar.getCookieHeader(TOR_SESSION, ZUPT_ROOT)).toBeUndefined();

    jar.storeSetCookie(
      TOR_SESSION,
      ZUPT_ROOT,
      "csrf_token=host-only; Secure; HttpOnly; Path=/"
    );
    expect(
      jar.getCookieHeader(
        TOR_SESSION,
        new URL("https://share.securityops.co:444/")
      )
    ).toBeUndefined();
  });

  test("honors cookie paths, expiry, and deletion", () => {
    let currentTime = 10_000;
    const jar = makeJar(() => currentTime);
    const operation = new URL("https://share.securityops.co/tools/keygen");

    jar.storeSetCookie(
      TOR_SESSION,
      operation,
      "csrf_token=short-lived; Secure; HttpOnly; Path=/tools; Max-Age=2"
    );

    expect(jar.getCookieHeader(TOR_SESSION, operation)).toBe(
      "csrf_token=short-lived"
    );
    expect(jar.getCookieHeader(TOR_SESSION, ZUPT_ROOT)).toBeUndefined();

    currentTime += 2_000;
    expect(jar.getCookieHeader(TOR_SESSION, operation)).toBeUndefined();

    jar.storeSetCookie(
      TOR_SESSION,
      ZUPT_ROOT,
      "csrf_token=replace-me; Secure; HttpOnly; Path=/"
    );
    jar.storeSetCookie(
      TOR_SESSION,
      ZUPT_ROOT,
      "csrf_token=; Secure; HttpOnly; Path=/; Max-Age=0"
    );
    expect(jar.getCookieHeader(TOR_SESSION, ZUPT_ROOT)).toBeUndefined();
  });

  test("ignores unrelated, unsafe, and oversized cookies", () => {
    const jar = new EphemeralCsrfCookieJar({
      allowedOrigins: [ZUPT_ORIGIN],
      maxCookieBytes: 64,
    });

    jar.storeSetCookie(TOR_SESSION, ZUPT_ROOT, [
      "session=identity; Secure; Path=/",
      "csrf_token=bad\r\nInjected: yes; Secure; Path=/",
      `csrf_token=${"x".repeat(80)}; Secure; Path=/`,
      "csrf_token=script-readable; Secure; Path=/",
    ]);

    expect(jar.getCookieHeader(TOR_SESSION, ZUPT_ROOT)).toBeUndefined();
  });

  test("bounds sessions and evicts the least recently used", () => {
    const jar = new EphemeralCsrfCookieJar({
      allowedOrigins: [ZUPT_ORIGIN],
      maxSessions: 2,
    });
    const first = proxyCookieSessionKey("1".repeat(32), false);
    const second = proxyCookieSessionKey("2".repeat(32), false);
    const third = proxyCookieSessionKey("3".repeat(32), false);

    jar.storeSetCookie(
      first,
      ZUPT_ROOT,
      "csrf_token=first; Secure; HttpOnly; Path=/"
    );
    jar.storeSetCookie(
      second,
      ZUPT_ROOT,
      "csrf_token=second; Secure; HttpOnly; Path=/"
    );
    expect(jar.getCookieHeader(first, ZUPT_ROOT)).toBe("csrf_token=first");
    jar.storeSetCookie(
      third,
      ZUPT_ROOT,
      "csrf_token=third; Secure; HttpOnly; Path=/"
    );

    expect(jar.getCookieHeader(second, ZUPT_ROOT)).toBeUndefined();
    expect(jar.getCookieHeader(first, ZUPT_ROOT)).toBe("csrf_token=first");
    expect(jar.getCookieHeader(third, ZUPT_ROOT)).toBe("csrf_token=third");
  });

  test("enforces absolute lifetime and new-session admission limits", () => {
    let currentTime = 0;
    const jar = new EphemeralCsrfCookieJar({
      absoluteSessionTtlMs: 100,
      allowedOrigins: [ZUPT_ORIGIN],
      maxCookieTtlMs: 10_000,
      maxNewSessionsPerMinute: 1,
      now: () => currentTime,
      sessionTtlMs: 10_000,
    });
    const first = proxyCookieSessionKey("4".repeat(32), false);
    const second = proxyCookieSessionKey("5".repeat(32), false);
    const cookie = "csrf_token=bounded; Secure; HttpOnly; Path=/";

    jar.storeSetCookie(first, ZUPT_ROOT, cookie);
    jar.storeSetCookie(second, ZUPT_ROOT, cookie);
    expect(jar.getCookieHeader(first, ZUPT_ROOT)).toBe("csrf_token=bounded");
    expect(jar.getCookieHeader(second, ZUPT_ROOT)).toBeUndefined();

    currentTime = 100;
    expect(jar.getCookieHeader(first, ZUPT_ROOT)).toBeUndefined();

    currentTime = 60_000;
    jar.storeSetCookie(second, ZUPT_ROOT, cookie);
    expect(jar.getCookieHeader(second, ZUPT_ROOT)).toBe("csrf_token=bounded");
  });

  test("requires an exact lowercase 128-bit isolation token", () => {
    const jar = makeJar();
    const uppercase = proxyCookieSessionKey("A".repeat(32), false);
    const short = proxyCookieSessionKey("a".repeat(16), false);

    jar.storeSetCookie(
      uppercase,
      ZUPT_ROOT,
      "csrf_token=upper; Secure; HttpOnly; Path=/"
    );
    jar.storeSetCookie(
      short,
      ZUPT_ROOT,
      "csrf_token=short; Secure; HttpOnly; Path=/"
    );

    expect(jar.getCookieHeader(uppercase, ZUPT_ROOT)).toBeUndefined();
    expect(jar.getCookieHeader(short, ZUPT_ROOT)).toBeUndefined();
  });
});
