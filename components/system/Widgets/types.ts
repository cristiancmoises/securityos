// Shared types for the Rainmeter-like desktop Widgets layer.

/** The stable id for each available widget. */
export type WidgetId =
  | "clock"
  | "weather"
  | "memory"
  | "news"
  | "calendar"
  | "postit";

/** A widget's on-desktop position (top-left, in px, relative to the layer). */
export type WidgetPosition = {
  x: number;
  y: number;
};

/** A resolved weather location (from the open-meteo geocoder). */
export type WeatherLocation = {
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  name: string;
};

/** User-tunable settings (location, feed URL, sticky-note text, ...). */
export type WidgetSettings = {
  newsFeedUrl: string;
  /** Free-text content of the Post-it (sticky note) widget. */
  postItText: string;
  weatherLocation: WeatherLocation;
};

/** The full persisted layout: which widgets are shown + where they sit. */
export type WidgetsState = {
  positions: Partial<Record<WidgetId, WidgetPosition>>;
  settings: WidgetSettings;
  visible: Record<WidgetId, boolean>;
};

/** Props shared by every individual widget card. */
export type WidgetProps = {
  id: WidgetId;
  /** Bring this card to the front (raise z-index) on interaction. */
  onFocus: (id: WidgetId) => void;
  /** Persist a new position while/after dragging. */
  onMove: (id: WidgetId, position: WidgetPosition) => void;
  position: WidgetPosition;
  /** Stacking order — higher = on top. */
  zIndex: number;
};
