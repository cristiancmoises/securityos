import { memo } from "react";
import styled from "styled-components";
import { leaderRows, type LeaderBinding } from "components/apps/Emacs/commands";

/**
 * The Spacemacs which-key transient popup. Renders the bindings available at
 * the current point in the leader chord (e.g. after SPC, or after SPC f). Pure
 * presentation — the hook decides what map to pass and handles key dispatch.
 */

const StyledWhichKey = styled.div`
  background: #1b1c1e;
  border-top: 2px solid #5d4d7a;
  bottom: 20px;
  box-shadow: 0 -8px 24px rgb(0 0 0 / 45%);
  color: #b2b2b2;
  display: grid;
  font-family: ${({ theme }) => theme.formats.monoFont};
  font-size: 12px;
  gap: 2px 18px;
  grid-auto-flow: column;
  grid-template-rows: repeat(6, auto);
  left: 0;
  max-height: 50%;
  overflow: auto;
  padding: 8px 12px;
  position: absolute;
  right: 0;
  user-select: none;
  z-index: 20;

  .wk-title {
    color: #bc6ec5;
    grid-column: 1 / -1;
    grid-row: 1;
    margin-bottom: 2px;
  }

  .wk-row {
    align-items: baseline;
    display: flex;
    gap: 6px;
    white-space: nowrap;
  }

  .wk-key {
    color: #4f97d7;
    font-weight: 700;
    min-width: 14px;
    text-align: right;
  }

  .wk-arrow {
    color: #5d4d7a;
  }

  .wk-label {
    color: #b2b2b2;
  }

  .wk-label.prefix {
    color: #2d9574;
  }
`;

type WhichKeyProps = {
  /** The chord typed so far (e.g. "SPC" or "SPC f"). */
  title: string;
  /** The bindings available at this depth, keyed by next key. */
  bindings: Record<string, LeaderBinding>;
};

const WhichKey: FC<WhichKeyProps> = ({ title, bindings }) => {
  const rows = leaderRows(bindings);

  return (
    <StyledWhichKey>
      <div className="wk-title">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className="wk-row">
          <span className="wk-key">{row.key === " " ? "SPC" : row.key}</span>
          <span className="wk-arrow">{"→"}</span>
          <span className={`wk-label${row.isPrefix ? " prefix" : ""}`}>
            {row.label}
          </span>
        </div>
      ))}
    </StyledWhichKey>
  );
};

export default memo(WhichKey);
