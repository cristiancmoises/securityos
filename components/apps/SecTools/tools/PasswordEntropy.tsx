import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

const Local = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  section {
    border-top: 1px solid #2f2740;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
  }

  h3 {
    color: #c9b8da;
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }

  .show-toggle {
    background: #2f2740;
    flex: 0 0 auto;
    padding: 6px 10px;
  }

  .pw-field {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .pw-field input {
    flex: 1 1 auto;
  }

  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .checks label {
    align-items: center;
    cursor: pointer;
    display: flex;
    font-weight: 500;
    gap: 6px;
    margin: 0;
  }

  .checks input[type="checkbox"] {
    cursor: pointer;
    height: 14px;
    margin: 0;
    width: 14px;
  }

  .stats {
    display: grid;
    gap: 4px 14px;
    grid-template-columns: auto 1fr;
  }

  .stats dt {
    color: #ab9cbb;
  }

  .stats dd {
    margin: 0;
    word-break: break-all;
  }

  .rating {
    font-weight: 600;
  }
`;

type CharsetFlag = {
  count: number;
  label: string;
  present: boolean;
};

type Analysis = {
  charsetSize: number;
  charsets: CharsetFlag[];
  crackTime: string;
  entropy: number;
  guesses: bigint;
  length: number;
  rating: string;
  ratingColor: string;
  ratingPct: number;
};

const GUESSES_PER_SECOND = 1e10;

const ASCII_LOWER = "abcdefghijklmnopqrstuvwxyz";
const ASCII_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ASCII_DIGITS = "0123456789";
const ASCII_SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>/?\\|`~'\" ";

// Count grapheme-ish code points (handles surrogate pairs / emoji).
const codePoints = (text: string): string[] => Array.from(text);

const analyze = (password: string): Analysis => {
  const chars = codePoints(password);
  const length = chars.length;

  let hasLower = false;
  let hasUpper = false;
  let hasDigit = false;
  let hasSymbol = false;
  let hasUnicode = false;

  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;

    if (cp > 127) {
      hasUnicode = true;
    } else if (ch >= "a" && ch <= "z") {
      hasLower = true;
    } else if (ch >= "A" && ch <= "Z") {
      hasUpper = true;
    } else if (ch >= "0" && ch <= "9") {
      hasDigit = true;
    } else {
      hasSymbol = true;
    }
  }

  const charsets: CharsetFlag[] = [
    { count: 26, label: "Lowercase (a-z)", present: hasLower },
    { count: 26, label: "Uppercase (A-Z)", present: hasUpper },
    { count: 10, label: "Digits (0-9)", present: hasDigit },
    { count: 33, label: "Symbols", present: hasSymbol },
    // Conservative Unicode pool estimate (printable BMP-ish). Avoids wildly
    // overstating entropy from a single exotic glyph.
    { count: 100, label: "Unicode / other", present: hasUnicode },
  ];

  const charsetSize = charsets.reduce(
    (sum, set) => sum + (set.present ? set.count : 0),
    0
  );

  const entropy =
    charsetSize > 0 && length > 0 ? length * Math.log2(charsetSize) : 0;

  // Total search space = charsetSize ** length, using BigInt for exactness on
  // huge values. Expected guesses to crack ~= half the space.
  let guesses = 0n;

  if (charsetSize > 0 && length > 0) {
    const space = BigInt(charsetSize) ** BigInt(length);
    guesses = space / 2n;
  }

  const { color, pct, rating } = rate(entropy, length);

  return {
    charsetSize,
    charsets,
    crackTime: formatCrackTime(guesses),
    entropy,
    guesses,
    length,
    rating,
    ratingColor: color,
    ratingPct: pct,
  };
};

const rate = (
  entropy: number,
  length: number
): { color: string; pct: number; rating: string } => {
  if (length === 0) {
    return { color: "#4a3a5c", pct: 0, rating: "No input" };
  }
  if (entropy < 28) {
    return { color: "#d9534f", pct: 18, rating: "Very weak" };
  }
  if (entropy < 36) {
    return { color: "#e8743b", pct: 38, rating: "Weak" };
  }
  if (entropy < 60) {
    return { color: "#e3c93b", pct: 58, rating: "Reasonable" };
  }
  if (entropy < 128) {
    return { color: "#86c44a", pct: 80, rating: "Strong" };
  }

  return { color: "#3bb273", pct: 100, rating: "Very strong" };
};

// Format expected seconds-to-crack (guesses / rate) into a human string.
const formatCrackTime = (guesses: bigint): string => {
  if (guesses <= 0n) {
    return "instantly";
  }

  // seconds = guesses / GUESSES_PER_SECOND. Keep precision with BigInt then
  // fall back to Number once the magnitude is sane.
  const rate = BigInt(GUESSES_PER_SECOND);
  const wholeSeconds = guesses / rate;

  if (wholeSeconds < 1n) {
    return "less than a second";
  }

  const units: { label: string; secs: number }[] = [
    { label: "year", secs: 31_557_600 },
    { label: "day", secs: 86_400 },
    { label: "hour", secs: 3_600 },
    { label: "minute", secs: 60 },
    { label: "second", secs: 1 },
  ];

  // Years can dwarf Number range; report magnitude in years with scientific
  // notation when the value is astronomically large.
  const yearsBig = wholeSeconds / 31_557_600n;

  if (yearsBig > 1_000_000_000n) {
    const years = Number(wholeSeconds) / 31_557_600;
    if (!Number.isFinite(years)) {
      const digits = guesses.toString().length;
      return `~10^${digits - 1} guesses (longer than the age of the universe)`;
    }
    return `${years.toExponential(2)} years (effectively uncrackable)`;
  }

  const seconds = Number(wholeSeconds);
  for (const { label, secs } of units) {
    if (seconds >= secs) {
      const value = Math.floor(seconds / secs);
      return `${value.toLocaleString()} ${label}${value === 1 ? "" : "s"}`;
    }
  }

  return "less than a second";
};

// Unbiased random integer in [0, max) via rejection sampling on a 32-bit pool.
const randomIndex = (max: number): number => {
  if (max <= 0) {
    return 0;
  }

  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);

  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    [value] = buffer;
  } while (value >= limit);

  return value % max;
};

const PasswordEntropyTool: FC = () => {
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);

  const [length, setLength] = useState(20);
  const [useLower, setUseLower] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [generated, setGenerated] = useState("");
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  const analysis = useMemo(() => analyze(password), [password]);

  const handleGenerate = useCallback(() => {
    setCopied(false);

    if (!Number.isFinite(length) || length < 1 || length > 256) {
      setGenError("Length must be a whole number between 1 and 256.");
      setGenerated("");
      return;
    }

    let pool = "";
    if (useLower) pool += ASCII_LOWER;
    if (useUpper) pool += ASCII_UPPER;
    if (useDigits) pool += ASCII_DIGITS;
    if (useSymbols) pool += ASCII_SYMBOLS;

    if (pool.length === 0) {
      setGenError("Select at least one character set.");
      setGenerated("");
      return;
    }

    setGenError("");

    const len = Math.floor(length);
    const out: string[] = new Array(len);
    for (let i = 0; i < len; i += 1) {
      out[i] = pool[randomIndex(pool.length)];
    }

    setGenerated(out.join(""));
  }, [length, useDigits, useLower, useSymbols, useUpper]);

  const handleCopy = useCallback(async () => {
    if (!generated) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
    } catch {
      setCopied(false);
      setGenError("Clipboard unavailable — copy the value manually.");
    }
  }, [generated]);

  const useGenerated = useCallback(() => {
    if (generated) {
      setPassword(generated);
    }
  }, [generated]);

  return (
    <StyledTool>
      <h2>Password Strength &amp; Generator</h2>
      <p className="desc">
        Estimate password entropy and offline crack time, or generate
        cryptographically random passwords — all fully offline.
      </p>

      <Local>
        <section>
          <h3>Analyzer</h3>
          <label htmlFor="pw-input">Password to analyze</label>
          <div className="pw-field">
            <input
              autoComplete="off"
              id="pw-input"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Type or paste a password"
              spellCheck={false}
              type={reveal ? "text" : "password"}
              value={password}
            />
            <button
              className="show-toggle"
              onClick={() => setReveal((v) => !v)}
              type="button"
            >
              {reveal ? "Hide" : "Show"}
            </button>
          </div>

          <div className="bar" title={`${analysis.ratingPct}%`}>
            <span
              style={{
                background: analysis.ratingColor,
                width: `${analysis.ratingPct}%`,
              }}
            />
          </div>
          <div className="rating" style={{ color: analysis.ratingColor }}>
            {analysis.rating}
          </div>

          <dl className="stats">
            <dt>Length</dt>
            <dd>{analysis.length} characters</dd>
            <dt>Charset size</dt>
            <dd>{analysis.charsetSize}</dd>
            <dt>Entropy</dt>
            <dd>{analysis.entropy.toFixed(2)} bits</dd>
            <dt>Crack time</dt>
            <dd>
              {analysis.crackTime}
              <span className="muted"> @ 10^10 guesses/sec</span>
            </dd>
          </dl>

          <div className="muted">
            Character classes detected:{" "}
            {analysis.charsets.filter((c) => c.present).length === 0
              ? "none"
              : analysis.charsets
                  .filter((c) => c.present)
                  .map((c) => c.label)
                  .join(", ")}
          </div>
        </section>

        <section>
          <h3>Generator</h3>
          <div className="grid">
            <div>
              <label htmlFor="gen-length">Length</label>
              <input
                id="gen-length"
                max={256}
                min={1}
                onChange={(e) => setLength(e.target.valueAsNumber)}
                type="number"
                value={Number.isNaN(length) ? "" : length}
              />
            </div>
            <div>
              <label>Character sets</label>
              <div className="checks">
                <label>
                  <input
                    checked={useLower}
                    onChange={(e) => setUseLower(e.target.checked)}
                    type="checkbox"
                  />
                  a-z
                </label>
                <label>
                  <input
                    checked={useUpper}
                    onChange={(e) => setUseUpper(e.target.checked)}
                    type="checkbox"
                  />
                  A-Z
                </label>
                <label>
                  <input
                    checked={useDigits}
                    onChange={(e) => setUseDigits(e.target.checked)}
                    type="checkbox"
                  />
                  0-9
                </label>
                <label>
                  <input
                    checked={useSymbols}
                    onChange={(e) => setUseSymbols(e.target.checked)}
                    type="checkbox"
                  />
                  symbols
                </label>
              </div>
            </div>
          </div>

          <div className="btn-row">
            <button onClick={handleGenerate} type="button">
              Generate
            </button>
            <button
              className="secondary"
              disabled={!generated}
              onClick={handleCopy}
              type="button"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              className="secondary"
              disabled={!generated}
              onClick={useGenerated}
              type="button"
            >
              Analyze this
            </button>
          </div>

          {genError ? <div className="error">{genError}</div> : null}
          {generated ? <pre className="output">{generated}</pre> : null}
        </section>
      </Local>
    </StyledTool>
  );
};

export default PasswordEntropyTool;
