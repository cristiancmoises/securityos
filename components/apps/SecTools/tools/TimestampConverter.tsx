import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  .row {
    align-items: baseline;
    display: grid;
    gap: 8px;
    grid-template-columns: 120px 1fr;
  }

  .row .k {
    color: #ab9cbb;
    font-weight: 600;
  }

  .row .v {
    font-family: ${({ theme }) => theme.formats.monoFont};
    word-break: break-all;
  }
`;

// Heuristic: epoch values with absolute magnitude >= 1e12 are milliseconds,
// otherwise seconds. 1e12 ms ~= year 2001; 1e12 s ~= year 33658, so any plausible
// "seconds" timestamp stays well under the threshold while real "ms" timestamps
// (post-2001) land above it. Sub-second epochs (us/ns) are detected separately.
const MS_THRESHOLD = 1e12;

type EpochUnit = "ms" | "ns" | "s" | "us";

const detectUnit = (n: number): EpochUnit => {
  const abs = Math.abs(n);

  if (abs >= 1e18) return "ns";
  if (abs >= 1e15) return "us";
  if (abs >= MS_THRESHOLD) return "ms";

  return "s";
};

const unitLabel: Record<EpochUnit, string> = {
  ms: "milliseconds",
  ns: "nanoseconds",
  s: "seconds",
  us: "microseconds",
};

const toMillis = (n: number, unit: EpochUnit): number => {
  switch (unit) {
    case "ns":
      return n / 1e6;
    case "us":
      return n / 1e3;
    case "ms":
      return n;
    default:
      return n * 1000;
  }
};

const RELATIVE_DIVISIONS: {
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

const formatRelative = (fromMs: number, nowMs: number): string => {
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    let duration = (fromMs - nowMs) / 1000;

    for (const division of RELATIVE_DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return rtf.format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
  } catch {
    // Intl.RelativeTimeFormat unavailable — fall through.
  }

  return "n/a";
};

const localString = (d: Date): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    }).format(d);
  } catch {
    return d.toString();
  }
};

const localTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  } catch {
    return "local";
  }
};

type EpochResult = {
  iso: string;
  local: string;
  ms: number;
  relative: string;
  unit: EpochUnit;
  utc: string;
};

const TimestampConverterTool: FC = () => {
  const [epochInput, setEpochInput] = useState<string>("");
  const [isoInput, setIsoInput] = useState<string>("");

  const epochResult = useMemo<EpochResult | { error: string } | null>(() => {
    const raw = epochInput.trim();

    if (!raw) return null;

    if (!/^[-+]?\d+(\.\d+)?$/.test(raw)) {
      return { error: "Enter a numeric epoch value (digits only)." };
    }

    const n = Number(raw);

    if (!Number.isFinite(n)) {
      return { error: "Value is out of range." };
    }

    const unit = detectUnit(n);
    const ms = toMillis(n, unit);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
      return { error: "Resulting date is invalid." };
    }

    const nowMs = Date.now();

    return {
      iso: date.toISOString(),
      local: localString(date),
      ms,
      relative: formatRelative(ms, nowMs),
      unit,
      utc: date.toUTCString(),
    };
  }, [epochInput]);

  const reverseResult = useMemo<
    { ms: number; seconds: number } | { error: string } | null
  >(() => {
    const raw = isoInput.trim();

    if (!raw) return null;

    const ms = Date.parse(raw);

    if (Number.isNaN(ms)) {
      return {
        error:
          "Unparseable date. Try an ISO 8601 string (e.g. 2026-06-13T12:00:00Z).",
      };
    }

    return { ms, seconds: Math.floor(ms / 1000) };
  }, [isoInput]);

  const setNow = useCallback(() => {
    setEpochInput(String(Date.now()));
  }, []);

  const setNowSeconds = useCallback(() => {
    setEpochInput(String(Math.floor(Date.now() / 1000)));
  }, []);

  const fillReverseNow = useCallback(() => {
    setIsoInput(new Date().toISOString());
  }, []);

  const epochInvalid = epochResult !== null && "error" in epochResult;
  const reverseInvalid = reverseResult !== null && "error" in reverseResult;

  return (
    <StyledTool>
      <h2>Timestamp Converter</h2>
      <p className="desc">
        Convert Unix epoch (auto-detects seconds/ms) to human time, and back.
      </p>

      <div>
        <label htmlFor="ts-epoch">Unix epoch</label>
        <input
          className={epochInvalid ? "invalid" : undefined}
          id="ts-epoch"
          inputMode="numeric"
          onChange={(e) => setEpochInput(e.target.value)}
          placeholder="e.g. 1700000000 or 1700000000000"
          spellCheck={false}
          type="text"
          value={epochInput}
        />
      </div>

      <div className="btn-row">
        <button onClick={setNow} type="button">
          Now (ms)
        </button>
        <button className="secondary" onClick={setNowSeconds} type="button">
          Now (seconds)
        </button>
        <button
          className="secondary"
          disabled={!epochInput}
          onClick={() => setEpochInput("")}
          type="button"
        >
          Clear
        </button>
      </div>

      {epochResult && "error" in epochResult ? (
        <p className="error">{epochResult.error}</p>
      ) : null}

      {epochResult && !("error" in epochResult) ? (
        <Rows>
          <p className="muted">
            Detected as <code>{unitLabel[epochResult.unit]}</code>
          </p>
          <div className="row">
            <span className="k">ISO 8601 (UTC)</span>
            <span className="v">{epochResult.iso}</span>
          </div>
          <div className="row">
            <span className="k">UTC string</span>
            <span className="v">{epochResult.utc}</span>
          </div>
          <div className="row">
            <span className="k">Local ({localTimeZone()})</span>
            <span className="v">{epochResult.local}</span>
          </div>
          <div className="row">
            <span className="k">Relative</span>
            <span className="v">{epochResult.relative}</span>
          </div>
          <div className="row">
            <span className="k">Epoch seconds</span>
            <span className="v">{Math.floor(epochResult.ms / 1000)}</span>
          </div>
          <div className="row">
            <span className="k">Epoch ms</span>
            <span className="v">{epochResult.ms}</span>
          </div>
        </Rows>
      ) : null}

      <div>
        <label htmlFor="ts-iso">Date string &rarr; epoch</label>
        <input
          className={reverseInvalid ? "invalid" : undefined}
          id="ts-iso"
          onChange={(e) => setIsoInput(e.target.value)}
          placeholder="e.g. 2026-06-13T12:00:00Z or Jun 13 2026"
          spellCheck={false}
          type="text"
          value={isoInput}
        />
      </div>

      <div className="btn-row">
        <button className="secondary" onClick={fillReverseNow} type="button">
          Fill with now
        </button>
        <button
          className="secondary"
          disabled={!isoInput}
          onClick={() => setIsoInput("")}
          type="button"
        >
          Clear
        </button>
      </div>

      {reverseResult && "error" in reverseResult ? (
        <p className="error">{reverseResult.error}</p>
      ) : null}

      {reverseResult && !("error" in reverseResult) ? (
        <pre className="output">
          {`Epoch seconds : ${reverseResult.seconds}\nEpoch ms      : ${
            reverseResult.ms
          }\nISO 8601 UTC  : ${new Date(reverseResult.ms).toISOString()}`}
        </pre>
      ) : null}
    </StyledTool>
  );
};

export default TimestampConverterTool;
