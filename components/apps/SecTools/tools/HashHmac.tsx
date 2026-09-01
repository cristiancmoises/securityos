import StyledTool from "components/apps/SecTools/StyledTool";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

type Algo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

type Row = {
  algo: Algo;
  base64: string;
  hex: string;
};

const ALGOS: Algo[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  .row .head {
    align-items: baseline;
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }

  .row .head strong {
    color: #c9b8da;
    font-size: 12px;
  }

  .row .line {
    align-items: center;
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .row .line .tag {
    color: #ab9cbb;
    flex-shrink: 0;
    font-size: 11px;
    text-transform: uppercase;
    width: 46px;
  }

  .row .line pre.output {
    flex: 1;
    margin: 0;
  }

  .row .line button {
    flex-shrink: 0;
    padding: 5px 9px;
  }
`;

const bufferToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

const HashHmacTool: FC = () => {
  const [error, setError] = useState("");
  const [hmacKey, setHmacKey] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [scope, setScope] = useState<"all" | Algo>("all");
  const [text, setText] = useState("");

  const selected = useMemo<Algo[]>(
    () => (scope === "all" ? ALGOS : [scope]),
    [scope]
  );

  const usingHmac = hmacKey.length > 0;

  useEffect(() => {
    let cancelled = false;

    const compute = async (): Promise<void> => {
      if (typeof crypto === "undefined" || !crypto.subtle) {
        setError("Web Crypto API is unavailable in this context.");
        setRows([]);

        return;
      }

      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        const computed = await Promise.all(
          selected.map(async (algo): Promise<Row> => {
            let digest: ArrayBuffer;

            if (usingHmac) {
              const key = await crypto.subtle.importKey(
                "raw",
                encoder.encode(hmacKey),
                { hash: algo, name: "HMAC" },
                false,
                ["sign"]
              );
              digest = await crypto.subtle.sign("HMAC", key, data);
            } else {
              digest = await crypto.subtle.digest(algo, data);
            }

            return {
              algo,
              base64: bufferToBase64(digest),
              hex: bufferToHex(digest),
            };
          })
        );

        if (!cancelled) {
          setError("");
          setRows(computed);
        }
      } catch {
        if (!cancelled) {
          setError("Could not compute digest for the given input.");
          setRows([]);
        }
      }
    };

    compute();

    return () => {
      cancelled = true;
    };
  }, [hmacKey, selected, text, usingHmac]);

  const copy = (value: string): void => {
    try {
      navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard may be unavailable; ignore silently.
    }
  };

  return (
    <StyledTool>
      <h2>Hash &amp; HMAC</h2>
      <p className="desc">
        Compute SHA-1/256/384/512 digests of text, or HMAC when a secret key is
        set. Live hex and base64 output.
      </p>

      <div>
        <label htmlFor="hh-text">Input text</label>
        <textarea
          id="hh-text"
          onChange={(event) => setText(event.target.value)}
          placeholder="Type or paste text to hash…"
          value={text}
        />
        <p className="muted">
          {new TextEncoder().encode(text).length} byte(s) of UTF-8 input.
        </p>
      </div>

      <div className="grid">
        <div>
          <label htmlFor="hh-algo">Algorithm</label>
          <select
            id="hh-algo"
            onChange={(event) => setScope(event.target.value as "all" | Algo)}
            value={scope}
          >
            <option value="all">All algorithms</option>
            {ALGOS.map((algo) => (
              <option key={algo} value={algo}>
                {algo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hh-key">HMAC secret key (optional)</label>
          <input
            autoComplete="off"
            id="hh-key"
            onChange={(event) => setHmacKey(event.target.value)}
            placeholder="Leave empty for plain digest"
            type="password"
            value={hmacKey}
          />
        </div>
      </div>

      <p className={usingHmac ? "ok" : "muted"}>
        {usingHmac
          ? "Mode: HMAC (keyed). Output is HMAC of the input under the secret key."
          : "Mode: plain digest. Set a key to switch to HMAC."}
      </p>

      {error ? <p className="error">{error}</p> : undefined}

      <Results>
        {rows.map((row) => (
          <div className="row" key={row.algo}>
            <div className="head">
              <strong>{usingHmac ? `HMAC-${row.algo}` : row.algo}</strong>
              <span className="muted">
                {row.hex.length * 4} bits · {row.hex.length / 2} bytes
              </span>
            </div>
            <div className="line">
              <span className="tag">hex</span>
              <pre className="output">{row.hex}</pre>
              <button
                className="secondary"
                onClick={() => copy(row.hex)}
                type="button"
              >
                Copy
              </button>
            </div>
            <div className="line">
              <span className="tag">b64</span>
              <pre className="output">{row.base64}</pre>
              <button
                className="secondary"
                onClick={() => copy(row.base64)}
                type="button"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && !error ? (
          <p className="muted">No output yet.</p>
        ) : undefined}
      </Results>
    </StyledTool>
  );
};

export default HashHmacTool;
