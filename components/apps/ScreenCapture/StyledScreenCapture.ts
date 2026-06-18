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
  overflow: auto;
  padding: 18px;
  position: relative;
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

  .options {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    justify-content: center;
    margin-top: 2px;
  }

  .options label {
    align-items: center;
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    cursor: pointer;
    display: inline-flex;
    font-size: 11px;
    gap: 5px;
  }

  .options select {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 11px;
    padding: 2px 4px;
  }

  .options input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.highlight};
    cursor: pointer;
    margin: 0;
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

  button:hover:not(:disabled) {
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

  button.recording.paused {
    animation: none;
  }

  button.pause {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border-color: ${({ theme }) => theme.colors.highlight};
  }

  @keyframes rec-pulse {
    50% {
      opacity: 65%;
    }
  }

  .rec-indicator {
    align-items: center;
    color: ${({ theme }) => theme.colors.titleBar.closeHover};
    display: inline-flex;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
    letter-spacing: 0.5px;
  }

  .rec-indicator .dot {
    animation: rec-pulse 1.2s ease-in-out infinite;
    background: ${({ theme }) => theme.colors.titleBar.closeHover};
    border-radius: 50%;
    display: inline-block;
    height: 9px;
    width: 9px;
  }

  .rec-indicator .timer {
    color: ${({ theme }) => theme.colors.text};
    font-variant-numeric: tabular-nums;
  }

  .rec-indicator.paused {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
  }

  .rec-indicator.paused .dot {
    animation: none;
    background: ${({ theme }) => theme.colors.titleBar.textInactive};
  }

  .rec-indicator .paused-tag {
    letter-spacing: normal;
  }

  .countdown {
    align-items: center;
    background: rgb(0 0 0 / 55%);
    border-radius: 8px;
    display: flex;
    font-size: 64px;
    font-weight: 700;
    height: 110px;
    justify-content: center;
    width: 110px;
  }

  .last-capture {
    align-items: center;
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 6px;
    display: flex;
    gap: 10px;
    max-width: 320px;
    padding: 8px 10px;
    text-align: left;
  }

  .last-capture img {
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    flex-shrink: 0;
    height: 48px;
    object-fit: cover;
    width: 64px;
  }

  .last-capture .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .last-capture .name {
    font-size: 11px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .last-capture .note {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
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
