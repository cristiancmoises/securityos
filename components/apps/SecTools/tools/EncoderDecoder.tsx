import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";

type Direction = "decode" | "encode";

type Format = "base64" | "base64url" | "hex" | "html" | "url";

const FORMATS: { label: string; value: Format }[] = [
  { label: "Base64", value: "base64" },
  { label: "Base64URL", value: "base64url" },
  { label: "Hex", value: "hex" },
  { label: "URL (encodeURIComponent)", value: "url" },
  { label: "HTML entities", value: "html" },
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const bytesToBinary = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return binary;
};

const binaryToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }

  return hex;
};

const hexToBytes = (input: string): Uint8Array => {
  const clean = input.replace(/[\s:-]/g, "").toLowerCase();
  if (clean.length === 0) {
    return new Uint8Array(0);
  }
  if (clean.length % 2 !== 0) {
    throw new Error("Hex input must have an even number of digits.");
  }
  if (!/^[0-9a-f]+$/.test(clean)) {
    throw new Error("Hex input contains non-hexadecimal characters.");
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
};

const base64ToBase64Url = (value: string): string =>
  value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const base64UrlToBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;

  return padding === 0 ? normalized : normalized + "=".repeat(4 - padding);
};

const HTML_NAMED: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

const encodeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const decodeHtml = (text: string): string =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        throw new Error(`Invalid numeric HTML entity: "${match}".`);
      }

      return String.fromCodePoint(code);
    }

    const named = HTML_NAMED[entity.toLowerCase()];
    if (named === undefined) {
      throw new Error(`Unknown HTML entity: "${match}".`);
    }

    return named;
  });

const encode = (text: string, format: Format): string => {
  if (format === "url") {
    return encodeURIComponent(text);
  }
  if (format === "html") {
    return encodeHtml(text);
  }

  const bytes = textEncoder.encode(text);
  if (format === "hex") {
    return bytesToHex(bytes);
  }

  const base64 = btoa(bytesToBinary(bytes));

  return format === "base64url" ? base64ToBase64Url(base64) : base64;
};

const decode = (text: string, format: Format): string => {
  if (format === "url") {
    try {
      return decodeURIComponent(text);
    } catch {
      throw new Error("Malformed URL-encoded input (bad % escape sequence).");
    }
  }
  if (format === "html") {
    return decodeHtml(text);
  }

  let bytes: Uint8Array;
  if (format === "hex") {
    bytes = hexToBytes(text);
  } else {
    const candidate =
      format === "base64url" ? base64UrlToBase64(text.trim()) : text.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(candidate)) {
      throw new Error("Input contains characters that are not valid Base64.");
    }
    try {
      bytes = binaryToBytes(atob(candidate));
    } catch {
      throw new Error("Malformed Base64 input (incorrect padding or length).");
    }
  }

  try {
    return textDecoder.decode(bytes);
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8 text.");
  }
};

const EncoderDecoderTool: FC = () => {
  const [copied, setCopied] = useState(false);
  const [direction, setDirection] = useState<Direction>("encode");
  const [format, setFormat] = useState<Format>("base64");
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (input.length === 0) {
      return { output: "", error: "" };
    }
    try {
      const output =
        direction === "encode"
          ? encode(input, format)
          : decode(input, format);

      return { output, error: "" };
    } catch (error) {
      return {
        output: "",
        error: error instanceof Error ? error.message : "Conversion failed.",
      };
    }
  }, [direction, format, input]);

  const handleCopy = useCallback(() => {
    if (result.output.length === 0) {
      return;
    }
    navigator.clipboard?.writeText(result.output).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => setCopied(false)
    );
  }, [result.output]);

  const handleSwap = useCallback(() => {
    if (result.output.length > 0) {
      setInput(result.output);
    }
    setDirection((current) => (current === "encode" ? "decode" : "encode"));
  }, [result.output]);

  return (
    <StyledTool>
      <h2>Encoder / Decoder</h2>
      <p className="desc">
        UTF-8 safe two-way conversion between text and Base64, Base64URL, Hex,
        URL-encoding, and HTML entities.
      </p>

      <div className="grid">
        <div>
          <label htmlFor="encdec-direction">Direction</label>
          <select
            id="encdec-direction"
            onChange={(event) => setDirection(event.target.value as Direction)}
            value={direction}
          >
            <option value="encode">Encode (text to format)</option>
            <option value="decode">Decode (format to text)</option>
          </select>
        </div>
        <div>
          <label htmlFor="encdec-format">Format</label>
          <select
            id="encdec-format"
            onChange={(event) => setFormat(event.target.value as Format)}
            value={format}
          >
            {FORMATS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="encdec-input">
          {direction === "encode" ? "Plain text" : "Encoded input"}
        </label>
        <textarea
          className={result.error ? "invalid" : undefined}
          id="encdec-input"
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            direction === "encode"
              ? "Type or paste text to encode…"
              : "Paste encoded data to decode…"
          }
          spellCheck={false}
          value={input}
        />
      </div>

      <div className="btn-row">
        <button
          disabled={result.output.length === 0}
          onClick={handleCopy}
          type="button"
        >
          {copied ? "Copied!" : "Copy output"}
        </button>
        <button className="secondary" onClick={handleSwap} type="button">
          Swap (use output as input)
        </button>
        <button
          className="secondary"
          onClick={() => {
            setInput("");
            setCopied(false);
          }}
          type="button"
        >
          Clear
        </button>
      </div>

      {result.error ? (
        <p className="error">{result.error}</p>
      ) : (
        <p className="muted">
          {input.length === 0
            ? "Output updates live as you type."
            : `${result.output.length} character${
                result.output.length === 1 ? "" : "s"
              } produced.`}
        </p>
      )}

      <label>Output</label>
      <pre className="output">{result.output || " "}</pre>
    </StyledTool>
  );
};

export default EncoderDecoderTool;
