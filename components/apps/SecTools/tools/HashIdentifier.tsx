import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

// A single candidate algorithm guess for a given input.
type Candidate = {
  confidence: "high" | "low" | "medium";
  name: string;
  note: string;
};

const HEX = /^[0-9a-f]+$/i;
const BASE64 = /^[0-9A-Za-z+/]+={0,2}$/;
const BASE64URL = /^[0-9A-Za-z_-]+={0,2}$/;
// Hex digests that contain at least one letter a-f are very likely hashes;
// pure-decimal strings of the same length are far more likely to be numbers.
const looksLikeHexDigest = (s: string): boolean => HEX.test(s) && /[a-f]/i.test(s);

// Confidence ordering used to keep the strongest guesses at the top.
const RANK: Record<Candidate["confidence"], number> = {
  high: 0,
  low: 2,
  medium: 1,
};

// Map of hex digest length -> the algorithms that emit that length.
const HEX_BY_LEN: Record<number, Array<Omit<Candidate, "confidence">>> = {
  8: [{ name: "CRC-32 / Adler-32", note: "8 hex chars (32-bit checksum, not cryptographic)" }],
  16: [{ name: "MySQL323 / CRC-64", note: "16 hex chars (legacy/short digest)" }],
  32: [
    { name: "MD5", note: "32 hex chars — most common 128-bit digest" },
    { name: "NTLM", note: "32 hex chars — MD4 of UTF-16LE password (Windows)" },
    { name: "MD4", note: "32 hex chars (rare, predecessor to MD5)" },
    { name: "LM (half)", note: "32 hex chars if two 16-char halves are joined" },
    { name: "RIPEMD-128 / Tiger-128", note: "32 hex chars (uncommon)" },
  ],
  40: [
    { name: "SHA-1", note: "40 hex chars — 160-bit digest" },
    { name: "RIPEMD-160", note: "40 hex chars (used in Bitcoin addresses)" },
    { name: "Tiger-160", note: "40 hex chars (uncommon)" },
  ],
  56: [
    { name: "SHA-224", note: "56 hex chars — 224-bit digest" },
    { name: "SHA3-224", note: "56 hex chars (Keccak family)" },
  ],
  64: [
    { name: "SHA-256", note: "64 hex chars — 256-bit digest" },
    { name: "SHA3-256", note: "64 hex chars (Keccak family)" },
    { name: "BLAKE2s-256", note: "64 hex chars (uncommon)" },
  ],
  96: [
    { name: "SHA-384", note: "96 hex chars — 384-bit digest" },
    { name: "SHA3-384", note: "96 hex chars (Keccak family)" },
  ],
  128: [
    { name: "SHA-512", note: "128 hex chars — 512-bit digest" },
    { name: "SHA3-512", note: "128 hex chars (Keccak family)" },
    { name: "BLAKE2b-512 / Whirlpool", note: "128 hex chars (uncommon)" },
  ],
};

// Pure logic: classify a string into a ranked list of likely algorithms.
// Exported intent is testability — no React, no I/O, deterministic output.
export const identifyHash = (raw: string): Candidate[] => {
  const input = raw.trim();
  if (!input) return [];

  const out: Candidate[] = [];
  const add = (c: Candidate): void => {
    out.push(c);
  };

  // --- Prefixed / modular-crypt formats (highest signal: explicit markers) ---
  if (input.startsWith("$")) {
    const id = input.slice(1).split("$", 1)[0];
    switch (id) {
      case "1":
        add({ confidence: "high", name: "md5crypt ($1$)", note: "Unix MD5-based crypt(3) hash" });
        break;
      case "2":
      case "2a":
      case "2b":
      case "2x":
      case "2y":
        add({
          confidence: "high",
          name: `bcrypt ($${id}$)`,
          note: "Blowfish-based; format $2x$cost$22-char-salt+31-char-hash",
        });
        break;
      case "5":
        add({ confidence: "high", name: "sha256crypt ($5$)", note: "Unix SHA-256-based crypt(3) hash" });
        break;
      case "6":
        add({ confidence: "high", name: "sha512crypt ($6$)", note: "Unix SHA-512-based crypt(3) hash" });
        break;
      case "argon2d":
      case "argon2i":
      case "argon2id":
        add({
          confidence: "high",
          name: `Argon2 ($${id}$)`,
          note: "Memory-hard PHC password hash (PHC string format)",
        });
        break;
      case "pbkdf2":
      case "pbkdf2-sha256":
      case "pbkdf2-sha512":
        add({ confidence: "high", name: `PBKDF2 ($${id}$)`, note: "Iterated HMAC password hash (PHC format)" });
        break;
      case "scrypt":
      case "7":
        add({ confidence: "high", name: "scrypt", note: "Memory-hard password hash" });
        break;
      case "y":
        add({ confidence: "high", name: "yescrypt ($y$)", note: "Modern crypt(3) default on many Linux distros" });
        break;
      case "sha1":
        add({ confidence: "high", name: "sha1crypt ($sha1$)", note: "NetBSD SHA-1-based crypt" });
        break;
      case "apr1":
        add({ confidence: "high", name: "Apache MD5 (apr1)", note: "Apache htpasswd MD5 variant" });
        break;
      default:
        add({
          confidence: "medium",
          name: `Modular crypt ($${id}$)`,
          note: "Unrecognized crypt(3)/PHC identifier — likely a password hash",
        });
    }
    return sortCandidates(out);
  }

  // --- LDAP / scheme-tagged hashes ({SSHA}, {CRYPT}, ...) ---
  const ldap = input.match(/^\{([A-Za-z0-9]+)\}/);
  if (ldap) {
    add({
      confidence: "high",
      name: `LDAP ${ldap[1].toUpperCase()} scheme`,
      note: "RFC 2307 userPassword; body is base64-encoded digest (+salt)",
    });
    return sortCandidates(out);
  }

  // --- Hex digests (length + charset) ---
  if (HEX.test(input)) {
    const len = input.length;
    const isDigest = looksLikeHexDigest(input);
    const matches = HEX_BY_LEN[len];

    if (matches) {
      matches.forEach((m, i) => {
        // First entry per length is the dominant guess; demote when the string
        // is all digits (could just be a decimal number, not a hash).
        const base: Candidate["confidence"] = i === 0 ? "high" : "medium";
        add({
          confidence: isDigest ? base : "low",
          name: m.name,
          note: isDigest ? m.note : `${m.note} — all-numeric, may not be a hash`,
        });
      });
    } else if (len % 2 === 0 && len >= 4) {
      add({
        confidence: "low",
        name: `Hex string (${len} chars, ${len * 4}-bit)`,
        note: "Even-length hex with no standard digest match",
      });
    } else {
      add({ confidence: "low", name: `Hex string (${len} chars)`, note: "Odd length — not a standard digest" });
    }
    // Even hex strings are also syntactically valid base64-ish; note it last.
    if (BASE64.test(input) && len % 4 === 0) {
      add({ confidence: "low", name: "Base64", note: "Also decodes as base64, but hex interpretation is likelier" });
    }
    return sortCandidates(out);
  }

  // --- Base64 / Base64URL looking blobs ---
  const isB64 = BASE64.test(input);
  const isB64Url = !isB64 && BASE64URL.test(input);
  if (isB64 || isB64Url) {
    const padOk = isB64 ? input.length % 4 === 0 : true;
    const decodedBytes = estimateBase64Bytes(input);
    add({
      confidence: padOk ? "medium" : "low",
      name: isB64Url ? "Base64URL" : "Base64",
      note: `~${decodedBytes}-byte payload${padOk ? "" : " (length not a multiple of 4)"}`,
    });
    // Bare 22-char base64 with no padding is the bcrypt salt/hash alphabet too,
    // and 28/44/88 are the classic encoded SHA-1/256/512 lengths.
    const lenMap: Record<number, string> = {
      24: "encoded 16-byte value (MD5/NTLM digest, base64)",
      28: "encoded 20-byte value (SHA-1 digest, base64)",
      44: "encoded 32-byte value (SHA-256 digest, base64)",
      88: "encoded 64-byte value (SHA-512 digest, base64)",
    };
    if (lenMap[input.length]) {
      add({ confidence: "medium", name: "Base64-encoded digest", note: lenMap[input.length] });
    }
    return sortCandidates(out);
  }

  // --- Fallback ---
  add({
    confidence: "low",
    name: "Unknown",
    note: "No length/charset/prefix pattern matched (contains non-hex, non-base64 characters)",
  });
  return sortCandidates(out);
};

// Stable sort: by confidence rank, then preserve insertion order.
const sortCandidates = (list: Candidate[]): Candidate[] =>
  list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => RANK[a.c.confidence] - RANK[b.c.confidence] || a.i - b.i)
    .map((x) => x.c);

// Rough decoded-byte count for a base64 string (ignores stray chars gracefully).
const estimateBase64Bytes = (s: string): number => {
  const clean = s.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
};

const Badge = styled.span<{ $level: Candidate["confidence"] }>`
  background: ${({ $level }) => ($level === "high" ? "#2f5d3a" : $level === "medium" ? "#5d532f" : "#3a2f4a")};
  border-radius: 4px;
  color: ${({ $level }) => ($level === "high" ? "#7ed492" : $level === "medium" ? "#e3d27e" : "#ab9cbb")};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  text-transform: uppercase;
`;

const Row = styled.div`
  align-items: baseline;
  border-bottom: 1px solid #2f2740;
  display: flex;
  gap: 10px;
  padding: 8px 0;

  &:last-child {
    border-bottom: none;
  }

  .name {
    font-weight: 600;
    min-width: 150px;
  }

  .note {
    color: #ab9cbb;
    flex: 1;
  }
`;

const SAMPLES: Array<{ label: string; value: string }> = [
  { label: "MD5", value: "5f4dcc3b5aa765d61d8327deb882cf99" },
  { label: "SHA-1", value: "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8" },
  { label: "SHA-256", value: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" },
  { label: "bcrypt", value: "$2b$12$KIXQ0Z1Z5z5z5z5z5z5z5uPq6q6q6q6q6q6q6q6q6q6q6q6q6q6q" },
  { label: "Argon2", value: "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG" },
  { label: "sha512crypt", value: "$6$rounds=5000$saltsalt$hashhashhash" },
];

const HashIdentifierTool: FC = () => {
  const [value, setValue] = useState("");

  const candidates = useMemo(() => {
    try {
      return identifyHash(value);
    } catch {
      return [];
    }
  }, [value]);

  const trimmed = value.trim();
  const charset = useMemo(() => {
    if (!trimmed) return "";
    if (trimmed.startsWith("$") || trimmed.startsWith("{")) return "prefixed (modular crypt / scheme)";
    if (HEX.test(trimmed)) return "hexadecimal";
    if (BASE64.test(trimmed)) return "base64";
    if (BASE64URL.test(trimmed)) return "base64url";
    return "mixed / other";
  }, [trimmed]);

  const onClear = useCallback(() => setValue(""), []);

  return (
    <StyledTool>
      <h2>Hash Identifier</h2>
      <p className="desc">Guess the algorithm behind a hash from its length, charset, and prefix — fully offline.</p>

      <div>
        <label htmlFor="hashid-input">Hash or encoded string</label>
        <textarea
          id="hashid-input"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a hash, e.g. 5f4dcc3b5aa765d61d8327deb882cf99"
          spellCheck={false}
          value={value}
        />
      </div>

      <div className="btn-row">
        <button className="secondary" disabled={!value} onClick={onClear} type="button">
          Clear
        </button>
        {SAMPLES.map((s) => (
          <button className="secondary" key={s.label} onClick={() => setValue(s.value)} type="button">
            {s.label}
          </button>
        ))}
      </div>

      {trimmed ? (
        <p className="muted">
          Length: <code>{trimmed.length}</code> &nbsp;|&nbsp; Charset: <code>{charset}</code>
        </p>
      ) : (
        <p className="muted">Enter a value to see candidate algorithms. Identification is heuristic, not proof.</p>
      )}

      {trimmed && candidates.length === 0 ? <p className="error">Could not analyze the input.</p> : null}

      {candidates.length > 0 ? (
        <div>
          {candidates.map((c, i) => (
            <Row key={`${c.name}-${i}`}>
              <Badge $level={c.confidence}>{c.confidence}</Badge>
              <span className="name">{c.name}</span>
              <span className="note">{c.note}</span>
            </Row>
          ))}
        </div>
      ) : null}
    </StyledTool>
  );
};

export default HashIdentifierTool;
