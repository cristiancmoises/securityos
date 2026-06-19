import { DEFAULT_WIDGETS_STATE } from "components/system/Widgets/constants";
import { StyledWidgetsLayer } from "components/system/Widgets/StyledWidgets";
import useWidgets from "components/system/Widgets/useWidgets";
import ClockWidget from "components/system/Widgets/widgets/ClockWidget";
import CpuWidget from "components/system/Widgets/widgets/CpuWidget";
import MemoryWidget from "components/system/Widgets/widgets/MemoryWidget";
import NewsWidget from "components/system/Widgets/widgets/NewsWidget";
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
    setNewsFeedUrl,
    setPosition,
    setWeatherLocation,
    state,
    toggleWidget,
    zIndexFor,
  } = useWidgets();

  const cardProps = (id: WidgetId) => ({
    id,
    onFocus: bringToFront,
    onMove: setPosition,
    position: state.positions[id] ?? DEFAULT_WIDGETS_STATE.positions[id] ?? {
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
      {state.visible.cpu && <CpuWidget {...cardProps("cpu")} />}
      {state.visible.news && (
        <NewsWidget
          {...cardProps("news")}
          feedUrl={state.settings.newsFeedUrl}
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
