import styled from "styled-components";

// Matrix — first-party Matrix chat client, every request routed over Tor via the
// same-origin /api/matrix endpoint. Dark, theme-token-driven (no hardcoded brand
// colors): surfaces read from theme.colors.*, type from theme.formats.systemFont.
const StyledMatrix = styled.div`
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 13px;
  height: 100%;
  overflow: hidden;
  width: 100%;

  @keyframes matrix-pulse {
    0%,
    100% {
      opacity: 100%;
    }

    50% {
      opacity: 30%;
    }
  }

  input {
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 13px;
    outline: none;
    padding: 8px 9px;
  }

  input:focus {
    border-color: ${({ theme }) => theme.colors.highlight};
  }

  .tor-bar {
    align-items: center;
    background: ${({ theme }) => theme.colors.taskbar.background};
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    justify-content: space-between;
    letter-spacing: 0.3px;
    padding: 5px 10px;
  }

  .tor-bar .status {
    align-items: center;
    display: flex;
    gap: 6px;
  }

  .tor-bar .dot {
    background: ${({ theme }) => theme.colors.progressBarRgb};
    border-radius: 50%;
    height: 8px;
    width: 8px;
  }

  .tor-bar .dot.error {
    background: ${({ theme }) => theme.colors.titleBar.closeHover};
  }

  .tor-bar .dot.busy {
    animation: matrix-pulse 1s ease-in-out infinite;
    background: ${({ theme }) => theme.colors.highlight};
  }

  .ghost-btn {
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    padding: 3px 9px;
  }

  .ghost-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  /* Login card */
  .login-wrap {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    justify-content: center;
    padding: 16px;
  }

  .login-card {
    background: ${({ theme }) => theme.colors.window.background};
    border: 1px solid ${({ theme }) => theme.colors.window.outline};
    border-radius: 8px;
    box-shadow: ${({ theme }) => theme.colors.window.shadow};
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 340px;
    padding: 22px;
    width: 100%;
  }

  .login-card h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .login-card .sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    margin: -6px 0 4px;
  }

  .login-card label {
    display: flex;
    flex-direction: column;
    font-size: 11px;
    gap: 4px;
  }

  .primary-btn {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 9px;
  }

  .primary-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.activeForeground};
  }

  .primary-btn:disabled {
    cursor: default;
    opacity: 55%;
  }

  .error {
    background: ${({ theme }) => theme.colors.titleBar.closeHover};
    border-radius: 4px;
    color: rgb(255, 235, 235);
    font-size: 11px;
    overflow-wrap: anywhere;
    padding: 6px 8px;
  }

  .notice {
    background: ${({ theme }) => theme.colors.taskbar.background};
    border-bottom: 1px solid ${({ theme }) => theme.colors.highlight};
    color: ${({ theme }) => theme.colors.text};
    flex: 0 0 auto;
    font-size: 11px;
    padding: 6px 10px;
  }

  /* Logged-in 2-pane layout */
  .panes {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }

  .sidebar {
    background: ${({ theme }) => theme.colors.window.background};
    border-right: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 200px;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar .me {
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    overflow: hidden;
    padding: 8px 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .room-item {
    background: transparent;
    border: 0;
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: block;
    font-family: inherit;
    font-size: 12px;
    overflow: hidden;
    padding: 9px 10px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .room-item:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .room-item.active {
    background: ${({ theme }) => theme.colors.highlightBackground};
  }

  .empty {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    padding: 12px 10px;
  }

  .chat {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .chat-header {
    background: ${({ theme }) => theme.colors.titleBar.background};
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    padding: 9px 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .messages {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    padding: 12px;
  }

  .msg {
    background: ${({ theme }) => theme.colors.window.background};
    border-radius: 6px;
    max-width: 78%;
    padding: 6px 9px;
  }

  .msg .sender {
    color: ${({ theme }) => theme.colors.highlight};
    font-size: 10px;
    margin-bottom: 2px;
  }

  .msg .body {
    font-size: 13px;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .msg.mine {
    align-self: flex-end;
    background: ${({ theme }) => theme.colors.highlightBackground};
  }

  .msg.mine .sender {
    color: ${({ theme }) => theme.colors.text};
  }

  .msg.pending {
    opacity: 60%;
  }

  .composer {
    border-top: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    padding: 8px 10px;
  }

  .composer input {
    flex: 1 1 auto;
  }

  .send-btn {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 7px 16px;
  }

  .send-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.activeForeground};
  }

  .send-btn:disabled {
    cursor: default;
    opacity: 55%;
  }

  /* Status spinner + sign-in hint */
  .spinner,
  .hint {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
  }

  .hint {
    margin: 0;
  }

  /* Sidebar tabs */
  .tabs {
    border-bottom: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 auto;
  }

  .tab {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    flex: 1 1 0;
    font-family: inherit;
    font-size: 11px;
    padding: 7px 4px;
  }

  .tab:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .tab.active {
    border-bottom-color: ${({ theme }) => theme.colors.highlight};
    color: ${({ theme }) => theme.colors.highlight};
  }

  .list {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .section-label {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
    letter-spacing: 0.5px;
    padding: 6px 10px 2px;
    text-transform: uppercase;
  }

  /* Invites */
  .invites {
    border-bottom: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
  }

  .invite {
    padding: 6px 10px 8px;
  }

  .invite-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .invite-actions {
    display: flex;
    gap: 6px;
    margin-top: 5px;
  }

  .mini-btn {
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    padding: 3px 9px;
  }

  .mini-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .mini-btn.accept {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border-color: ${({ theme }) => theme.colors.highlight};
  }

  /* Room item: name + unread badge */
  .room-item {
    align-items: center;
    display: flex;
    gap: 6px;
    justify-content: space-between;
  }

  .room-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    background: ${({ theme }) => theme.colors.highlight};
    border-radius: 9px;
    color: ${({ theme }) => theme.colors.window.background};
    flex: 0 0 auto;
    font-size: 9px;
    padding: 1px 6px;
  }

  /* People / Discover finder + results */
  .finder {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
  }

  .finder input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 6px 8px;
  }

  .result {
    align-items: center;
    border-bottom: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    gap: 6px;
    justify-content: space-between;
    padding: 7px 10px;
  }

  .result-main {
    min-width: 0;
  }

  .result-name {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Chat header becomes two-line (title + sub) */
  .chat-header {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .chat-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
    font-weight: 400;
  }

  /* Media bubbles */
  .media-img {
    border-radius: 6px;
    display: block;
    max-height: 280px;
    max-width: 100%;
  }

  .media-loading,
  .media-fail {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    font-style: italic;
  }

  .file-link {
    background: transparent;
    border: 0;
    color: ${({ theme }) => theme.colors.highlight};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 0;
    text-align: left;
  }

  .msg.locked .body {
    font-style: italic;
    opacity: 80%;
  }

  /* Composer attach button */
  .attach-btn {
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    flex: 0 0 auto;
    font-size: 14px;
    padding: 6px 9px;
  }

  .attach-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }
`;

export default StyledMatrix;
