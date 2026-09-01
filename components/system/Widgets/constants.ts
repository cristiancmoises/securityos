import type { WidgetId, WidgetsState } from "components/system/Widgets/types";

/** localStorage key holding the serialized {@link WidgetsState}. */
export const WIDGETS_STORAGE_KEY = "securityos:widgets";

/** Open-meteo endpoints (free, no key, CORS-enabled, https). */
export const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
export const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

/** Same-origin GET proxy (fetches over Tor) — see Browser/config PROXY_PATH. */
export const PROXY_PATH = "/api/proxy?url=";

/** Default feed for the News widget (a security/tech source). */
export const DEFAULT_NEWS_FEED =
  "https://feeds.arstechnica.com/arstechnica/index";

/** Starter content shown in a fresh Post-it (sticky note) widget. */
export const DEFAULT_POST_IT_TEXT = "";

/**
 * Approximate rendered card widths (px), used only to compute the responsive
 * first-run default layout. Cards size to content, so these are estimates that
 * just need to be close enough to look centered / right-aligned on first paint.
 */
export const CLOCK_CARD_WIDTH = 280;
export const NEWS_CARD_WIDTH = 312;
/** Outer margin from the viewport edges for the default layout. */
export const EDGE_MARGIN = 16;

/** Default weather location (used until the user picks a city). */
export const DEFAULT_WEATHER_LOCATION = {
  admin1: "England",
  country: "United Kingdom",
  latitude: 51.5085,
  longitude: -0.1257,
  name: "London",
} as const;

/** Human-readable labels for the gear toggle list. */
export const WIDGET_LABELS: Record<WidgetId, string> = {
  calendar: "Calendar",
  clock: "Clock",
  memory: "Memory",
  news: "News",
  postit: "Post-it",
  weather: "Weather",
};

/** Render order — also the order in the gear panel. */
export const WIDGET_ORDER: WidgetId[] = [
  "clock",
  "weather",
  "memory",
  "news",
  "calendar",
  "postit",
];

/**
 * Static fallback positions. The real first-run layout (Clock middle-top, News
 * top-right) is computed responsively from the viewport in {@link normalizeState}
 * when there is no saved state; these constants are the SSR-safe defaults and the
 * resting positions for the other (hidden-by-default) widgets.
 */
export const DEFAULT_WIDGETS_STATE: WidgetsState = {
  positions: {
    calendar: { x: 24, y: 340 },
    clock: { x: 24, y: 24 },
    memory: { x: 24, y: 200 },
    news: { x: 24, y: 470 },
    postit: { x: 24, y: 640 },
    weather: { x: 24, y: 60 },
  },
  settings: {
    newsFeedUrl: DEFAULT_NEWS_FEED,
    postItText: DEFAULT_POST_IT_TEXT,
    weatherLocation: { ...DEFAULT_WEATHER_LOCATION },
  },
  visible: {
    calendar: false,
    clock: true,
    memory: false,
    news: true,
    postit: false,
    weather: false,
  },
};

/** Refresh cadences (ms). */
export const CLOCK_TICK_MS = 1_000;
export const WEATHER_REFRESH_MS = 15 * 60 * 1_000;
export const NEWS_REFRESH_MS = 15 * 60 * 1_000;
export const MEMORY_TICK_MS = 2_000;

/** Short weekday headers for the Calendar widget grid (Sun-first). */
export const CALENDAR_WEEKDAYS = [
  "Su",
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
] as const;

export const MAX_NEWS_HEADLINES = 6;
