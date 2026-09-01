import styled, { keyframes } from "styled-components";

/**
 * Full-screen lock overlay with a neutral frosted-glass style.
 *
 * Sits above everything (z-index well past windows, taskbar and menus) and
 * captures all pointer/keyboard input so the desktop is inert while locked.
 * The wallpaper is reused via `background: inherit` from the document element
 * (set by useWallpaper on documentElement.style.background) and then blurred +
 * dimmed behind a frosted unlock card. All colors come from theme tokens.
 */

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-10px); }
  30% { transform: translateX(9px); }
  45% { transform: translateX(-7px); }
  60% { transform: translateX(5px); }
  75% { transform: translateX(-3px); }
  90% { transform: translateX(2px); }
`;

const StyledLockscreen = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.colors.background};
  bottom: 0;
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  inset: 0;
  justify-content: center;
  left: 0;
  overflow: hidden;
  position: fixed;
  right: 0;
  top: 0;
  user-select: none;
  /* Above windows, taskbar, menus and dialogs. */
  z-index: 2147483646;

  /* Blurred + dimmed copy of the live desktop wallpaper.
     The actual background shorthand is set inline from
     documentElement.style.background (the wallpaper useWallpaper applied);
     when empty it falls back to the solid theme background above. */
  .backdrop {
    background-color: ${({ theme }) => theme.colors.background};
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    filter: blur(22px) brightness(0.6) saturate(1.1);
    /* Negative inset hides blur fringing at the edges. */
    inset: -40px;
    pointer-events: none;
    position: absolute;
    transform: scale(1.06);
    z-index: 0;
  }

  .scrim {
    background: linear-gradient(180deg, rgb(0 0 0 / 35%), rgb(0 0 0 / 55%));
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 1;
  }

  .clock-area {
    align-items: center;
    display: flex;
    flex-direction: column;
    margin-bottom: 6vh;
    position: relative;
    text-align: center;
    text-shadow: 0 2px 12px rgb(0 0 0 / 60%);
    z-index: 2;
  }

  .time {
    font-size: clamp(64px, 12vw, 140px);
    font-weight: 600;
    letter-spacing: 2px;
    line-height: 1;
  }

  .date {
    font-size: clamp(18px, 2.4vw, 30px);
    font-weight: 500;
    margin-top: 12px;
    opacity: 0.92;
    white-space: pre-line;
  }

  .card {
    align-items: center;
    backdrop-filter: blur(${({ theme }) => theme.sizes.taskbar.blur})
      saturate(160%);
    background-color: ${({ theme }) => theme.colors.taskbar.background};
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 14px;
    box-shadow: 0 12px 40px rgb(0 0 0 / 55%);
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 300px;
    padding: 26px 28px;
    position: relative;
    z-index: 2;
  }

  .card.shake {
    animation: ${shake} 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  .hint {
    color: ${({ theme }) => theme.colors.text};
    font-size: 15px;
    opacity: 0.85;
    text-align: center;
  }

  .pin-row {
    display: flex;
    gap: 8px;
  }

  .pin-row input {
    background-color: rgb(255 255 255 / 8%);
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 8px;
    caret-color: ${({ theme }) => theme.colors.highlight};
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 22px;
    letter-spacing: 8px;
    outline: none;
    padding: 10px 14px;
    text-align: center;
    width: 180px;
  }

  .pin-row input:focus {
    border-color: ${({ theme }) => theme.colors.highlight};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.highlightBackground};
  }

  .pin-row button,
  .swipe button {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 8px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 18px;
    padding: 0 16px;
  }

  .pin-row button:hover,
  .swipe button:hover {
    background-color: ${({ theme }) => theme.colors.highlight};
  }

  .error {
    color: ${({ theme }) => theme.colors.titleBar.closeHover};
    font-size: 13px;
    min-height: 16px;
    text-align: center;
  }

  .swipe {
    align-items: center;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .swipe .chevron {
    animation: bob 1.6s ease-in-out infinite;
    font-size: 28px;
    line-height: 1;
    opacity: 0.85;
  }

  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }

  .settings {
    background: transparent;
    border: 0;
    bottom: 22px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    opacity: 0.7;
    padding: 6px 10px;
    position: absolute;
    z-index: 2;
  }

  .settings:hover {
    opacity: 1;
    text-decoration: underline;
  }

  .pin-setup {
    align-items: stretch;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 280px;
  }

  .pin-setup label {
    color: ${({ theme }) => theme.colors.text};
    font-size: 12px;
    opacity: 0.85;
  }

  .pin-setup input {
    background-color: rgb(255 255 255 / 8%);
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 8px;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 16px;
    letter-spacing: 4px;
    outline: none;
    padding: 8px 12px;
    text-align: center;
  }

  .pin-setup .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .pin-setup .actions button {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 8px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 7px 14px;
  }

  .pin-setup .actions button:hover {
    background-color: ${({ theme }) => theme.colors.highlight};
  }

  .pin-setup .idle {
    align-items: center;
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .pin-setup .idle input {
    letter-spacing: 0;
    text-align: center;
    width: 70px;
  }
`;

export default StyledLockscreen;
