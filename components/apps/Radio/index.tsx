import StyledRadio from "components/apps/Radio/StyledRadio";
import type { Favorite, Station } from "components/apps/Radio/types";
import useRadio from "components/apps/Radio/useRadio";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Radio — listen to internet radio worldwide, searchable by name/country/genre.
// Stations + filters come from the free, no-key radio-browser https API; playback
// is a plain <audio> element fed the station's resolved HTTPS stream URL (http://
// streams are skipped — the OS CSP blocks mixed content).
//
// PRIVACY NOTE: radio streams play over the browser's DIRECT connection, NOT over
// Tor (an <audio> element streams straight from the station CDN). Listening is
// therefore non-anonymous; the rest of SecurityOS routes traffic over Tor.

type Tab = "stations" | "favorites";

// A station can be played from the search list (full Station) or the favorites
// list (slimmer Favorite). Both carry what the player needs.
type Playable = Pick<
  Station,
  "bitrate" | "country" | "favicon" | "name" | "url" | "uuid"
>;

const FALLBACK_VOLUME = 0.8;

const Radio: FC<ComponentProcessProps> = ({ id }) => {
  const {
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
  } = useRadio();
  const [tab, setTab] = useState<Tab>("stations");
  const [current, setCurrent] = useState<Playable>();
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(FALLBACK_VOLUME);
  const [streamError, setStreamError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop + tear down the <audio> element on unmount (clean process exit).
  useEffect(
    () => () => {
      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    },
    []
  );

  // Keep the element's volume in sync with the slider.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const play = useCallback((station: Playable) => {
    const audio = audioRef.current;

    if (!audio) return;
    setCurrent(station);
    setStreamError("");
    audio.src = station.url;
    audio.load();
    void audio.play().catch(() => {
      setStreamError("This stream couldn't be played.");
      setPlaying(false);
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || !current) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        setStreamError("This stream couldn't be played.");
        setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [current]);

  const onStationClick = useCallback(
    (station: Station) => {
      if (!station.hasHttps) return;
      play(station);
    },
    [play]
  );

  const onFavoriteClick = useCallback(
    (favorite: Favorite) => play(favorite),
    [play]
  );

  const volumeIcon = volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";

  // Whether the current track came from search or favorites, the play button is
  // only enabled once something is loaded.
  const canPlay = !!current;

  const stationCount = useMemo(() => stations.length, [stations]);

  return (
    <StyledRadio>
      <div className="filters">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTab("stations");
            search();
          }}
        >
          <input
            aria-label="Search stations"
            className="search"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search stations by name…"
            value={searchTerm}
          />
          <select
            aria-label="Filter by country"
            onChange={(event) => {
              setCountry(event.target.value);
              setTab("stations");
              search();
            }}
            value={country}
          >
            <option value="">All countries</option>
            {countries.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name} ({entry.stationcount})
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by genre"
            onChange={(event) => {
              setTag(event.target.value);
              setTab("stations");
              search();
            }}
            value={tag}
          >
            <option value="">All genres</option>
            {tags.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name} ({entry.stationcount})
              </option>
            ))}
          </select>
          <button className="search-btn" disabled={loading} type="submit">
            {loading ? "…" : "Search"}
          </button>
        </form>
      </div>

      <div className="tabs">
        <button
          className={tab === "stations" ? "tab active" : "tab"}
          onClick={() => setTab("stations")}
          type="button"
        >
          Stations{stationCount > 0 ? ` (${stationCount})` : ""}
        </button>
        <button
          className={tab === "favorites" ? "tab active" : "tab"}
          onClick={() => setTab("favorites")}
          type="button"
        >
          Favorites{favorites.length > 0 ? ` (${favorites.length})` : ""}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === "stations" ? (
        <div className="list">
          {loading ? (
            <div className="status busy">Loading stations…</div>
          ) : stations.length === 0 ? (
            <div className="empty">
              {error ? "Try again." : "No stations found. Try another search."}
            </div>
          ) : (
            stations.map((station) => (
              <button
                key={station.uuid}
                className={`station${
                  current?.uuid === station.uuid ? " active" : ""
                }${station.hasHttps ? "" : " muted"}`}
                onClick={() => onStationClick(station)}
                title={
                  station.hasHttps
                    ? station.name
                    : `${station.name} — no HTTPS stream (can't play)`
                }
                type="button"
              >
                {station.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="favicon"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                    src={station.favicon}
                  />
                ) : (
                  <span className="favicon placeholder">📻</span>
                )}
                <span className="meta">
                  <span className="name">{station.name}</span>
                  <span className="sub">
                    {[
                      station.country,
                      station.bitrate ? `${station.bitrate} kbps` : "",
                      station.codec,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {!station.hasHttps && (
                      <span className="nohttps"> · no HTTPS stream</span>
                    )}
                  </span>
                </span>
                <span
                  aria-label={
                    isFavorite(station.uuid)
                      ? "Remove favorite"
                      : "Add favorite"
                  }
                  className={`fav-btn${isFavorite(station.uuid) ? " on" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(station);
                  }}
                  role="button"
                  tabIndex={-1}
                >
                  {isFavorite(station.uuid) ? "★" : "☆"}
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="list">
          {favorites.length === 0 ? (
            <div className="empty">
              No favorites yet. Tap ☆ on a station to save it.
            </div>
          ) : (
            favorites.map((favorite) => (
              <button
                key={favorite.uuid}
                className={`station${
                  current?.uuid === favorite.uuid ? " active" : ""
                }`}
                onClick={() => onFavoriteClick(favorite)}
                title={favorite.name}
                type="button"
              >
                {favorite.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="favicon"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                    src={favorite.favicon}
                  />
                ) : (
                  <span className="favicon placeholder">📻</span>
                )}
                <span className="meta">
                  <span className="name">{favorite.name}</span>
                  <span className="sub">
                    {[
                      favorite.country,
                      favorite.bitrate ? `${favorite.bitrate} kbps` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span
                  aria-label="Remove favorite"
                  className="fav-btn on"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(favorite);
                  }}
                  role="button"
                  tabIndex={-1}
                >
                  ★
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="nowplaying">
        <button
          className="play-btn"
          disabled={!canPlay}
          onClick={togglePlay}
          title={playing ? "Pause" : "Play"}
          type="button"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="np-meta">
          <div className="np-name">{current?.name || "Nothing playing"}</div>
          <div className={`np-sub${playing ? " live" : ""}`}>
            {streamError
              ? streamError
              : current
                ? playing
                  ? `● Live${current.country ? ` · ${current.country}` : ""}`
                  : "Paused"
                : "Pick a station to start listening"}
          </div>
        </div>
        <div className="volume">
          <span className="vol-icon">{volumeIcon}</span>
          <input
            aria-label="Volume"
            max={1}
            min={0}
            onChange={(event) => setVolume(Number(event.target.value))}
            step={0.01}
            type="range"
            value={volume}
          />
        </div>
      </div>

      {/* Direct (non-Tor) stream playback. preload=none so nothing fetches until
          a station is chosen; src is always an https URL (http streams filtered). */}
      <audio
        ref={audioRef}
        onPause={() => setPlaying(false)}
        onPlaying={() => {
          setPlaying(true);
          setStreamError("");
        }}
        onStalled={() => setStreamError("Stream stalled — trying to recover…")}
        preload="none"
        title={id}
      />
    </StyledRadio>
  );
};

export default Radio;
