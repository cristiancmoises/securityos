import styled from "styled-components";

const StyledTorControl = styled.div`
  background: #1a1320;
  color: #e8e2ee;
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 13px;
  height: 100%;
  overflow-y: auto;
  padding: 16px 18px;

  h1 {
    align-items: center;
    display: flex;
    font-size: 17px;
    font-weight: 600;
    gap: 8px;
    margin: 0 0 2px;
  }

  .subtitle {
    color: #b9a9c9;
    margin: 0 0 14px;
  }

  .status {
    align-items: center;
    border-radius: 6px;
    display: flex;
    font-weight: 600;
    gap: 8px;
    margin-bottom: 16px;
    padding: 10px 12px;
  }

  .status .dot {
    border-radius: 50%;
    height: 10px;
    width: 10px;
  }

  .status.tor {
    background: #2a1a33;
    border: 1px solid #7d4eaf;
  }
  .status.tor .dot {
    background: #9b59d0;
    box-shadow: 0 0 8px #9b59d0;
  }
  .status.clearnet {
    background: #3a2a14;
    border: 1px solid #c08a2e;
  }
  .status.clearnet .dot {
    background: #e0a83a;
  }
  .status.disabled {
    background: #20262b;
    border: 1px solid #4a5560;
  }
  .status.disabled .dot {
    background: #7c8b97;
  }
  .status.proxy-up {
    background: #15301f;
    border: 1px solid #2e9d5b;
  }
  .status.proxy-up .dot {
    background: #3ad17e;
    box-shadow: 0 0 8px #3ad17e;
  }
  .status.proxy-down {
    background: #3a1414;
    border: 1px solid #c0392e;
  }
  .status.proxy-down .dot {
    background: #e05a3a;
    box-shadow: 0 0 8px #e05a3a;
  }
  .status.proxy-checking,
  .status.proxy-off {
    background: #20262b;
    border: 1px solid #4a5560;
  }
  .status.proxy-checking .dot,
  .status.proxy-off .dot {
    background: #7c8b97;
  }

  fieldset {
    border: 1px solid #3a2f44;
    border-radius: 8px;
    margin: 0 0 14px;
    padding: 10px 12px 12px;
  }

  legend {
    color: #c9b8da;
    font-weight: 600;
    padding: 0 6px;
  }

  label.mode {
    align-items: flex-start;
    cursor: pointer;
    display: flex;
    gap: 10px;
    padding: 7px 4px;
  }

  label.mode input {
    margin-top: 3px;
  }

  label.mode .mode-title {
    font-weight: 600;
  }

  label.mode .mode-desc {
    color: #ab9cbb;
    font-size: 12px;
  }

  .custom-url {
    display: flex;
    gap: 8px;
    margin: 6px 0 2px 28px;
  }

  .custom-url input[type="text"] {
    background: #0f0b14;
    border: 1px solid #4a3a5c;
    border-radius: 5px;
    color: #e8e2ee;
    flex: 1;
    font-family: "Cascadia Code", "Consolas", monospace;
    font-size: 12px;
    padding: 6px 8px;
  }

  .custom-url input.invalid {
    border-color: #d9534f;
  }

  button.apply {
    background: #7d4eaf;
    border: none;
    border-radius: 5px;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
    padding: 6px 14px;
  }

  button.apply:disabled {
    background: #4a3a5c;
    cursor: not-allowed;
  }

  .note {
    background: #20262b;
    border-left: 3px solid #7d4eaf;
    border-radius: 0 6px 6px 0;
    color: #c4d0da;
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 10px;
    padding: 9px 12px;
  }

  .note.warn {
    border-left-color: #e0a83a;
  }

  .note code {
    background: #0f0b14;
    border-radius: 3px;
    color: #d7c2ec;
    font-family: "Cascadia Code", "Consolas", monospace;
    padding: 1px 5px;
  }

  a {
    color: #b98be0;
  }
`;

export default StyledTorControl;
