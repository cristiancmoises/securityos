import defaultSizes from "styles/defaultTheme/sizes";

// Undercover (Windows 11) sizing: same layout as default, but rounder window
// corners to match Win11's 8px radius and a softer/stronger taskbar blur for
// the acrylic look. (Same KEYS as defaultSizes so it stays assignable to
// DefaultTheme.)
const sizes = {
  ...defaultSizes,
  taskbar: {
    ...defaultSizes.taskbar,
    blur: "30px",
  },
  window: {
    ...defaultSizes.window,
    radius: "8px",
  },
};

export default sizes;
