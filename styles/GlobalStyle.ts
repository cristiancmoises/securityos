import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  /* Self-hosted webfonts (SIL OFL — free for any use, no network call, Tor-safe).
     JetBrains Mono powers the whole monospace UI (and terminal/code surfaces).
     font-display: swap so the system stack shows instantly. */
  @font-face {
    font-family: 'JetBrains Mono';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url('/Fonts/jetbrains-mono-latin-400.woff2') format('woff2');
  }

  @font-face {
    font-family: 'JetBrains Mono';
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url('/Fonts/jetbrains-mono-latin-700.woff2') format('woff2');
  }

  *,
  *::before,
  *::after {
    border: 0;
    box-sizing: border-box;
    cursor: default;
    font-variant-numeric: tabular-nums;
    margin: 0;
    outline: 0;
    padding: 0;
    text-rendering: optimizeLegibility;
    -webkit-touch-callout: none;
    user-select: none;

    /* Fast webOS: collapse CSS *transitions* (the window/menu/hover easing that
       makes the desktop feel sluggish) to ~instant, and disable smooth scrolling.
       We deliberately do NOT touch animation-* properties: looping keyframe
       animations are
       decorative and cheap (progress-bar gradient, spinners) and zeroing them just
       makes them flicker. framer-motion entrance/exit is reduced separately via
       MotionConfig reducedMotion="always" in StyledApp. */
    transition-duration: 0.001ms !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }

  body, html {
    font-family: ${({ theme }) => theme.formats.systemFont};
  }

  body {
    height: 100%;
    overflow: hidden;
    text-size-adjust: none;
  }

  html {
    /* Flat Emacs-style backdrop (no neon gradient). useWallpaper paints over this;
       it's just the fallback before the wallpaper image loads. */
    background-color: ${({ theme }) => theme.colors.background};
    background-position: center;
  }

  input::selection,
  textarea::selection,
  ::selection {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    color: #fff;
  }

  input, textarea {
    cursor: text;
    user-select: text;
  }

  picture > img {
    display: block;
  }

  ol,
  ul {
    list-style: none;
  }
`;

export default GlobalStyle;
