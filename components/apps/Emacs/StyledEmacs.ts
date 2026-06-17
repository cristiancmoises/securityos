import styled from "styled-components";

/**
 * GNU Emacs — a first-party, dependency-free editor surface.
 *
 * Layout: a flex column of three regions stacked top→bottom:
 *   1. .buffer      — the scrollable buffer (a monospace <textarea>).
 *   2. .mode-line   — the classic gray status bar.
 *   3. .minibuffer  — the echo area / interactive prompt at the very bottom.
 *
 * Everything is FLAT: no rounded corners, no glow, no shadows. The palette is
 * the default Emacs dark theme (#1d1f21 buffer, light text, gray mode-line).
 */
const StyledEmacs = styled.div`
  background: #1d1f21;
  color: #c5c8c6;
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.monoFont};
  font-size: 13px;
  height: 100%;
  line-height: 1.35;
  overflow: hidden;
  width: 100%;

  .buffer {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .surface {
    background: #1d1f21;
    border: 0;
    box-sizing: border-box;
    caret-color: #fff;
    color: #c5c8c6;
    display: block;
    font: inherit;
    height: 100%;
    margin: 0;
    outline: none;
    overflow: auto;
    padding: 2px 6px;
    resize: none;
    tab-size: 8;
    white-space: pre;
    width: 100%;
  }

  .surface::selection {
    /* Emacs region face: blue-gray highlight. */
    background: #373b41;
    color: #fff;
  }

  .surface::-webkit-scrollbar {
    height: 12px;
    width: 12px;
  }

  .surface::-webkit-scrollbar-thumb {
    background: #4b4f54;
  }

  .surface::-webkit-scrollbar-track {
    background: #15171a;
  }

  .mode-line {
    align-items: center;
    background: #c5c8c6;
    color: #1d1f21;
    display: flex;
    flex: 0 0 auto;
    font-size: 12px;
    gap: 10px;
    height: 20px;
    line-height: 20px;
    overflow: hidden;
    padding: 0 6px;
    user-select: none;
    white-space: nowrap;
  }

  .mode-line .flags {
    color: #303336;
    letter-spacing: -0.3px;
  }

  .mode-line .name {
    font-weight: 700;
  }

  .mode-line .major {
    color: #303336;
  }

  .mode-line .pos {
    color: #303336;
  }

  .mode-line .where {
    color: #303336;
    margin-left: auto;
  }

  .minibuffer {
    align-items: center;
    background: #1d1f21;
    color: #c5c8c6;
    display: flex;
    flex: 0 0 auto;
    font-size: 13px;
    height: 20px;
    line-height: 20px;
    min-height: 20px;
    overflow: hidden;
    padding: 0 6px;
    white-space: pre;
  }

  .minibuffer .prompt {
    color: #c5c8c6;
    white-space: pre;
  }

  .minibuffer .message {
    color: #c5c8c6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .minibuffer .mini-input {
    background: transparent;
    border: 0;
    color: #fff;
    flex: 1 1 auto;
    font: inherit;
    margin: 0;
    outline: none;
    padding: 0;
  }
`;

export default StyledEmacs;
