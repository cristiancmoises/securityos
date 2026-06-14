import StyledTool from "components/apps/SecTools/StyledTool";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

type ClaimRow = {
  iso: string;
  label: string;
  raw: number;
  relative: string;
};

type DecodedPart = {
  json: string;
  obj: Record<string, unknown> | null;
};

type Decoded = {
  claims: ClaimRow[];
  error: string;
  expired: boolean | null;
  header: DecodedPart;
  payload: DecodedPart;
  signature: string;
  signingInput: string;
};

type VerifyState = {
  algMismatch: boolean;
  status: "idle" | "checking" | "valid" | "invalid" | "error";
  message: string;
};

const TIME_CLAIMS: Array<{ key: string; label: string }> = [
  { key: "iat", label: "Issued at (iat)" },
  { key: "nbf", label: "Not before (nbf)" },
  { key: "exp", label: "Expires (exp)" },
];

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  .parts {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
  }

  .badges {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .badge {
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
  }

  .badge.alg {
    background: #2f2740;
    color: #d7c2ec;
  }

  .badge.valid {
    background: #1d3a26;
    color: #7ed492;
  }

  .badge.expired {
    background: #3a1d1d;
    color: #f0908d;
  }

  table.claims {
    border-collapse: collapse;
    font-size: 12px;
    width: 100%;
  }

  table.claims th,
  table.claims td {
    border-bottom: 1px solid #2f2740;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }

  table.claims th {
    color: #ab9cbb;
    font-weight: 600;
  }

  table.claims td.mono {
    font-family: "Cascadia Code", "Consolas", monospace;
  }

  @media (max-width: 560px) {
    .parts {
      grid-template-columns: 1fr;
    }
  }
`;

// Base64url -> bytes. Restores standard alphabet and padding, then decodes the
// binary string produced by atob into a Uint8Array. Throws on invalid input so
// callers can present a friendly message.
const base64UrlToBytes = (input: string): Uint8Array => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) {
    throw new Error("not base64url");
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

// Decode a base64url segment as UTF-8 text (handles multibyte safely).
const base64UrlToText = (input: string): string =>
  new TextDecoder("utf-8", { fatal: false }).decode(base64UrlToBytes(input));

const prettyJson = (raw: string): DecodedPart => {
  try {
    const obj = JSON.parse(raw) as unknown;

    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      // Valid JSON but not a JOSE object; still show it formatted.
      return { json: JSON.stringify(obj, null, 2), obj: null };
    }

    return {
      json: JSON.stringify(obj, null, 2),
      obj: obj as Record<string, unknown>,
    };
  } catch {
    return { json: raw, obj: null };
  }
};

const formatRelative = (deltaSeconds: number): string => {
  const abs = Math.abs(deltaSeconds);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [2592000, "day"],
    [31536000, "month"],
    [Infinity, "year"],
  ];
  const divisors: Record<string, number> = {
    day: 86400,
    hour: 3600,
    minute: 60,
    month: 2592000,
    second: 1,
    year: 31536000,
  };

  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [threshold, candidate] of units) {
    if (abs < threshold) {
      unit = candidate;
      break;
    }
  }

  try {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const value = Math.round(deltaSeconds / divisors[unit]);

    return rtf.format(value, unit);
  } catch {
    return deltaSeconds >= 0
      ? `in ${abs}s`
      : `${abs}s ago`;
  }
};

const buildClaims = (
  payload: Record<string, unknown> | null,
  nowSeconds: number
): ClaimRow[] => {
  if (!payload) {
    return [];
  }

  const rows: ClaimRow[] = [];
  for (const { key, label } of TIME_CLAIMS) {
    const value = payload[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    let iso = "invalid timestamp";
    try {
      const date = new Date(value * 1000);
      iso = Number.isNaN(date.getTime())
        ? "invalid timestamp"
        : date.toISOString().replace(".000Z", "Z");
    } catch {
      iso = "invalid timestamp";
    }

    rows.push({
      iso,
      label,
      raw: value,
      relative: formatRelative(value - nowSeconds),
    });
  }

  return rows;
};

// Constant-time comparison over two byte arrays to avoid leaking, via timing,
// how many leading bytes of a signature matched.
const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
};

const decodeToken = (token: string, nowSeconds: number): Decoded => {
  const empty: Decoded = {
    claims: [],
    error: "",
    expired: null,
    header: { json: "", obj: null },
    payload: { json: "", obj: null },
    signature: "",
    signingInput: "",
  };

  const trimmed = token.trim();
  if (!trimmed) {
    return empty;
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return {
      ...empty,
      error: `Expected 3 dot-separated segments, found ${parts.length}. A JWT looks like header.payload.signature.`,
    };
  }

  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let headerText: string;
  let payloadText: string;
  try {
    headerText = base64UrlToText(headerSeg);
  } catch {
    return { ...empty, error: "Header segment is not valid base64url." };
  }

  try {
    payloadText = base64UrlToText(payloadSeg);
  } catch {
    return { ...empty, error: "Payload segment is not valid base64url." };
  }

  const header = prettyJson(headerText);
  const payload = prettyJson(payloadText);

  const expRaw = payload.obj?.exp;
  let expired: boolean | null = null;
  if (typeof expRaw === "number" && Number.isFinite(expRaw)) {
    expired = nowSeconds >= expRaw;
  }

  return {
    claims: buildClaims(payload.obj, nowSeconds),
    error: "",
    expired,
    header,
    payload,
    signature: signatureSeg,
    signingInput: `${headerSeg}.${payloadSeg}`,
  };
};

const JwtDecoderTool: FC = () => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [verify, setVerify] = useState<VerifyState>({
    algMismatch: false,
    message: "",
    status: "idle",
  });

  // Refresh "now" each second so relative times and the expiry badge stay live.
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    );

    return () => window.clearInterval(id);
  }, []);

  const decoded = useMemo(() => decodeToken(token, now), [now, token]);

  const headerAlg = useMemo(() => {
    const alg = decoded.header.obj?.alg;

    return typeof alg === "string" ? alg : "";
  }, [decoded.header.obj]);

  const typ = useMemo(() => {
    const value = decoded.header.obj?.typ;

    return typeof value === "string" ? value : "";
  }, [decoded.header.obj]);

  // Recompute the HMAC-SHA256 signature whenever the signing input, the secret,
  // or the parsed token changes, then constant-time compare to the supplied
  // signature. Only meaningful for HS256 tokens.
  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      if (decoded.error || !decoded.signingInput || !secret) {
        if (!cancelled) {
          setVerify({ algMismatch: false, message: "", status: "idle" });
        }

        return;
      }

      const algMismatch = headerAlg !== "" && headerAlg !== "HS256";

      if (typeof crypto === "undefined" || !crypto.subtle) {
        if (!cancelled) {
          setVerify({
            algMismatch,
            message: "Web Crypto API is unavailable in this context.",
            status: "error",
          });
        }

        return;
      }

      if (!cancelled) {
        setVerify((prev) => ({ ...prev, algMismatch, status: "checking" }));
      }

      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          { hash: "SHA-256", name: "HMAC" },
          false,
          ["sign"]
        );
        const computed = new Uint8Array(
          await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(decoded.signingInput)
          )
        );

        let provided: Uint8Array;
        try {
          provided = base64UrlToBytes(decoded.signature);
        } catch {
          if (!cancelled) {
            setVerify({
              algMismatch,
              message: "Signature segment is not valid base64url.",
              status: "error",
            });
          }

          return;
        }

        const matches = constantTimeEqual(computed, provided);

        if (!cancelled) {
          setVerify({
            algMismatch,
            message: matches
              ? "Signature is valid — the token was signed with this secret."
              : "Signature does NOT match this secret.",
            status: matches ? "valid" : "invalid",
          });
        }
      } catch {
        if (!cancelled) {
          setVerify({
            algMismatch,
            message: "Could not compute the HMAC for verification.",
            status: "error",
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [decoded.error, decoded.signature, decoded.signingInput, headerAlg, secret]);

  const hasToken = token.trim().length > 0;

  return (
    <StyledTool>
      <h2>JWT Decoder</h2>
      <p className="desc">
        Decode a JSON Web Token&apos;s header and payload, inspect standard time
        claims, and optionally verify an HS256 signature — all offline.
      </p>

      <Layout>
        <div>
          <label htmlFor="jwt-token">Token</label>
          <textarea
            id="jwt-token"
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste a JWT: header.payload.signature"
            spellCheck={false}
            value={token}
          />
        </div>

        {decoded.error ? (
          <p className="error">{decoded.error}</p>
        ) : undefined}

        {hasToken && !decoded.error ? (
          <>
            <div className="badges">
              {headerAlg ? (
                <span className="badge alg">alg: {headerAlg}</span>
              ) : undefined}
              {typ ? <span className="badge alg">typ: {typ}</span> : undefined}
              {decoded.expired === true ? (
                <span className="badge expired">EXPIRED</span>
              ) : undefined}
              {decoded.expired === false ? (
                <span className="badge valid">NOT EXPIRED</span>
              ) : undefined}
              {decoded.expired === null ? (
                <span className="muted">no exp claim</span>
              ) : undefined}
            </div>

            <div className="parts">
              <div>
                <label>Header</label>
                <pre className="output">{decoded.header.json}</pre>
              </div>
              <div>
                <label>Payload</label>
                <pre className="output">{decoded.payload.json}</pre>
              </div>
            </div>

            {decoded.claims.length > 0 ? (
              <div>
                <label>Standard time claims (UTC)</label>
                <table className="claims">
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>UTC</th>
                      <th>Relative</th>
                      <th>Epoch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decoded.claims.map((claim) => (
                      <tr key={claim.label}>
                        <td>{claim.label}</td>
                        <td className="mono">{claim.iso}</td>
                        <td>{claim.relative}</td>
                        <td className="mono">{claim.raw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No standard iat/nbf/exp time claims present in the payload.
              </p>
            )}

            <div>
              <label htmlFor="jwt-secret">
                HS256 secret (optional — verify signature)
              </label>
              <input
                autoComplete="off"
                id="jwt-secret"
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Enter the shared secret to verify the signature"
                type="password"
                value={secret}
              />

              {secret && verify.algMismatch ? (
                <p className="muted">
                  Token header says <code>alg: {headerAlg || "?"}</code>, not
                  HS256. Verification below assumes HMAC-SHA256 and will only be
                  meaningful for HS256 tokens.
                </p>
              ) : undefined}

              {verify.status === "checking" ? (
                <p className="muted">Verifying…</p>
              ) : undefined}
              {verify.status === "valid" ? (
                <p className="ok">{verify.message}</p>
              ) : undefined}
              {verify.status === "invalid" ? (
                <p className="error">{verify.message}</p>
              ) : undefined}
              {verify.status === "error" ? (
                <p className="error">{verify.message}</p>
              ) : undefined}
            </div>
          </>
        ) : undefined}

        {!hasToken ? (
          <p className="muted">Paste a token above to decode it.</p>
        ) : undefined}
      </Layout>
    </StyledTool>
  );
};

export default JwtDecoderTool;
