import styled from "styled-components";

// Shared styling contract for every SecTools tool. Each tool wraps its UI in
// <StyledTool> and uses these semantic elements / class names so the suite is
// visually consistent without per-tool coordination:
//   h2                – tool title          p.desc        – one-line description
//   label             – field label         input/textarea/select – controls
//   button            – actions             .btn-row      – button container
//   pre.output        – result block        .error / .ok  – status messages
//   .grid             – 2-column layout     code          – inline mono
const StyledTool = styled.div`
  color: #e8e2ee;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  p.desc {
    color: #ab9cbb;
    margin: -4px 0 4px;
  }

  label {
    color: #c9b8da;
    display: block;
    font-weight: 600;
    margin-bottom: 4px;
  }

  input[type="text"],
  input[type="number"],
  input[type="password"],
  textarea,
  select {
    background: #0f0b14;
    border: 1px solid #4a3a5c;
    border-radius: 5px;
    color: #e8e2ee;
    font-family: ${({ theme }) => theme.formats.monoFont};
    font-size: 12px;
    padding: 7px 9px;
    width: 100%;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  input.invalid,
  textarea.invalid {
    border-color: #d9534f;
  }

  .tabs {
    border-bottom: 1px solid #3a2f44;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: -4px 0 4px;
  }

  button.tab {
    background: transparent;
    border-bottom: 2px solid transparent;
    border-radius: 5px 5px 0 0;
    color: #ab9cbb;
    font-weight: 600;
    padding: 6px 10px;
  }

  button.tab.active {
    background: #2a1a33;
    border-bottom-color: #9b59d0;
    color: #e8e2ee;
  }

  label.check {
    align-items: center;
    color: #c9b8da;
    cursor: pointer;
    display: flex;
    font-weight: 400;
    gap: 8px;
    margin-bottom: 0;
  }

  label.check input[type="checkbox"] {
    cursor: pointer;
    height: 14px;
    margin: 0;
    width: 14px;
  }

  .btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  button {
    background: #7d4eaf;
    border: none;
    border-radius: 5px;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
  }

  button.secondary {
    background: #2f2740;
  }

  button:disabled {
    background: #4a3a5c;
    cursor: not-allowed;
  }

  pre.output {
    background: #0f0b14;
    border: 1px solid #2f2740;
    border-radius: 6px;
    color: #d7c2ec;
    font-family: ${({ theme }) => theme.formats.monoFont};
    font-size: 12px;
    margin: 0;
    overflow-x: auto;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .grid {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
  }

  .error {
    color: #f0908d;
  }

  .ok {
    color: #7ed492;
  }

  .muted {
    color: #ab9cbb;
  }

  code {
    background: #0f0b14;
    border-radius: 3px;
    color: #d7c2ec;
    font-family: ${({ theme }) => theme.formats.monoFont};
    padding: 1px 5px;
  }

  .bar {
    background: #2f2740;
    border-radius: 4px;
    height: 8px;
    overflow: hidden;
    width: 100%;
  }

  .bar > span {
    display: block;
    height: 100%;
    transition: width 0.2s ease;
  }
`;

export default StyledTool;
