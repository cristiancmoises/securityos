import styled from "styled-components";

// SecurityOS IRC — dark, Tor-flavored chat UI. Mirrors the Matrix app's aesthetic
// (purple accents on a near-black base) so the two chat apps feel like a family.
const StyledIRC = styled.div`
  background: #150f1b;
  color: #e8e2ee;
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  height: 100%;
  overflow: hidden;
  width: 100%;

  .tor-bar {
    align-items: center;
    background: #1d1526;
    border-bottom: 1px solid rgba(150, 130, 220, 22%);
    display: flex;
    flex: 0 0 auto;
    font-size: 12px;
    gap: 8px;
    justify-content: space-between;
    padding: 5px 10px;
  }

  .tor-bar .status {
    align-items: center;
    color: #c9bce6;
    display: flex;
    gap: 7px;
  }

  .dot {
    background: #b9a4ef;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(185, 164, 239, 70%);
    height: 8px;
    width: 8px;
  }
  .dot.busy {
    animation: irc-pulse 1.1s ease-in-out infinite;
    background: #d7b45a;
    box-shadow: 0 0 6px rgba(215, 180, 90, 70%);
  }
  .dot.error {
    animation: none;
    background: #e0637a;
    box-shadow: 0 0 6px rgba(224, 99, 122, 70%);
  }

  @keyframes irc-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  .ghost-btn,
  .mini-btn {
    background: transparent;
    border: 1px solid rgba(150, 130, 220, 40%);
    border-radius: 5px;
    color: #e2d8fb;
    cursor: pointer;
    font-family: inherit;
    font-size: 11.5px;
    padding: 3px 10px;
  }
  .ghost-btn:hover,
  .mini-btn:hover {
    background: rgba(150, 130, 220, 16%);
  }

  /* ---- Connected layout ---- */
  .panes {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }

  .sidebar {
    background: #17111f;
    border-right: 1px solid rgba(150, 130, 220, 16%);
    display: flex;
    flex: 0 0 190px;
    flex-direction: column;
    min-height: 0;
    width: 190px;
  }

  .me {
    border-bottom: 1px solid rgba(150, 130, 220, 16%);
    color: #b9a4ef;
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    padding: 8px 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .buffers {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
  }

  .buffer-item {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: #cabfe0;
    cursor: pointer;
    display: flex;
    font-family: inherit;
    font-size: 12.5px;
    gap: 6px;
    justify-content: space-between;
    padding: 6px 8px;
    text-align: left;
    width: 100%;
  }
  .buffer-item:hover {
    background: rgba(150, 130, 220, 12%);
  }
  .buffer-item.active {
    background: rgba(150, 130, 220, 26%);
    color: #fff;
  }
  .buffer-item .b-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .buffer-item .kind {
    color: #7d6ba6;
  }
  .badge {
    background: #7d4698;
    border-radius: 999px;
    color: #fff;
    flex: 0 0 auto;
    font-size: 10px;
    min-width: 16px;
    padding: 1px 5px;
    text-align: center;
  }
  .b-close {
    background: transparent;
    border: 0;
    color: #7d6ba6;
    cursor: pointer;
    font-size: 13px;
    opacity: 0;
    padding: 0 2px;
  }
  .buffer-item:hover .b-close {
    opacity: 1;
  }
  .b-close:hover {
    color: #e0637a;
  }

  .join-row {
    border-top: 1px solid rgba(150, 130, 220, 16%);
    display: flex;
    gap: 5px;
    padding: 7px;
  }
  .join-row input {
    background: #100b16;
    border: 1px solid rgba(150, 130, 220, 30%);
    border-radius: 5px;
    color: #eee;
    flex: 1 1 auto;
    font-family: inherit;
    font-size: 12px;
    min-width: 0;
    padding: 5px 7px;
  }

  /* ---- Chat pane ---- */
  .chat {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .chat-header {
    border-bottom: 1px solid rgba(150, 130, 220, 16%);
    flex: 0 0 auto;
    padding: 8px 12px;
  }
  .chat-title {
    color: #fff;
    font-size: 13.5px;
    font-weight: 600;
  }
  .chat-topic {
    color: #9a8cc4;
    font-size: 11.5px;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body-cols {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }

  .messages {
    flex: 1 1 auto;
    font-size: 13px;
    line-height: 1.5;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px;
  }

  .line {
    display: flex;
    gap: 8px;
    padding: 1px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .line .ts {
    color: #5f5280;
    flex: 0 0 auto;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    padding-top: 2px;
    user-select: none;
  }
  .line .who {
    color: #b9a4ef;
    flex: 0 0 auto;
    font-weight: 600;
  }
  .line .who.mine {
    color: #7fd0a0;
  }
  .line .txt {
    flex: 1 1 auto;
    min-width: 0;
  }
  .line.system .txt,
  .line.join .txt,
  .line.part .txt,
  .line.quit .txt {
    color: #8479a6;
    font-style: italic;
  }
  .line.notice .txt {
    color: #d7b45a;
  }
  .line.action .txt {
    color: #d3b3f0;
    font-style: italic;
  }
  .line a {
    color: #86b8ff;
  }

  .users {
    border-left: 1px solid rgba(150, 130, 220, 16%);
    flex: 0 0 150px;
    font-size: 12px;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    width: 150px;
  }
  .users .u-count {
    color: #7d6ba6;
    font-size: 10.5px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .users .u {
    color: #cabfe0;
    overflow: hidden;
    padding: 2px 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .users .u .op {
    color: #7fd0a0;
  }
  .users .u .voice {
    color: #86b8ff;
  }

  .composer {
    border-top: 1px solid rgba(150, 130, 220, 16%);
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    padding: 8px 10px;
  }
  .composer input {
    background: #100b16;
    border: 1px solid rgba(150, 130, 220, 30%);
    border-radius: 7px;
    color: #fff;
    flex: 1 1 auto;
    font-family: inherit;
    font-size: 13px;
    min-width: 0;
    padding: 8px 10px;
  }
  .composer input:focus {
    border-color: rgba(150, 130, 220, 65%);
    outline: none;
  }
  .send-btn {
    background: #7d4698;
    border: 0;
    border-radius: 7px;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 16px;
  }
  .send-btn:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .empty {
    color: #7d6ba6;
    font-size: 12.5px;
    padding: 16px;
    text-align: center;
  }

  /* ---- Connect screen ---- */
  .login-wrap {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    justify-content: center;
    padding: 20px;
  }
  .login-card {
    background: #1b1425;
    border: 1px solid rgba(150, 130, 220, 22%);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 11px;
    max-width: 360px;
    padding: 22px 24px;
    width: 100%;
  }
  .login-card h1 {
    color: #fff;
    font-size: 20px;
    margin: 0;
  }
  .login-card .sub {
    color: #9a8cc4;
    font-size: 12px;
    margin: -4px 0 6px;
  }
  .login-card label {
    color: #c9bce6;
    display: flex;
    flex-direction: column;
    font-size: 12px;
    gap: 4px;
  }
  .login-card input,
  .login-card select {
    background: #100b16;
    border: 1px solid rgba(150, 130, 220, 30%);
    border-radius: 7px;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 10px;
  }
  .login-card input:focus,
  .login-card select:focus {
    border-color: rgba(150, 130, 220, 65%);
    outline: none;
  }
  .field-err {
    color: #e0637a;
    font-size: 11px;
  }
  .primary-btn {
    background: #7d4698;
    border: 0;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    margin-top: 4px;
    padding: 10px;
  }
  .primary-btn:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .hint {
    color: #8f82b6;
    font-size: 11px;
    line-height: 1.45;
    margin: 0;
  }
  .hint.warn {
    color: #d7b45a;
  }
  .error {
    background: rgba(224, 99, 122, 12%);
    border: 1px solid rgba(224, 99, 122, 40%);
    border-radius: 6px;
    color: #f2b8c2;
    font-size: 12px;
    padding: 7px 9px;
  }
  .adv {
    color: #9a8cc4;
    cursor: pointer;
    font-size: 11.5px;
    user-select: none;
  }
`;

export default StyledIRC;
