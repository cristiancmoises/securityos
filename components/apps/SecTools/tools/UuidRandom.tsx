import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useEffect, useState } from "react";

// All randomness comes from the CSPRNG (crypto.getRandomValues / randomUUID) —
// never Math.random.
const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
};

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return bytes;
};

const uuidV4 = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  // Fallback: set the version (4) and RFC 4122 variant bits by hand.
  const bytes = randomBytes(16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = toHex(bytes);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), min), max)
    : min;

const copy = (text: string): void => {
  navigator.clipboard?.writeText(text).catch(() => {
    // Clipboard may be unavailable (permissions/insecure context) — ignore.
  });
};

const UuidRandomTool: FC = () => {
  const [uuidCount, setUuidCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  const [byteCount, setByteCount] = useState(16);
  const [bytes, setBytes] = useState<Uint8Array>(() => new Uint8Array(0));

  const regenerateUuids = useCallback((count: number): void => {
    setUuids(Array.from({ length: count }, () => uuidV4()));
  }, []);

  const regenerateBytes = useCallback((count: number): void => {
    setBytes(randomBytes(count));
  }, []);

  useEffect(() => {
    regenerateUuids(uuidCount);
    regenerateBytes(byteCount);
    // Generate an initial batch on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hex = toHex(bytes);
  const base64 = bytes.length > 0 ? toBase64(bytes) : "";
  const jsArray = `[${Array.from(bytes).join(", ")}]`;

  return (
    <StyledTool>
      <h2>UUID &amp; Random</h2>
      <p className="desc">
        Cryptographically secure UUIDs and random bytes (CSPRNG — never
        Math.random).
      </p>

      <div>
        <label htmlFor="uuid-count">UUID v4 — how many (1–100)</label>
        <div className="btn-row">
          <input
            id="uuid-count"
            max={100}
            min={1}
            onChange={(event) =>
              setUuidCount(clamp(event.target.valueAsNumber, 1, 100))
            }
            type="number"
            value={uuidCount}
          />
          <button onClick={() => regenerateUuids(uuidCount)} type="button">
            Generate
          </button>
          <button
            className="secondary"
            onClick={() => copy(uuids.join("\n"))}
            type="button"
          >
            Copy all
          </button>
        </div>
        {uuids.length > 0 && <pre className="output">{uuids.join("\n")}</pre>}
      </div>

      <div>
        <label htmlFor="byte-count">Random bytes — how many (1–256)</label>
        <div className="btn-row">
          <input
            id="byte-count"
            max={256}
            min={1}
            onChange={(event) =>
              setByteCount(clamp(event.target.valueAsNumber, 1, 256))
            }
            type="number"
            value={byteCount}
          />
          <button onClick={() => regenerateBytes(byteCount)} type="button">
            Generate
          </button>
        </div>
      </div>

      {bytes.length > 0 && (
        <div>
          <label>Hex</label>
          <div className="btn-row">
            <pre className="output">{hex}</pre>
          </div>
          <div className="btn-row">
            <button
              className="secondary"
              onClick={() => copy(hex)}
              type="button"
            >
              Copy hex
            </button>
            <button
              className="secondary"
              onClick={() => copy(base64)}
              type="button"
            >
              Copy base64
            </button>
            <button
              className="secondary"
              onClick={() => copy(jsArray)}
              type="button"
            >
              Copy array
            </button>
          </div>
          <label>Base64</label>
          <pre className="output">{base64}</pre>
          <label>JS array</label>
          <pre className="output">{jsArray}</pre>
        </div>
      )}
    </StyledTool>
  );
};

export default UuidRandomTool;
