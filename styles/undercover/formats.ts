import defaultFormats from "styles/defaultTheme/formats";

// The default theme is fully monospace; Undercover uses a neutral system sans stack
// for a familiar enterprise workspace. Terminal/code typography remains unchanged.
const SANS = "system-ui, Inter, Roboto, 'Helvetica Neue', Arial, sans-serif";

const formats = {
  ...defaultFormats,
  displayFont: SANS,
  systemFont: SANS,
};

export default formats;
