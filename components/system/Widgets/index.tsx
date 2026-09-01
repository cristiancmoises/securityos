import { DEFAULT_WIDGETS_STATE } from "components/system/Widgets/constants";
import { StyledWidgetsLayer } from "components/system/Widgets/StyledWidgets";
import useWidgets from "components/system/Widgets/useWidgets";
import CalendarWidget from "components/system/Widgets/widgets/CalendarWidget";
import ClockWidget from "components/system/Widgets/widgets/ClockWidget";
import MemoryWidget from "components/system/Widgets/widgets/MemoryWidget";
import NewsWidget from "components/system/Widgets/widgets/NewsWidget";
import PostItWidget from "components/system/Widgets/widgets/PostItWidget";
import WeatherWidget from "components/system/Widgets/widgets/WeatherWidget";
import WidgetsSettings from "components/system/Widgets/WidgetsSettings";
import type { WidgetId } from "components/system/Widgets/types";

/**
 * Rainmeter-like desktop widgets overlay.
 *
 * Renders a full-desktop layer with `pointer-events: none` so the desktop icons
 * and right-click menu keep working in the gaps; only the cards/gear (which set
 * `pointer-events: auto`) are interactive. Each card is draggable and the layout
 * + visibility + settings persist to localStorage via {@link useWidgets}.
 */
const Widgets: FC = () => {
  const {
    bringToFront,
    isLoaded,
    setNewsFeedUrl,
    setPosition,
    setPostItText,
    setWeatherLocation,
    state,
    toggleWidget,
    zIndexFor,
  } = useWidgets();

  // Render NOTHING until the client has mounted + hydrated state from storage.
  // The page is server-rendered, and React 18 does not patch inline-style
  // mismatches during hydration — so if the cards were SSR'd at their static
  // fallback positions, they'd stay stuck there even after state loaded the
  // responsive first-run layout. Rendering client-only avoids that entirely.
  if (!isLoaded) return null;

  const cardProps = (id: WidgetId) => ({
    id,
    onFocus: bringToFront,
    onMove: setPosition,
    position: state.positions[id] ??
      DEFAULT_WIDGETS_STATE.positions[id] ?? {
        x: 24,
        y: 24,
      },
    zIndex: zIndexFor(id),
  });

  return (
    <StyledWidgetsLayer>
      {state.visible.clock && <ClockWidget {...cardProps("clock")} />}
      {state.visible.weather && (
        <WeatherWidget
          {...cardProps("weather")}
          location={state.settings.weatherLocation}
        />
      )}
      {state.visible.memory && <MemoryWidget {...cardProps("memory")} />}
      {state.visible.news && (
        <NewsWidget
          {...cardProps("news")}
          feedUrl={state.settings.newsFeedUrl}
        />
      )}
      {state.visible.calendar && <CalendarWidget {...cardProps("calendar")} />}
      {state.visible.postit && (
        <PostItWidget
          {...cardProps("postit")}
          text={state.settings.postItText}
          onChange={setPostItText}
        />
      )}
      <WidgetsSettings
        setNewsFeedUrl={setNewsFeedUrl}
        setWeatherLocation={setWeatherLocation}
        state={state}
        toggleWidget={toggleWidget}
      />
    </StyledWidgetsLayer>
  );
};

export default Widgets;
