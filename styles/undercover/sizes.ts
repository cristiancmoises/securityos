import defaultSizes from "styles/defaultTheme/sizes";

// Undercover keeps the default layout with rounder windows and a stronger taskbar
// blur for its neutral enterprise-workspace look. The key shape remains assignable
// to DefaultTheme.
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
