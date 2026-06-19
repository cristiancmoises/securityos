import type { WidgetId, WidgetsState } from "components/system/Widgets/types";

/** localStorage key holding the serialized {@link WidgetsState}. */
export const WIDGETS_STORAGE_KEY = "securityos:widgets";

/** Open-meteo endpoints (free, no key, CORS-enabled, https). */
export const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";
export const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

/** Same-origin GET proxy (fetches over Tor) — see Browser/config PROXY_PATH. */
export const PROXY_PATH = "/api/proxy?url=";

/** Default feed for the News widget (a security/tech source). */
export const DEFAULT_NEWS_FEED =
  "https://feeds.arstechnica.com/arstechnica/index";

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
  clock: "Clock",
  cpu: "CPU (estimated)",
  memory: "Memory",
  news: "News",
  weather: "Weather",
};

/** Render order — also the order in the gear panel. */
export const WIDGET_ORDER: WidgetId[] = [
  "clock",
  "weather",
  "memory",
  "cpu",
  "news",
];

/**
 * Default layout. Positions are staggered down the right side so cards do not
 * overlap on first run; the user can drag them anywhere afterwards.
 */
export const DEFAULT_WIDGETS_STATE: WidgetsState = {
  positions: {
    clock: { x: 24, y: 24 },
    cpu: { x: 24, y: 470 },
    memory: { x: 24, y: 340 },
    news: { x: 24, y: 590 },
    weather: { x: 24, y: 150 },
  },
  settings: {
    newsFeedUrl: DEFAULT_NEWS_FEED,
    weatherLocation: { ...DEFAULT_WEATHER_LOCATION },
  },
  visible: {
    clock: true,
    cpu: false,
    memory: false,
    news: false,
    weather: false,
  },
};

/** Refresh cadences (ms). */
export const CLOCK_TICK_MS = 1_000;
export const WEATHER_REFRESH_MS = 15 * 60 * 1_000;
export const NEWS_REFRESH_MS = 15 * 60 * 1_000;
export const MEMORY_TICK_MS = 2_000;

export const MAX_NEWS_HEADLINES = 6;
