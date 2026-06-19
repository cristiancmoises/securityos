import type {
  Country,
  Favorite,
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

// radio-browser publishes several round-robin server hosts; pick one. (Their
// recommended flow is to resolve a host from all.api.radio-browser.info, but that
// itself needs a request — a fixed mirror is simpler and CSP-clean under https:.)
const API_HOST = "https://de1.api.radio-browser.info";
const FALLBACK_HOST = "https://nl1.api.radio-browser.info";

// radio-browser asks clients to send an identifying User-Agent; browsers forbid
// setting it from fetch, so we pass it as a query hint where the API accepts it.
const SEARCH_LIMIT = 100;
const COUNTRY_LIMIT = 300;
const TAG_LIMIT = 120;

const LS_PREFS = "securityos:radio:prefs";
const LS_FAVORITES = "securityos:radio:favorites";

type Prefs = { country: string; tag: string };

const readJson = <T,>(key: string, fallback: T): T => {
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

// Normalize a raw API station into our Station shape, flagging http-only streams
// and dropping non-https favicons (which the CSP img-src would also allow, but we
// keep it strict to avoid mixed-content warnings).
const normalize = (raw: RawStation): Station | undefined => {
  const url = raw.url_resolved?.trim() ?? "";
  const uuid = raw.stationuuid?.trim() ?? "";
  const name = raw.name?.trim() ?? "";

  if (!uuid || !name || !url) return undefined;

  return {
    bitrate: typeof raw.bitrate === "number" ? raw.bitrate : 0,
    codec: raw.codec?.trim() ?? "",
    country: raw.country?.trim() || raw.countrycode?.trim() || "",
    favicon: isHttps(raw.favicon) ? raw.favicon.trim() : "",
    hasHttps: isHttps(url),
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

// Fetch JSON from the primary radio-browser host, falling back to a second mirror
// if the first fails (DNS/network/5xx). Both are https, so the OS CSP allows them.
const apiFetch = async <T,>(path: string, signal: AbortSignal): Promise<T> => {
  let lastError: unknown;

  for (const host of [API_HOST, FALLBACK_HOST]) {
    try {
      const response = await fetch(`${host}${path}`, {
        headers: { Accept: "application/json" },
        signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      return (await response.json()) as T;
    } catch (error) {
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
  search: (term?: string) => void;
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
  const initialPrefs = useMemo(
    () => readJson<Prefs>(LS_PREFS, { country: "", tag: "" }),
    []
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>(() =>
    readJson<Favorite[]>(LS_FAVORITES, [])
  );
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

  const search = useCallback((term?: string) => {
    const { country: c, searchTerm: s, tag: t } = filtersRef.current;
    const name = (term ?? s).trim();

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
    if (c) params.set("country", c);
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
  }, []);

  // Load filter lists once + run an initial search using the persisted prefs.
  useEffect(() => {
    const controller = new AbortController();

    apiFetch<Country[]>("/json/countries", controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setCountries(
          list
            .filter((entry) => entry.name && entry.stationcount > 0)
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
    setCountryState(next);
    writeJson(LS_PREFS, { ...filtersRef.current, country: next });
  }, []);

  const setTag = useCallback((next: string) => {
    setTagState(next);
    writeJson(LS_PREFS, { ...filtersRef.current, tag: next });
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
