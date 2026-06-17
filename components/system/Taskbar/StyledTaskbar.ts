import styled from "styled-components";
import { TASKBAR_HEIGHT } from "utils/constants";

const StyledTaskbar = styled.nav`
  backdrop-filter: ${({ theme }) =>
    theme.name === "Undercover"
      ? /* Win11 "acrylic": a heavier blur + extra saturation over a lighter
           translucent surface so the wallpaper bleeds through as frosted glass. */
        `blur(${theme.sizes.taskbar.blur}) saturate(180%) brightness(108%)`
      : `blur(${theme.sizes.taskbar.blur}) saturate(160%)`};
  background-color: ${({ theme }) => theme.colors.taskbar.background};

  /* Neon top edge: a thin cyan->magenta hairline plus an upward glow that lifts
     the bar off the desktop — the signature Cyber-Neon Glass detail. Theme-driven
     so Undercover (Windows 11) flattens it to a plain, glow-free bar. */
  border-top: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
  bottom: 0;

  /* Undercover drops the neon up-glow and the deep dark lift for a clean acrylic
     hairline; the default keeps the full Cyber-Neon Glass shadow stack. */
  box-shadow: ${({ theme }) =>
    theme.name === "Undercover"
      ? `0 -1px 0 0 ${theme.colors.accent.edge}, 0 -1px 12px -4px hsla(214, 30%, 40%, 22%)`
      : `0 -1px 0 0 ${theme.colors.accent.edge}, 0 -10px 30px -6px hsla(222, 70%, 2%, 70%), 0 0 22px 0 ${theme.colors.accent.glow}`};
  contain: size layout;
  height: ${TASKBAR_HEIGHT}px;
  left: 0;
  position: absolute;
  right: 0;
  width: 100vw;
  z-index: 100000;

  &::before {
    background: ${({ theme }) => theme.colors.accent.bar};
    content: "";
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
    top: -1px;
  }
`;

export default StyledTaskbar;
