import {
  GEOCODING_API,
  WIDGET_LABELS,
  WIDGET_ORDER,
} from "components/system/Widgets/constants";
import { formatLocation } from "components/system/Widgets/functions";
import {
  StyledGearButton,
  StyledGearPanel,
} from "components/system/Widgets/StyledWidgets";
import type { UseWidgets } from "components/system/Widgets/useWidgets";
import type { WeatherLocation } from "components/system/Widgets/types";
import { useCallback, useEffect, useRef, useState } from "react";

type OpenMeteoGeoResult = {
  admin1?: string;
  country?: string;
  id: number;
  latitude: number;
  longitude: number;
  name: string;
};

type WidgetsSettingsProps = Pick<
  UseWidgets,
  "setNewsFeedUrl" | "setWeatherLocation" | "state" | "toggleWidget"
>;

const WidgetsSettings: FC<WidgetsSettingsProps> = ({
  setNewsFeedUrl,
  setWeatherLocation,
  state,
  toggleWidget,
}) => {
  const [open, setOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [results, setResults] = useState<OpenMeteoGeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [feedDraft, setFeedDraft] = useState(state.settings.newsFeedUrl);

  // Keep the feed draft in sync if state changes from elsewhere.
  useEffect(() => {
    setFeedDraft(state.settings.newsFeedUrl);
  }, [state.settings.newsFeedUrl]);

  // Debounced city geocoding lookup.
  useEffect(() => {
    const query = cityQuery.trim();

    if (query.length < 2) {
      setResults([]);
      setSearchError("");

      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);

        const params = new URLSearchParams({
          count: "5",
          language: "en",
          name: query,
        });
        const response = await fetch(`${GEOCODING_API}?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as {
          results?: OpenMeteoGeoResult[];
        };

        setResults(data.results ?? []);
        setSearchError(data.results?.length ? "" : "No matches");
      } catch (caught) {
        if (controller.signal.aborted) return;

        setSearchError("Search failed");
        if (caught instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Weather geocoding:", caught.message);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [cityQuery]);

  const pickCity = useCallback(
    (result: OpenMeteoGeoResult) => {
      const location: WeatherLocation = {
        admin1: result.admin1,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
      };

      setWeatherLocation(location);
      setCityQuery("");
      setResults([]);
    },
    [setWeatherLocation]
  );

  const commitFeed = useCallback(() => {
    const url = feedDraft.trim();

    if (url) setNewsFeedUrl(url);
  }, [feedDraft, setNewsFeedUrl]);

  return (
    <>
      <StyledGearButton
        aria-expanded={open}
        aria-label="Desktop widgets settings"
        title="Desktop widgets"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        ⚙
      </StyledGearButton>
      {open && (
        <StyledGearPanel role="dialog">
          <h2>Widgets</h2>
          {WIDGET_ORDER.map((id) => (
            <label key={id} className="toggle" htmlFor={`widget-toggle-${id}`}>
              <input
                checked={state.visible[id]}
                id={`widget-toggle-${id}`}
                type="checkbox"
                onChange={(event) => toggleWidget(id, event.target.checked)}
              />
              {WIDGET_LABELS[id]}
            </label>
          ))}

          <hr />

          <h2>Weather location</h2>
          <div className="hint">
            Current: {formatLocation(state.settings.weatherLocation)}
          </div>
          <label className="field" htmlFor="widget-city">
            <span>Search city</span>
            <input
              autoComplete="off"
              id="widget-city"
              placeholder="e.g. Berlin"
              type="text"
              value={cityQuery}
              onChange={(event) => setCityQuery(event.target.value)}
            />
          </label>
          {searching && <div className="hint">Searching…</div>}
          {searchError && <div className="hint">{searchError}</div>}
          {results.length > 0 && (
            <ul className="results">
              {results.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => pickCity(result)}>
                    {[result.name, result.admin1, result.country]
                      .filter(Boolean)
                      .join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <hr />

          <h2>News feed</h2>
          <label className="field" htmlFor="widget-feed">
            <span>RSS / Atom URL</span>
            <input
              id="widget-feed"
              placeholder="https://example.com/feed.xml"
              type="text"
              value={feedDraft}
              onBlur={commitFeed}
              onChange={(event) => setFeedDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitFeed();
              }}
            />
          </label>
          <div className="hint">
            Fetched over Tor via the same-origin proxy.
          </div>
        </StyledGearPanel>
      )}
    </>
  );
};

export default WidgetsSettings;
