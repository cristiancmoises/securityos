/**
 * SecurityOS "Undercover" palette — a neutral enterprise-workspace disguise.
 *
 * Same token shape as the default Cyber-Neon Glass palette, but tuned toward the
 * Translucent light-grey surfaces, a restrained blue accent, and no neon glow.
 * Paired with the original light abstract wallpaper so dark text stays readable on
 * both the desktop and inside file windows.
 *
 * NOTE: this object spreads the default palette elsewhere — only VALUES are overridden
 * here; the key shape is preserved exactly. No third-party branding or assets.
 */
const TRANSPARENT_GLOW = "hsla(206, 100%, 36%, 0%)";

const colors = {
  accent: {
    bar: "linear-gradient(90deg, transparent, transparent)",

    /* Soft hairline along the top of the acrylic taskbar. */
    edge: "hsla(214, 18%, 70%, 38%)",
    glow: TRANSPARENT_GLOW,
    glowStrong: TRANSPARENT_GLOW,
    start: TRANSPARENT_GLOW,
  },
  background: "#e6e9ef",
  fileEntry: {
    background: "hsla(206, 30%, 60%, 10%)",
    backgroundFocused: "hsla(206, 100%, 40%, 20%)",
    backgroundFocusedHover: "hsla(206, 100%, 42%, 26%)",
    border: "hsla(206, 30%, 55%, 18%)",
    borderFocused: "hsla(206, 100%, 40%, 48%)",
    borderFocusedHover: "hsla(206, 100%, 42%, 62%)",
    text: "#1f2733",
    textShadow: `
      0 0 2px rgba(255, 255, 255, 75%),
      0 1px 1px rgba(255, 255, 255, 60%),
      0 1px 2px rgba(255, 255, 255, 45%)`,
  },
  /* Restrained selection/highlight blue. */
  highlight: "hsla(206, 100%, 36%, 95%)",
  highlightBackground: "hsla(206, 100%, 40%, 22%)",
  progress: "hsla(206, 100%, 36%, 95%)",
  progressBackground: "hsla(206, 25%, 72%, 60%)",
  progressBarRgb: "rgb(0, 95, 184)",
  startButton: "#005fb8",
  taskbar: {
    active: "hsla(206, 100%, 40%, 18%)",
    activeForeground: "hsla(206, 100%, 42%, 30%)",

    /* Neutral translucent taskbar surface; the original wallpaper frosts through. */
    background: "hsla(0, 0%, 96%, 82%)",
    foreground: "hsla(0, 0%, 55%, 25%)",
    foregroundHover: "hsla(206, 100%, 40%, 20%)",
    foregroundProgress: "hsla(206, 100%, 40%, 26%)",
    hover: "hsla(0, 0%, 50%, 14%)",
    peekBorder: "hsla(206, 100%, 40%, 50%)",
  },
  text: "rgba(31, 39, 51, 92%)",
  titleBar: {
    background: "hsla(0, 0%, 98%, 95%)",
    backgroundHover: "hsla(206, 100%, 40%, 14%)",
    backgroundInactive: "hsla(0, 0%, 92%, 95%)",
    buttonInactive: "hsla(0, 0%, 42%, 100%)",
    /* Generic close-button red. */
    closeHover: "rgb(232, 17, 35)",
    text: "rgb(31, 39, 51)",
    textInactive: "rgba(80, 90, 105, 70%)",
  },
  window: {
    background: "#fbfcfe",
    outline: "hsla(0, 0%, 60%, 50%)",
    outlineInactive: "hsla(0, 0%, 70%, 65%)",
    shadow: `0 0 0 1px hsla(0, 0%, 60%, 32%),
      0 16px 40px 2px hsla(214, 25%, 30%, 26%)`,
    shadowInactive: `0 8px 24px 0 hsla(214, 25%, 30%, 18%)`,
  },
};

export default colors;
