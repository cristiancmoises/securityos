// Radio — shared types for the SecurityOS internet-radio app. Stations come from
// the free, no-key radio-browser API (https). See useRadio.ts for the data flow.

// The subset of fields the radio-browser /json/stations/search endpoint returns
// that this app actually uses. (The API returns many more we ignore.)
export type RawStation = {
  bitrate?: number;
  codec?: string;
  countrycode?: string;
  country?: string;
  favicon?: string;
  name?: string;
  stationuuid?: string;
  tags?: string;
  url_resolved?: string;
};

// A station after normalization: trimmed, deduped, and known to have an https
// stream (or flagged otherwise so the UI can warn). favicon is kept only if https.
export type Station = {
  bitrate: number;
  codec: string;
  country: string;
  favicon: string;
  // false when the resolved stream URL is http:// (CSP/mixed-content would block
  // playback) — the UI shows a note and disables play for these.
  hasHttps: boolean;
  name: string;
  tags: string;
  url: string;
  uuid: string;
};

// A radio-browser /json/countries entry (filter dropdown).
export type Country = {
  name: string;
  stationcount: number;
};

// A radio-browser /json/tags entry (genre filter dropdown).
export type Tag = {
  name: string;
  stationcount: number;
};

// A persisted favorite — a slimmed Station kept in localStorage so favorites
// survive reloads without depending on the OS session context.
export type Favorite = {
  bitrate: number;
  country: string;
  favicon: string;
  name: string;
  url: string;
  uuid: string;
};
