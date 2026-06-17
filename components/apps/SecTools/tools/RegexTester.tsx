import StyledTool from "components/apps/SecTools/StyledTool";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

const StyledRegex = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .flag {
    align-items: center;
    color: #c9b8da;
    cursor: pointer;
    display: flex;
    font-weight: 600;
    gap: 5px;
    user-select: none;
  }

  .flag input {
    cursor: pointer;
    width: auto;
  }

  .flag code {
    font-size: 11px;
  }

  table {
    border-collapse: collapse;
    font-family: ${({ theme }) => theme.formats.monoFont};
    font-size: 12px;
    width: 100%;
  }

  th,
  td {
    border: 1px solid #2f2740;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    word-break: break-all;
  }

  th {
    background: #1a1322;
    color: #c9b8da;
  }

  td.idx {
    color: #ab9cbb;
    white-space: nowrap;
  }

  td.empty {
    color: #ab9cbb;
    font-style: italic;
  }
`;

const FLAGS: { char: string; label: string }[] = [
  { char: "g", label: "global" },
  { char: "i", label: "ignore case" },
  { char: "m", label: "multiline" },
  { char: "s", label: "dotall" },
  { char: "u", label: "unicode" },
  { char: "y", label: "sticky" },
];

const MAX_MATCHES = 10000;

// Advance past a zero-length match without splitting an astral character.
// Under the `u`/`v` flag the engine matches whole code points, so bumping
// lastIndex by a single code unit into the middle of a surrogate pair makes
// exec() snap back to the same index forever. Step a full code point instead.
const advancePastEmpty = (regex: RegExp, text: string): void => {
  const unicodeAware = regex.unicode || regex.flags.includes("v");
  if (unicodeAware && regex.lastIndex < text.length) {
    const codePoint = text.codePointAt(regex.lastIndex);
    regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
  } else {
    regex.lastIndex += 1;
  }
};

type MatchRow = {
  fullMatch: string;
  groups: (string | undefined)[];
  index: number;
  named: Record<string, string | undefined>;
};

type Result =
  | { kind: "error"; message: string }
  | { kind: "idle" }
  | { kind: "ok"; matches: MatchRow[]; truncated: boolean };

const RegexTesterTool: FC = () => {
  const [pattern, setPattern] = useState("(\\w+)@(\\w+\\.\\w+)");
  const [flags, setFlags] = useState<Record<string, boolean>>({ g: true });
  const [testString, setTestString] = useState(
    "Contact admin@site.org or root@host.net for access."
  );

  const flagString = useMemo(
    () =>
      FLAGS.filter(({ char }) => flags[char])
        .map(({ char }) => char)
        .join(""),
    [flags]
  );

  const toggleFlag = useCallback((char: string) => {
    setFlags((prev) => ({ ...prev, [char]: !prev[char] }));
  }, []);

  const result = useMemo<Result>(() => {
    if (!pattern) return { kind: "idle" };

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flagString);
    } catch (error) {
      return {
        kind: "error",
        message: error instanceof Error ? error.message : "Invalid pattern.",
      };
    }

    const matches: MatchRow[] = [];
    let truncated = false;

    try {
      if (regex.global || regex.sticky) {
        // Enumerate every match. Manually advance lastIndex past zero-length
        // matches to avoid an infinite loop.
        let match = regex.exec(testString);
        while (match !== null) {
          matches.push({
            fullMatch: match[0],
            groups: match.slice(1),
            index: match.index,
            named: match.groups ? { ...match.groups } : {},
          });

          if (match.index === regex.lastIndex)
            advancePastEmpty(regex, testString);
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            break;
          }
          match = regex.exec(testString);
        }
      } else {
        const match = regex.exec(testString);
        if (match !== null) {
          matches.push({
            fullMatch: match[0],
            groups: match.slice(1),
            index: match.index,
            named: match.groups ? { ...match.groups } : {},
          });
        }
      }
    } catch (error) {
      return {
        kind: "error",
        message:
          error instanceof Error ? error.message : "Match enumeration failed.",
      };
    }

    return { kind: "ok", matches, truncated };
  }, [flagString, pattern, testString]);

  const maxGroups =
    result.kind === "ok"
      ? result.matches.reduce((max, row) => Math.max(max, row.groups.length), 0)
      : 0;

  const renderCell = (value: string | undefined) => {
    if (value === undefined) return <span className="muted">undefined</span>;
    if (value === "") return <span className="muted">(empty)</span>;
    return value;
  };

  return (
    <StyledTool>
      <StyledRegex>
        <h2>Regex Tester</h2>
        <p className="desc">
          Test a JavaScript regular expression against multi-line text and
          enumerate every match with capture groups.
        </p>

        <div>
          <label htmlFor="regex-pattern">Pattern</label>
          <input
            className={result.kind === "error" ? "invalid" : undefined}
            id="regex-pattern"
            onChange={(event) => setPattern(event.target.value)}
            placeholder="e.g. (\d{4})-(\d{2})-(\d{2})"
            spellCheck={false}
            type="text"
            value={pattern}
          />
        </div>

        <div>
          <label>Flags</label>
          <div className="flags">
            {FLAGS.map(({ char, label }) => (
              <label className="flag" key={char}>
                <input
                  checked={Boolean(flags[char])}
                  onChange={() => toggleFlag(char)}
                  type="checkbox"
                />
                <code>{char}</code>
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="regex-test">Test string</label>
          <textarea
            id="regex-test"
            onChange={(event) => setTestString(event.target.value)}
            placeholder="Text to search…"
            spellCheck={false}
            value={testString}
          />
        </div>

        <p className="muted">
          Active regex:{" "}
          <code>
            /{pattern || "(empty)"}/{flagString}
          </code>
        </p>

        {result.kind === "error" && (
          <p className="error">Invalid regular expression: {result.message}</p>
        )}

        {result.kind === "ok" && (
          <>
            <p className={result.matches.length > 0 ? "ok" : "muted"}>
              {result.matches.length === 0
                ? "No matches found."
                : `${result.matches.length} match${
                    result.matches.length === 1 ? "" : "es"
                  } found.`}
              {result.truncated &&
                ` (stopped at limit of ${MAX_MATCHES.toLocaleString()})`}
            </p>

            {result.matches.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Index</th>
                    <th>Match</th>
                    {Array.from({ length: maxGroups }, (_, group) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <th key={group}>Group {group + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((row, rowIndex) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={rowIndex}>
                      <td className="idx">{rowIndex + 1}</td>
                      <td className="idx">{row.index}</td>
                      <td>{renderCell(row.fullMatch)}</td>
                      {Array.from({ length: maxGroups }, (_, group) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <td key={group}>{renderCell(row.groups[group])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {result.matches.some(
              (row) => Object.keys(row.named).length > 0
            ) && (
              <pre className="output">
                {result.matches
                  .map((row, rowIndex) => {
                    const entries = Object.entries(row.named);
                    if (entries.length === 0) return null;
                    const body = entries
                      .map(
                        ([name, value]) =>
                          `    ${name} = ${
                            value === undefined ? "undefined" : `"${value}"`
                          }`
                      )
                      .join("\n");
                    return `Match ${rowIndex + 1} named groups:\n${body}`;
                  })
                  .filter(Boolean)
                  .join("\n\n")}
              </pre>
            )}
          </>
        )}
      </StyledRegex>
    </StyledTool>
  );
};

export default RegexTesterTool;
