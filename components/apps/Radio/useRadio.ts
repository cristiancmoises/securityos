import type {
  Country,
  Favorite,
  RawCountry,
  RawStation,
  Station,
  Tag,
} from "components/apps/Radio/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Radio — listen to internet radio worldwide via the free, no-key radio-browser
// API (https). All fetches go to a radio-browser https host; all playback uses
// the station's resolved https stream URL (http:// streams are skipped because
// the OS CSP / mixed-content rules block them).
//
// PRIVACY NOTE: unlike most of SecurityOS, radio streams play over the browser's
// DIRECT connection, NOT over Tor — an <audio> element streams straight from the
// station's CDN. The radio-browser API metadata calls are likewise direct. Treat
// listening as non-anonymous.

// radio-browser publishes several round-robin server mirrors. ANY single mirror
// can be down at a given moment (the cause of "many servers don't work"), so we
// keep a list of the known-healthy mirrors, try them in order, and REMEMBER the
// first that answers for the rest of the session (so we don't re-pay the dead-host
// timeout on every call). All are https, so the OS CSP (`connect-src https:`)
// allows them with no header changes.
const API_HOSTS = [
  "https://de2.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
];

// Per-host attempt timeout: a hung/blackholed mirror must not stall the whole app
// — abort it and move to the next host quickly.
const HOST_TIMEOUT_MS = 8_000;

// The mirror that last answered, tried first next time (module-scoped so it
// survives app re-mounts within a session). Empty until the first success.
let preferredHost = "";

// radio-browser asks clients to send an identifying User-Agent; browsers forbid
// setting it from fetch, so we pass it as a query hint where the API accepts it.
const SEARCH_LIMIT = 100;
const COUNTRY_LIMIT = 300;
const TAG_LIMIT = 120;

const LS_PREFS = "securityos:radio:prefs";
const LS_FAVORITES = "securityos:radio:favorites";

type Prefs = { country: string; tag: string };

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable/full — favorites + prefs are best-effort.
  }
};

const isHttps = (url?: string): boolean => !!url && url.startsWith("https://");

// Normalize a raw API station into our Station shape, KEEPING ONLY stations that
// actually work in this app and dropping the dead/offline ones:
//   • the resolved stream must be https — an http:// stream can never play on an
//     https page (mixed content is blocked), so it would only ever appear broken;
//   • it must have passed radio-browser's last reachability check (lastcheckok!==0)
//     — that, with the API's hidebroken=true, removes the "offline radios".
// Non-https favicons are also dropped (kept strict to avoid mixed-content warnings).
const normalize = (raw: RawStation): Station | undefined => {
  const url = raw.url_resolved?.trim() ?? "";
  const uuid = raw.stationuuid?.trim() ?? "";
  const name = raw.name?.trim() ?? "";

  if (!uuid || !name || !url) return undefined;
  // Remove the non-working stations: http-only (can't play here) and ones the
  // directory last saw offline.
  if (!isHttps(url)) return undefined;
  if (raw.lastcheckok === 0) return undefined;

  return {
    bitrate: typeof raw.bitrate === "number" ? raw.bitrate : 0,
    codec: raw.codec?.trim() ?? "",
    country: raw.country?.trim() || raw.countrycode?.trim() || "",
    favicon: isHttps(raw.favicon) && raw.favicon ? raw.favicon.trim() : "",
    hasHttps: true,
    name,
    tags: raw.tags?.trim() ?? "",
    url,
    uuid,
  };
};

// Dedupe stations by uuid (the API can return duplicates across mirrors/aliases).
const dedupe = (stations: Station[]): Station[] => {
  const seen = new Set<string>();

  return stations.filter((station) => {
    if (seen.has(station.uuid)) return false;
    seen.add(station.uuid);

    return true;
  });
};

// One mirror attempt: races the fetch against a per-host timeout and the caller's
// abort signal, so a dead mirror is abandoned fast instead of hanging the search.
const fetchHost = async <T>(
  host: string,
  path: string,
  signal: AbortSignal
): Promise<T> => {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();

  signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), HOST_TIMEOUT_MS);

  try {
    const response = await fetch(`${host}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
};

// Fetch JSON from radio-browser, trying the remembered-good mirror first and then
// the rest until one answers (DNS/network/5xx/timeout all fall through). The first
// mirror that succeeds becomes `preferredHost` so later calls skip the dead ones.
const apiFetch = async <T>(path: string, signal: AbortSignal): Promise<T> => {
  const ordered = preferredHost
    ? [preferredHost, ...API_HOSTS.filter((host) => host !== preferredHost)]
    : API_HOSTS;
  let lastError: unknown;

  for (const host of ordered) {
    if (signal.aborted) throw new Error("aborted");

    try {
      // eslint-disable-next-line no-await-in-loop
      const data = await fetchHost<T>(host, path, signal);

      preferredHost = host;

      return data;
    } catch (error) {
      // The CALLER aborted (new search started / app closed) — stop, don't keep
      // hammering other mirrors for a result nobody wants.
      if (signal.aborted) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Network request failed");
};

export type UseRadio = {
  country: string;
  countries: Country[];
  error: string;
  favorites: Favorite[];
  isFavorite: (uuid: string) => boolean;
  loading: boolean;
  search: (overrides?: {
    country?: string;
    name?: string;
    tag?: string;
  }) => void;
  searchTerm: string;
  setCountry: (country: string) => void;
  setSearchTerm: (term: string) => void;
  setTag: (tag: string) => void;
  stations: Station[];
  tag: string;
  tags: Tag[];
  toggleFavorite: (station: Station | Favorite) => void;
};

const useRadio = (): UseRadio => {
  const initialPrefs = useMemo(() => {
    const prefs = readJson<Prefs>(LS_PREFS, { country: "", tag: "" });

    // Older builds persisted a country NAME; the filter now keys on the ISO code,
    // so ignore anything that isn't a 2-letter code (the user re-picks once).
    return {
      country: /^[A-Za-z]{2}$/.test(prefs.country || "")
        ? prefs.country.toUpperCase()
        : "",
      tag: prefs.tag || "",
    };
  }, []);
  const [countries, setCountries] = useState<Country[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>(() => {
    // Guard against corrupt/stale localStorage that is valid JSON but not an
    // array of well-formed favorites — otherwise favorites.some/.map throw
    // during render. Drop malformed entries instead of crashing the app.
    const stored = readJson<Favorite[]>(LS_FAVORITES, []);

    return Array.isArray(stored)
      ? stored.filter(
          (f) =>
            f &&
            typeof f.uuid === "string" &&
            typeof f.url === "string" &&
            typeof f.name === "string"
        )
      : [];
  });
  const [country, setCountryState] = useState(initialPrefs.country);
  const [tag, setTagState] = useState(initialPrefs.tag);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Latest filter values, read inside the (stable) search callback without making
  // it a dependency of the effect that triggers an initial load.
  const filtersRef = useRef({ country, searchTerm, tag });
  filtersRef.current = { country, searchTerm, tag };

  // One in-flight search at a time — abort the previous when a new one starts.
  const searchAbortRef = useRef<AbortController>();

  // overrides let a caller search with a value it just set in the SAME event tick,
  // before React has re-rendered (and thus before filtersRef reflects it). This is
  // the fix for "pick a country → stations aren't from that country": the country
  // <select>'s onChange used to call setCountry(v) then search(), but search() read
  // the STALE country from filtersRef (setState is async), so it queried the old
  // country. Now the new value is passed through explicitly.
  const search = useCallback(
    (overrides?: { country?: string; name?: string; tag?: string }) => {
      const { country: cf, searchTerm: s, tag: tf } = filtersRef.current;
      const name = (overrides?.name ?? s).trim();
      const c = overrides?.country ?? cf;
      const t = overrides?.tag ?? tf;

      searchAbortRef.current?.abort();
      const controller = new AbortController();

      searchAbortRef.current = controller;
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        hidebroken: "true",
        limit: String(SEARCH_LIMIT),
        order: "clickcount",
        reverse: "true",
      });

      if (name) params.set("name", name);
      // EXACT country match by ISO 3166-1 code (c is a 2-letter code, not a name),
      // so picking a country returns stations actually FROM that country.
      if (c) params.set("countrycode", c);
      if (t) params.set("tag", t);

      apiFetch<RawStation[]>(
        `/json/stations/search?${params.toString()}`,
        controller.signal
      )
        .then((raw) => {
          if (controller.signal.aborted) return;
          const normalized = dedupe(
            raw.map(normalize).filter((s): s is Station => !!s)
          );

          setStations(normalized);
          setLoading(false);
        })
        .catch((fetchError: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            fetchError instanceof Error
              ? `Couldn't load stations: ${fetchError.message}`
              : "Couldn't load stations."
          );
          setLoading(false);
        });
    },
    []
  );

  // Load filter lists once + run an initial search using the persisted prefs.
  useEffect(() => {
    const controller = new AbortController();

    apiFetch<RawCountry[]>("/json/countries", controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setCountries(
          list
            // Need a real ISO code to match exactly — drop entries without one.
            .filter(
              (entry) =>
                entry.name && entry.iso_3166_1 && (entry.stationcount ?? 0) > 0
            )
            .map((entry) => ({
              code: (entry.iso_3166_1 as string).toUpperCase(),
              name: entry.name as string,
              stationcount: entry.stationcount ?? 0,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => undefined);

    apiFetch<Tag[]>(
      `/json/tags?order=stationcount&reverse=true&limit=${TAG_LIMIT}`,
      controller.signal
    )
      .then((list) => {
        if (controller.signal.aborted) return;
        setTags(list.filter((entry) => entry.name && entry.stationcount > 0));
      })
      .catch(() => undefined);

    search();

    return () => {
      controller.abort();
      searchAbortRef.current?.abort();
    };
    // search is stable (empty-dep useCallback); run this exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCountry = useCallback((next: string) => {
    // Update the ref synchronously too, so any search() fired right after this in
    // the same handler (before re-render) already sees the new country.
    filtersRef.current = { ...filtersRef.current, country: next };
    setCountryState(next);
    // Persist only the Prefs shape (country + tag) — never the transient searchTerm.
    writeJson(LS_PREFS, { country: next, tag: filtersRef.current.tag });
  }, []);

  const setTag = useCallback((next: string) => {
    filtersRef.current = { ...filtersRef.current, tag: next };
    setTagState(next);
    writeJson(LS_PREFS, { country: filtersRef.current.country, tag: next });
  }, []);

  const isFavorite = useCallback(
    (uuid: string) => favorites.some((fav) => fav.uuid === uuid),
    [favorites]
  );

  const toggleFavorite = useCallback((station: Station | Favorite) => {
    setFavorites((current) => {
      const exists = current.some((fav) => fav.uuid === station.uuid);
      const next = exists
        ? current.filter((fav) => fav.uuid !== station.uuid)
        : [
            ...current,
            {
              bitrate: station.bitrate,
              country: station.country,
              favicon: station.favicon,
              name: station.name,
              url: station.url,
              uuid: station.uuid,
            },
          ];

      writeJson(LS_FAVORITES, next);

      return next;
    });
  }, []);

  return {
    country,
    countries,
    error,
    favorites,
    isFavorite,
    loading,
    search,
    searchTerm,
    setCountry,
    setSearchTerm,
    setTag,
    stations,
    tag,
    tags,
    toggleFavorite,
  };
};

export default useRadio;
