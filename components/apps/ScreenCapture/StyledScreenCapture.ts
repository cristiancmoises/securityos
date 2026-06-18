import styled from "styled-components";

const StyledScreenCapture = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  gap: 12px;
  height: 100%;
  justify-content: center;
  padding: 18px;
  text-align: center;
  width: 100%;

  h1 {
    font-size: 17px;
    font-weight: 600;
    margin: 0;
  }

  .sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    margin: 0;
    max-width: 300px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 4px;
  }

  button {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 6px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 10px 16px;
  }

  button:hover {
    background: ${({ theme }) => theme.colors.taskbar.activeForeground};
  }

  button:disabled {
    cursor: default;
    opacity: 50%;
  }

  button.recording {
    animation: rec-pulse 1.2s ease-in-out infinite;
    background: ${({ theme }) => theme.colors.titleBar.closeHover};
    border-color: ${({ theme }) => theme.colors.titleBar.closeHover};
  }

  @keyframes rec-pulse {
    50% {
      opacity: 65%;
    }
  }

  .status {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    min-height: 14px;
  }

  .status.warn {
    color: ${({ theme }) => theme.colors.titleBar.closeHover};
  }
`;

export default StyledScreenCapture;
