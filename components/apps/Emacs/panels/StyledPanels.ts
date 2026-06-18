import styled from "styled-components";

/**
 * Shared styled-components for the SIMULATED Telega + whatsappel panels.
 *
 * IMPORTANT: these panels are OFFLINE SIMULATIONS. There is no network client,
 * no Telegram, no WhatsApp connection. They render seeded sample data with a
 * local-echo composer so the SecurityOS Emacs "feels" like telega.el /
 * whatsappel without ever touching the network. Styling follows Spacemacs
 * faces (bg #292b2e, accents #4f97d7 / #2d9574 / #bc6ec5).
 */

/** Two-column "chat client inside Emacs" frame. */
export const StyledChatPanel = styled.div`
  background: #292b2e;
  color: #b2b2b2;
  display: grid;
  font-family: ${({ theme }) => theme.formats.monoFont};
  font-size: 13px;
  grid-template-columns: 220px 1fr;
  grid-template-rows: auto 1fr;
  height: 100%;
  overflow: hidden;
  width: 100%;

  .sim-banner {
    background: #5d4d7a;
    color: #f8f8f8;
    font-size: 11px;
    grid-column: 1 / -1;
    letter-spacing: 0.3px;
    padding: 3px 10px;
    text-align: center;
    user-select: none;
  }

  .roster {
    border-right: 1px solid #212326;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .roster-head {
    color: #bc6ec5;
    font-weight: 700;
    padding: 6px 10px 4px;
    user-select: none;
  }

  .roster-item {
    border: 0;
    background: transparent;
    color: #b2b2b2;
    cursor: pointer;
    display: block;
    font: inherit;
    overflow: hidden;
    padding: 5px 10px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .roster-item:hover {
    background: #2d2f33;
  }

  .roster-item.active {
    background: #44505c;
    color: #ffffff;
  }

  .roster-item .who {
    color: #4f97d7;
    font-weight: 700;
  }

  .roster-item .preview {
    color: #6b6b6b;
    display: block;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .roster-item .badge {
    background: #2d9574;
    border-radius: 8px;
    color: #fff;
    float: right;
    font-size: 10px;
    padding: 0 6px;
  }

  .convo {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .convo-head {
    align-items: center;
    border-bottom: 1px solid #212326;
    color: #ffffff;
    display: flex;
    gap: 8px;
    padding: 6px 12px;
    user-select: none;
  }

  .convo-head .title {
    color: #4f97d7;
    font-weight: 700;
  }

  .convo-head .sub {
    color: #2d9574;
    font-size: 11px;
  }

  .messages {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px;
  }

  .msg {
    max-width: 78%;
  }

  .msg .meta {
    font-size: 10px;
  }

  .msg .meta .name {
    color: #bc6ec5;
    font-weight: 700;
  }

  .msg .meta .time {
    color: #6b6b6b;
    margin-left: 6px;
  }

  .msg .body {
    background: #32343a;
    border-radius: 4px;
    color: #d7d7d7;
    margin-top: 2px;
    padding: 4px 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg.me {
    align-self: flex-end;
    text-align: right;
  }

  .msg.me .body {
    background: #2d9574;
    color: #ffffff;
  }

  .composer {
    border-top: 1px solid #21232e;
    display: flex;
    gap: 8px;
    padding: 8px 12px;
  }

  .composer .prompt {
    color: #4f97d7;
    user-select: none;
  }

  .composer input {
    background: #1f2023;
    border: 1px solid #3a3c42;
    border-radius: 3px;
    color: #e5e5e5;
    flex: 1 1 auto;
    font: inherit;
    outline: none;
    padding: 4px 8px;
  }

  .composer input:focus {
    border-color: #4f97d7;
  }

  .empty {
    align-items: center;
    color: #6b6b6b;
    display: flex;
    flex: 1 1 auto;
    justify-content: center;
    padding: 20px;
    text-align: center;
  }
`;
