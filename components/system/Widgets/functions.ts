import {
  DEFAULT_WIDGETS_STATE,
  WIDGET_ORDER,
  WIDGETS_STORAGE_KEY,
} from "components/system/Widgets/constants";
import type {
  WeatherLocation,
  WidgetId,
  WidgetsState,
} from "components/system/Widgets/types";

/**
 * WMO weather_code -> emoji + short text.
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
export const weatherCodeToInfo = (
  code: number
): { icon: string; text: string } => {
  switch (code) {
    case 0:
      return { icon: "☀️", text: "Clear" };
    case 1:
      return { icon: "🌤️", text: "Mainly clear" };
    case 2:
      return { icon: "⛅", text: "Partly cloudy" };
    case 3:
      return { icon: "☁️", text: "Overcast" };
    case 45:
    case 48:
      return { icon: "🌫️", text: "Fog" };
    case 51:
    case 53:
    case 55:
      return { icon: "🌦️", text: "Drizzle" };
    case 56:
    case 57:
      return { icon: "🌧️", text: "Freezing drizzle" };
    case 61:
    case 63:
    case 65:
      return { icon: "🌧️", text: "Rain" };
    case 66:
    case 67:
      return { icon: "🌧️", text: "Freezing rain" };
    case 71:
    case 73:
    case 75:
      return { icon: "🌨️", text: "Snow" };
    case 77:
      return { icon: "🌨️", text: "Snow grains" };
    case 80:
    case 81:
    case 82:
      return { icon: "🌧️", text: "Rain showers" };
    case 85:
    case 86:
      return { icon: "🌨️", text: "Snow showers" };
    case 95:
      return { icon: "⛈️", text: "Thunderstorm" };
    case 96:
    case 99:
      return { icon: "⛈️", text: "Thunderstorm + hail" };
    default:
      return { icon: "❓", text: "Unknown" };
  }
};

/** A readable, single-line label for a location. */
export const formatLocation = (location: WeatherLocation): string =>
  [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");

/** Short weekday label (e.g. "Mon") for a `YYYY-MM-DD` date string. */
export const shortDay = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString(undefined, { weekday: "short" });
};

/**
 * Defensive merge of persisted state onto defaults so adding a new widget id
 * later never breaks an older saved layout.
 */
export const normalizeState = (raw: unknown): WidgetsState => {
  const base: WidgetsState = {
    positions: { ...DEFAULT_WIDGETS_STATE.positions },
    settings: {
      ...DEFAULT_WIDGETS_STATE.settings,
      weatherLocation: {
        ...DEFAULT_WIDGETS_STATE.settings.weatherLocation,
      },
    },
    visible: { ...DEFAULT_WIDGETS_STATE.visible },
  };

  if (!raw || typeof raw !== "object") return base;

  const parsed = raw as Partial<WidgetsState>;

  WIDGET_ORDER.forEach((id) => {
    const visible = parsed.visible?.[id];

    if (typeof visible === "boolean") base.visible[id] = visible;

    const position = parsed.positions?.[id];

    if (
      position &&
      typeof position.x === "number" &&
      typeof position.y === "number" &&
      Number.isFinite(position.x) &&
      Number.isFinite(position.y)
    ) {
      base.positions[id] = { x: position.x, y: position.y };
    }
  });

  if (typeof parsed.settings?.newsFeedUrl === "string") {
    base.settings.newsFeedUrl = parsed.settings.newsFeedUrl;
  }

  const location = parsed.settings?.weatherLocation;

  if (
    location &&
    typeof location.name === "string" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    base.settings.weatherLocation = {
      admin1: typeof location.admin1 === "string" ? location.admin1 : undefined,
      country:
        typeof location.country === "string" ? location.country : undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
    };
  }

  return base;
};

/** Read + normalize persisted layout (SSR/quota-safe). */
export const loadWidgetsState = (): WidgetsState => {
  if (typeof window === "undefined") return normalizeState(undefined);

  try {
    const stored = window.localStorage.getItem(WIDGETS_STORAGE_KEY);

    return normalizeState(stored ? JSON.parse(stored) : undefined);
  } catch {
    return normalizeState(undefined);
  }
};

/** Persist layout (best-effort; never throws). */
export const saveWidgetsState = (state: WidgetsState): void => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / disabled storage.
  }
};

/**
 * Clamp a position so a dragged card stays at least partly on screen (keeps a
 * sliver visible so it can always be grabbed again).
 */
export const clampPosition = (
  x: number,
  y: number,
  cardWidth = 0,
  cardHeight = 0
): { x: number; y: number } => {
  if (typeof window === "undefined") return { x, y };

  const margin = 24;
  const maxX = Math.max(0, window.innerWidth - margin);
  const maxY = Math.max(0, window.innerHeight - margin);
  const minX = -(cardWidth - margin);
  const minY = 0;

  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
};

/** Type guard for a widget id from arbitrary input. */
export const isWidgetId = (value: string): value is WidgetId =>
  (WIDGET_ORDER as string[]).includes(value);
