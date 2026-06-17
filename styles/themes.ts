import type { DefaultTheme } from "styled-components";
import defaultTheme from "styles/defaultTheme";
import undercover from "styles/undercover";

const themes = { defaultTheme, undercover };

export type ThemeName = keyof typeof themes;

export default themes as Record<ThemeName, DefaultTheme>;
