const { createHmac, randomBytes, timingSafeEqual } = require("crypto");

const CAPABILITY_VERSION = "v1";
const CAPABILITY_TTL_SECONDS = 12 * 60 * 60;
const CLOCK_SKEW_SECONDS = 30;
const ROUTES = new Set(["direct", "tor"]);
const PROFILES = new Set([
  "browser",
  "godseye",
  "irc",
  "keywave",
  "wiki",
  "zupt",
]);
const SCRIPT_POLICIES = new Set(["all", "noscript", "off"]);
const SECRET_KEY = Symbol.for("securityos.proxy-capability.secret");

const base64Url = (value) => Buffer.from(value).toString("base64url");

const capabilitySecret = () => {
  const processGlobal = globalThis;

  if (!processGlobal[SECRET_KEY]) {
    const configured = process.env.PROXY_CAPABILITY_SECRET;

    // A configured secret keeps capabilities valid across workers. A random,
    // process-local secret is the safe zero-configuration fallback: restarting the
    // service invalidates every outstanding bearer immediately.
    processGlobal[SECRET_KEY] =
      typeof configured === "string" && configured.length >= 32
        ? Buffer.from(configured)
        : randomBytes(32);
  }

  return processGlobal[SECRET_KEY];
};

const signatureFor = (version, payload) =>
  createHmac("sha256", capabilitySecret())
    .update(`${version}.${payload}`)
    .digest("base64url");

const issueProxyCapability = (
  route,
  { iso = "", profile = "browser", scriptPolicy = "all" } = {},
  now = Date.now()
) => {
  if (!ROUTES.has(route)) throw new TypeError("Unsupported proxy route");
  if (!PROFILES.has(profile)) throw new TypeError("Unsupported proxy profile");
  if (!SCRIPT_POLICIES.has(scriptPolicy)) {
    throw new TypeError("Unsupported script policy");
  }
  if (iso && !/^[\da-f]{32}$/.test(iso)) {
    throw new TypeError("Invalid isolation token");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = base64Url(
    JSON.stringify({
      exp: issuedAt + CAPABILITY_TTL_SECONDS,
      iat: issuedAt,
      iso,
      nonce: randomBytes(12).toString("base64url"),
      profile,
      route,
      scriptPolicy,
    })
  );

  return `${CAPABILITY_VERSION}.${payload}.${signatureFor(
    CAPABILITY_VERSION,
    payload
  )}`;
};

const readProxyCapability = (token, now = Date.now()) => {
  if (typeof token !== "string") return undefined;

  const parts = token.split(".");

  if (parts.length !== 3 || parts[0] !== CAPABILITY_VERSION) return undefined;

  const [version, encodedPayload, suppliedSignature] = parts;
  const expectedSignature = signatureFor(version, encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
    const nowSeconds = Math.floor(now / 1000);

    const valid =
      ROUTES.has(payload.route) &&
      PROFILES.has(payload.profile) &&
      SCRIPT_POLICIES.has(payload.scriptPolicy) &&
      (payload.iso === "" ||
        (typeof payload.iso === "string" &&
          /^[\da-f]{32}$/.test(payload.iso))) &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      typeof payload.nonce === "string" &&
      /^[A-Za-z0-9_-]{16}$/.test(payload.nonce) &&
      payload.iat <= nowSeconds + CLOCK_SKEW_SECONDS &&
      payload.exp >= nowSeconds - CLOCK_SKEW_SECONDS &&
      payload.exp - payload.iat === CAPABILITY_TTL_SECONDS;

    return valid ? payload : undefined;
  } catch {
    return undefined;
  }
};

const verifyProxyCapability = (
  token,
  expectedRoute,
  { iso, profile, scriptPolicy } = {},
  now = Date.now()
) => {
  if (!ROUTES.has(expectedRoute)) return false;

  const claims = readProxyCapability(token, now);

  return Boolean(
    claims &&
      claims.route === expectedRoute &&
      (profile === undefined || claims.profile === profile) &&
      (iso === undefined || claims.iso === iso) &&
      (scriptPolicy === undefined || claims.scriptPolicy === scriptPolicy)
  );
};

module.exports = {
  CAPABILITY_TTL_SECONDS,
  issueProxyCapability,
  readProxyCapability,
  verifyProxyCapability,
};
