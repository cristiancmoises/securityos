/**
 * SecurityOS "Emacs" palette.
 *
 * A flat, monospace, Emacs-styled dark theme: a near-black backdrop, dark editor
 * "buffer" surfaces, a lighter-gray mode-line (the window title bars), and a single
 * region/selection blue as the accent — no neon glow (the `accent.*` glow tokens are
 * transparent). The whole desktop chrome reads from these tokens, so the look is
 * driven from here; the Undercover theme swaps them for a neutral light palette.
 */
const colors = {
  // Identity accents. Emacs is flat, so the "glow" tokens are transparent; only the
  // region/selection blue is a real accent. Consumed by the taskbar/start-menu/
  // clock/start-button chrome instead of hardcoded values.
  accent: {
    bar: "linear-gradient(90deg, transparent, transparent)",
    edge: "hsla(220, 7%, 40%, 70%)",
    glow: "hsla(220, 7%, 40%, 0%)",
    glowStrong: "hsla(222, 60%, 55%, 35%)",
    start: "hsla(220, 7%, 40%, 0%)",
  },
  background: "#1c1e22",
  fileEntry: {
    background: "hsla(222, 50%, 55%, 12%)",
    backgroundFocused: "hsla(222, 60%, 55%, 26%)",
    backgroundFocusedHover: "hsla(222, 65%, 58%, 32%)",
    border: "hsla(222, 50%, 55%, 24%)",
    borderFocused: "hsla(222, 60%, 58%, 50%)",
    borderFocusedHover: "hsla(222, 65%, 60%, 65%)",
    text: "#e0e0da",
    textShadow: `
      0 0 1px rgba(0, 0, 0, 75%),
      0 0 2px rgba(0, 0, 0, 50%),

      0 1px 1px rgba(0, 0, 0, 75%),
      0 1px 2px rgba(0, 0, 0, 50%),

      0 2px 1px rgba(0, 0, 0, 75%),
      0 2px 2px rgba(0, 0, 0, 50%)`,
  },
  highlight: "hsla(222, 62%, 56%, 95%)",
  highlightBackground: "hsla(222, 60%, 54%, 28%)",
  progress: "hsla(140, 55%, 50%, 95%)",
  progressBackground: "hsla(220, 10%, 35%, 60%)",
  progressBarRgb: "rgb(80, 200, 120)",
  startButton: "#cbb8e8",
  taskbar: {
    active: "hsla(222, 60%, 54%, 22%)",
    activeForeground: "hsla(222, 62%, 56%, 32%)",
    background: "hsla(220, 9%, 11%, 96%)",
    foreground: "hsla(220, 7%, 40%, 28%)",
    foregroundHover: "hsla(222, 60%, 56%, 24%)",
    foregroundProgress: "hsla(140, 55%, 50%, 30%)",
    hover: "hsla(222, 60%, 54%, 16%)",
    peekBorder: "hsla(220, 7%, 45%, 50%)",
  },
  text: "rgba(224, 224, 218, 95%)",
  titleBar: {
    background: "hsla(220, 8%, 28%, 98%)",
    backgroundHover: "hsla(222, 60%, 54%, 20%)",
    backgroundInactive: "hsla(220, 9%, 16%, 98%)",
    buttonInactive: "hsla(220, 8%, 55%, 100%)",
    closeHover: "rgb(204, 51, 51)",
    text: "rgb(232, 232, 226)",
    textInactive: "rgba(190, 190, 184, 55%)",
  },
  window: {
    background: "#232629",
    outline: "hsla(220, 7%, 42%, 80%)",
    outlineInactive: "hsla(220, 8%, 26%, 90%)",
    shadow: `0 0 0 1px hsla(220, 7%, 42%, 50%),
      0 8px 24px 2px hsla(220, 25%, 3%, 60%)`,
    shadowInactive: `0 6px 18px 0 hsla(220, 25%, 3%, 55%)`,
  },
};

export default colors;
