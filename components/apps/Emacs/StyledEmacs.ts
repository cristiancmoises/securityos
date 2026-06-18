import styled from "styled-components";

/**
 * SecurityOS Emacs — a first-party, dependency-free editor surface themed after
 * Spacemacs (spacemacs-dark).
 *
 * Layout: a flex column stacked top→bottom:
 *   1. .header-line — the buffer tab strip (Spacemacs header-line).
 *   2. .buffer      — the scrollable buffer (a monospace <textarea>) OR a panel.
 *   3. .mode-line   — Powerline-style segmented status bar.
 *   4. .minibuffer  — the echo area / interactive prompt at the very bottom.
 *
 * Palette (spacemacs-dark):
 *   bg #292b2e · fg #b2b2b2 · keyword #4f97d7 · string #2d9574
 *   mode-line bg #222226 · accents #5d4d7a / #bc6ec5
 * Everything is FLAT: no rounded corners, no glow. Powerline chevrons are CSS.
 */
const StyledEmacs = styled.div`
  background: #292b2e;
  color: #b2b2b2;
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.monoFont};
  font-size: 13px;
  height: 100%;
  line-height: 1.35;
  overflow: hidden;
  position: relative;
  width: 100%;

  /* ---- Header-line: the buffer tab strip ---- */
  .header-line {
    align-items: stretch;
    background: #1f2022;
    color: #b2b2b2;
    display: flex;
    flex: 0 0 auto;
    font-size: 12px;
    height: 22px;
    overflow: hidden;
    user-select: none;
    white-space: nowrap;
  }

  .header-line .tab {
    align-items: center;
    background: #292b2e;
    border-right: 1px solid #1f2022;
    border-top: 2px solid #4f97d7;
    color: #f8f8f8;
    display: flex;
    gap: 6px;
    padding: 0 14px;
  }

  .header-line .tab .dot {
    color: #bc6ec5;
  }

  .header-line .spacer {
    flex: 1 1 auto;
  }

  .header-line .hint {
    align-items: center;
    color: #5d6066;
    display: flex;
    padding: 0 12px;
  }

  .buffer {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .surface {
    background: #292b2e;
    border: 0;
    box-sizing: border-box;
    caret-color: #b2b2b2;
    color: #b2b2b2;
    display: block;
    font: inherit;
    height: 100%;
    margin: 0;
    outline: none;
    overflow: auto;
    padding: 4px 8px;
    resize: none;
    tab-size: 8;
    white-space: pre;
    width: 100%;
  }

  .surface::selection {
    /* Spacemacs region face. */
    background: #444155;
    color: #ffffff;
  }

  .surface::-webkit-scrollbar {
    height: 12px;
    width: 12px;
  }

  .surface::-webkit-scrollbar-thumb {
    background: #4d4f54;
  }

  .surface::-webkit-scrollbar-track {
    background: #1f2022;
  }

  /* ---- Powerline mode-line ---- */
  .mode-line {
    align-items: stretch;
    background: #222226;
    color: #b2b2b2;
    display: flex;
    flex: 0 0 auto;
    font-size: 12px;
    height: 22px;
    line-height: 22px;
    overflow: hidden;
    user-select: none;
    white-space: nowrap;
  }

  .mode-line .seg {
    align-items: center;
    display: flex;
    gap: 6px;
    padding: 0 12px 0 14px;
    position: relative;
  }

  /* Powerline chevron: a slanted triangle drawn with a rotated border. */
  .mode-line .seg::after {
    border-bottom: 11px solid transparent;
    border-left: 9px solid var(--seg-bg, transparent);
    border-top: 11px solid transparent;
    content: "";
    height: 0;
    position: absolute;
    right: -9px;
    top: 0;
    width: 0;
    z-index: 1;
  }

  .mode-line .seg.window {
    --seg-bg: #4f97d7;
    background: #4f97d7;
    color: #0b1620;
    font-weight: 700;
    padding-left: 10px;
  }

  .mode-line .seg.state {
    --seg-bg: #5d4d7a;
    background: #5d4d7a;
    color: #f8f8f8;
    font-weight: 700;
  }

  .mode-line .seg.buffer {
    --seg-bg: #3c3f44;
    background: #3c3f44;
    color: #f8f8f8;
  }

  .mode-line .seg.buffer .flags {
    color: #bc6ec5;
  }

  .mode-line .seg.major {
    --seg-bg: #2d2e32;
    background: #2d2e32;
    color: #2d9574;
  }

  .mode-line .seg.pos {
    --seg-bg: #222226;
    background: #222226;
    color: #8b8d91;
  }

  .mode-line .seg.pos::after {
    content: none;
  }

  .mode-line .fill {
    background: #222226;
    flex: 1 1 auto;
  }

  .mode-line .seg.right {
    background: #222226;
    color: #8b8d91;
    margin-left: auto;
  }

  .mode-line .seg.right::after {
    content: none;
  }

  .mode-line .seg.clock {
    --seg-bg: #2d2e32;
    background: #2d2e32;
    color: #bc6ec5;
  }

  .mode-line .seg.clock::after {
    content: none;
  }

  /* ---- Minibuffer / echo area ---- */
  .minibuffer {
    align-items: center;
    background: #212026;
    color: #b2b2b2;
    display: flex;
    flex: 0 0 auto;
    font-size: 13px;
    min-height: 20px;
    overflow: hidden;
    padding: 0 8px;
    white-space: pre;
  }

  .minibuffer .prompt {
    color: #4f97d7;
    white-space: pre;
  }

  .minibuffer .message {
    color: #b2b2b2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .minibuffer .mini-input {
    background: transparent;
    border: 0;
    color: #f8f8f8;
    flex: 1 1 auto;
    font: inherit;
    margin: 0;
    outline: none;
    padding: 0;
  }

  /* M-x completion candidates shown inline in the echo area. */
  .minibuffer .candidates {
    color: #2d9574;
    margin-left: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .minibuffer .candidates .cand {
    margin-right: 10px;
  }

  .minibuffer .candidates .cand.first {
    color: #bc6ec5;
    font-weight: 700;
  }
`;

export default StyledEmacs;
