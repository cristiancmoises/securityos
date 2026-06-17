/**
 * SecurityOS "Undercover" palette — a Windows 11 disguise (à la Kali Undercover).
 *
 * Same token shape as the default Cyber-Neon Glass palette, but light/neutral: white
 * glass surfaces, a muted Windows blue accent and NO neon glow (the `accent.*` glow
 * tokens go transparent). Paired with the light Win11 "bloom" wallpaper so dark text
 * stays readable on both the desktop and inside file windows.
 */
const colors = {
  accent: {
    bar: "linear-gradient(90deg, transparent, transparent)",

    /* Soft Win11 hairline along the top of the acrylic taskbar — no neon, just a
       faint light divider. */
    edge: "hsla(214, 22%, 62%, 42%)",
    glow: "hsla(214, 30%, 50%, 0%)",
    glowStrong: "hsla(214, 90%, 55%, 40%)",
    start: "hsla(214, 30%, 50%, 0%)",
  },
  background: "#dfe6f0",
  fileEntry: {
    background: "hsla(214, 40%, 60%, 12%)",
    backgroundFocused: "hsla(214, 90%, 58%, 22%)",
    backgroundFocusedHover: "hsla(214, 95%, 60%, 28%)",
    border: "hsla(214, 40%, 55%, 20%)",
    borderFocused: "hsla(214, 90%, 58%, 50%)",
    borderFocusedHover: "hsla(214, 95%, 60%, 65%)",
    text: "#1f2733",
    textShadow: `
      0 0 2px rgba(255, 255, 255, 75%),
      0 1px 1px rgba(255, 255, 255, 60%),
      0 1px 2px rgba(255, 255, 255, 45%)`,
  },
  highlight: "hsla(214, 90%, 52%, 95%)",
  highlightBackground: "hsla(214, 90%, 55%, 22%)",
  progress: "hsla(214, 90%, 52%, 95%)",
  progressBackground: "hsla(214, 30%, 70%, 60%)",
  progressBarRgb: "rgb(0, 120, 212)",
  startButton: "#2b6fd6",
  taskbar: {
    active: "hsla(214, 90%, 55%, 20%)",
    activeForeground: "hsla(214, 90%, 58%, 32%)",

    /* More translucent than a solid bar so the heavier Undercover backdrop blur
       reads as Win11 acrylic — the wallpaper frosts through the glass. */
    background: "hsla(214, 36%, 96%, 78%)",
    foreground: "hsla(214, 20%, 60%, 25%)",
    foregroundHover: "hsla(214, 90%, 58%, 22%)",
    foregroundProgress: "hsla(214, 90%, 55%, 28%)",
    hover: "hsla(214, 60%, 55%, 14%)",
    peekBorder: "hsla(214, 90%, 55%, 50%)",
  },
  text: "rgba(31, 39, 51, 92%)",
  titleBar: {
    background: "hsla(214, 33%, 97%, 95%)",
    backgroundHover: "hsla(214, 90%, 55%, 16%)",
    backgroundInactive: "hsla(214, 20%, 90%, 95%)",
    buttonInactive: "hsla(214, 15%, 45%, 100%)",
    closeHover: "rgb(232, 17, 35)",
    text: "rgb(31, 39, 51)",
    textInactive: "rgba(80, 90, 105, 70%)",
  },
  window: {
    background: "#fbfcfe",
    outline: "hsla(214, 25%, 60%, 55%)",
    outlineInactive: "hsla(214, 20%, 70%, 70%)",
    shadow: `0 0 0 1px hsla(214, 20%, 60%, 35%),
      0 16px 40px 2px hsla(214, 30%, 30%, 28%)`,
    shadowInactive: `0 8px 24px 0 hsla(214, 30%, 30%, 20%)`,
  },
};

export default colors;
