import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

type Cipher = "atbash" | "caesar" | "morse" | "rot13" | "xor";
type Direction = "decode" | "encode";

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  button {
    background: #2f2740;
  }

  button.active {
    background: #7d4eaf;
  }
`;

const MORSE: Record<string, string> = {
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  a: ".-",
  b: "-...",
  c: "-.-.",
  d: "-..",
  e: ".",
  f: "..-.",
  g: "--.",
  h: "....",
  i: "..",
  j: ".---",
  k: "-.-",
  l: ".-..",
  m: "--",
  n: "-.",
  o: "---",
  p: ".--.",
  q: "--.-",
  r: ".-.",
  s: "...",
  t: "-",
  u: "..-",
  v: "...-",
  w: ".--",
  x: "-..-",
  y: "-.--",
  z: "--..",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
};

const MORSE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([char, code]) => [code, char])
);

const shiftChar = (code: number, base: number, shift: number): string =>
  String.fromCharCode(base + (((code - base + shift) % 26) + 26) % 26);

const caesar = (text: string, shift: number): string => {
  const normalized = ((Math.trunc(shift) % 26) + 26) % 26;

  return text.replace(/[a-z]/gi, (char) => {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90) return shiftChar(code, 65, normalized);

    return shiftChar(code, 97, normalized);
  });
};

const rot13 = (text: string): string => caesar(text, 13);

const atbash = (text: string): string =>
  text.replace(/[a-z]/gi, (char) => {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90) return String.fromCharCode(90 - (code - 65));

    return String.fromCharCode(122 - (code - 97));
  });

const HEX_RE = /^[0-9a-f]*$/i;

// Parse the XOR key into bytes. A "text" key uses its UTF-8 bytes; a "hex" key
// is read as pairs of hex digits.
const parseKey = (key: string, asHex: boolean): Uint8Array => {
  if (!asHex) return new TextEncoder().encode(key);

  const clean = key.replace(/\s+/g, "");

  if (clean.length === 0) return new Uint8Array();
  if (clean.length % 2 !== 0) throw new Error("Hex key needs an even number of digits.");
  if (!HEX_RE.test(clean)) throw new Error("Hex key contains non-hex characters.");

  const bytes = new Uint8Array(clean.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/\s+/g, "");

  if (clean.length === 0) return new Uint8Array();
  if (clean.length % 2 !== 0) throw new Error("Hex input needs an even number of digits.");
  if (!HEX_RE.test(clean)) throw new Error("Hex input contains non-hex characters.");

  const bytes = new Uint8Array(clean.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
};

const xorBytes = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const out = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ key[i % key.length];
  }

  return out;
};

// Encode: input is UTF-8 text, output is hex of XORed bytes.
// Decode: input is hex of XORed bytes, output is the recovered UTF-8 text.
const xor = (text: string, key: string, keyAsHex: boolean, dir: Direction): string => {
  const keyBytes = parseKey(key, keyAsHex);

  if (keyBytes.length === 0) throw new Error("XOR key cannot be empty.");

  if (dir === "encode") {
    const data = new TextEncoder().encode(text);

    return bytesToHex(xorBytes(data, keyBytes));
  }

  const data = hexToBytes(text);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(xorBytes(data, keyBytes));

  return decoded;
};

const morse = (text: string, dir: Direction): string => {
  if (dir === "encode") {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) =>
        Array.from(word)
          .map((char) => MORSE[char.toLowerCase()] ?? "#")
          .join(" ")
      )
      .join(" / ");
  }

  return text
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map((token) => MORSE_REVERSE[token] ?? "#")
        .join("")
    )
    .join(" ")
    .trim();
};

const DESCRIPTIONS: Record<Cipher, string> = {
  atbash: "Mirror the alphabet (a<->z, b<->y). Self-inverse; non-letters untouched.",
  caesar: "Shift letters by N positions, wrapping a-z / A-Z. Non-letters untouched.",
  morse: "Text <-> Morse. Letters split by spaces, words by ' / '.",
  rot13: "Caesar with a fixed shift of 13. Apply twice to recover the original.",
  xor: "XOR bytes against a repeating key. Output/input use hex.",
};

const CipherPlaygroundTool: FC = () => {
  const [cipher, setCipher] = useState<Cipher>("rot13");
  const [direction, setDirection] = useState<Direction>("encode");
  const [input, setInput] = useState("");
  const [shift, setShift] = useState("3");
  const [xorKey, setXorKey] = useState("secret");
  const [keyAsHex, setKeyAsHex] = useState(false);
  const [copied, setCopied] = useState(false);

  const bidirectional = cipher === "xor" || cipher === "morse";

  const { output, error } = useMemo<{ error: string; output: string }>(() => {
    try {
      switch (cipher) {
        case "atbash":
          return { error: "", output: atbash(input) };
        case "caesar": {
          const parsed = Number(shift);

          if (shift.trim() === "" || !Number.isFinite(parsed)) {
            return { error: "Enter a valid numeric shift.", output: "" };
          }

          return { error: "", output: caesar(input, parsed) };
        }
        case "morse":
          return { error: "", output: morse(input, direction) };
        case "rot13":
          return { error: "", output: rot13(input) };
        case "xor":
          return { error: "", output: xor(input, xorKey, keyAsHex, direction) };
        default:
          return { error: "Unknown cipher.", output: "" };
      }
    } catch (caught) {
      return {
        error: caught instanceof Error ? caught.message : "Could not process input.",
        output: "",
      };
    }
  }, [cipher, direction, input, keyAsHex, shift, xorKey]);

  const selectCipher = useCallback((next: Cipher) => {
    setCipher(next);
    setCopied(false);
    if (next !== "xor" && next !== "morse") setDirection("encode");
  }, []);

  const copyOutput = useCallback(() => {
    if (!output) return;
    try {
      void navigator.clipboard?.writeText(output);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [output]);

  const swap = useCallback(() => {
    if (error) return;
    setInput(output);
    setDirection((prev) => (prev === "encode" ? "decode" : "encode"));
    setCopied(false);
  }, [error, output]);

  const inputLabel =
    cipher === "xor" && direction === "decode"
      ? "Input (hex)"
      : cipher === "morse" && direction === "decode"
        ? "Input (morse)"
        : "Input (text)";

  const outputLabel =
    cipher === "xor" && direction === "encode"
      ? "Output (hex)"
      : cipher === "morse" && direction === "encode"
        ? "Output (morse)"
        : "Output (text)";

  return (
    <StyledTool>
      <h2>Classic Cipher Playground</h2>
      <p className="desc">Encode and decode ROT13, Caesar, Atbash, XOR, and Morse — fully offline.</p>

      <Tabs>
        <button className={cipher === "rot13" ? "active" : ""} onClick={() => selectCipher("rot13")} type="button">
          ROT13
        </button>
        <button className={cipher === "caesar" ? "active" : ""} onClick={() => selectCipher("caesar")} type="button">
          Caesar
        </button>
        <button className={cipher === "atbash" ? "active" : ""} onClick={() => selectCipher("atbash")} type="button">
          Atbash
        </button>
        <button className={cipher === "xor" ? "active" : ""} onClick={() => selectCipher("xor")} type="button">
          XOR
        </button>
        <button className={cipher === "morse" ? "active" : ""} onClick={() => selectCipher("morse")} type="button">
          Morse
        </button>
      </Tabs>

      <p className="muted">{DESCRIPTIONS[cipher]}</p>

      {bidirectional ? (
        <div>
          <label htmlFor="cp-direction">Direction</label>
          <select
            id="cp-direction"
            onChange={(event) => {
              setDirection(event.target.value as Direction);
              setCopied(false);
            }}
            value={direction}
          >
            <option value="encode">Encode (text -&gt; {cipher === "xor" ? "hex" : "morse"})</option>
            <option value="decode">Decode ({cipher === "xor" ? "hex" : "morse"} -&gt; text)</option>
          </select>
        </div>
      ) : null}

      {cipher === "caesar" ? (
        <div>
          <label htmlFor="cp-shift">Shift</label>
          <input
            id="cp-shift"
            onChange={(event) => setShift(event.target.value)}
            type="number"
            value={shift}
          />
        </div>
      ) : null}

      {cipher === "xor" ? (
        <div className="grid">
          <div>
            <label htmlFor="cp-key">Key ({keyAsHex ? "hex" : "text"})</label>
            <input
              className={error && error.toLowerCase().includes("key") ? "invalid" : ""}
              id="cp-key"
              onChange={(event) => setXorKey(event.target.value)}
              type="text"
              value={xorKey}
            />
          </div>
          <div>
            <label htmlFor="cp-keytype">Key format</label>
            <select
              id="cp-keytype"
              onChange={(event) => setKeyAsHex(event.target.value === "hex")}
              value={keyAsHex ? "hex" : "text"}
            >
              <option value="text">Text (UTF-8)</option>
              <option value="hex">Hex</option>
            </select>
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="cp-input">{inputLabel}</label>
        <textarea
          className={error && error.toLowerCase().includes("input") ? "invalid" : ""}
          id="cp-input"
          onChange={(event) => {
            setInput(event.target.value);
            setCopied(false);
          }}
          placeholder={
            cipher === "xor" && direction === "decode"
              ? "deadbeef..."
              : cipher === "morse" && direction === "decode"
                ? ".... .. / - .... . .-. ."
                : "Type something..."
          }
          value={input}
        />
      </div>

      <div className="btn-row">
        <button disabled={!output} onClick={copyOutput} type="button">
          {copied ? "Copied" : "Copy output"}
        </button>
        {bidirectional ? (
          <button className="secondary" disabled={!!error || !output} onClick={swap} type="button">
            Use output as input
          </button>
        ) : null}
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

      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div>
          <label>{outputLabel}</label>
          <pre className="output">{output || <span className="muted">Output appears here.</span>}</pre>
        </div>
      )}
    </StyledTool>
  );
};

export default CipherPlaygroundTool;
