import defaultFormats from "styles/defaultTheme/formats";

// Undercover (Windows 11) typography: the default theme is fully monospace (Emacs);
// Win11 uses Segoe UI everywhere, so override both the body and display fonts back
// to a sans stack. The mono font (terminals/code) is unchanged.
const SANS = "'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif";

const formats = {
  ...defaultFormats,
  displayFont: SANS,
  systemFont: SANS,
};

export default formats;
