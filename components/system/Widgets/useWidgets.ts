import { WIDGET_ORDER } from "components/system/Widgets/constants";
import {
  loadWidgetsState,
  saveWidgetsState,
} from "components/system/Widgets/functions";
import type {
  WeatherLocation,
  WidgetId,
  WidgetPosition,
  WidgetsState,
} from "components/system/Widgets/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseWidgets = {
  bringToFront: (id: WidgetId) => void;
  isLoaded: boolean;
  setNewsFeedUrl: (url: string) => void;
  setPosition: (id: WidgetId, position: WidgetPosition) => void;
  setWeatherLocation: (location: WeatherLocation) => void;
  state: WidgetsState;
  toggleWidget: (id: WidgetId, visible?: boolean) => void;
  zIndexFor: (id: WidgetId) => number;
};

const BASE_Z = 10;

const useWidgets = (): UseWidgets => {
  // Start from defaults on the server / first paint; hydrate from storage in an
  // effect so SSR markup and the client agree (no hydration mismatch).
  const [state, setState] = useState<WidgetsState>(() => loadWidgetsState());
  const [isLoaded, setIsLoaded] = useState(false);
  // Stacking order, most-recently-focused last. Not persisted.
  const [order, setOrder] = useState<WidgetId[]>(() => [...WIDGET_ORDER]);

  // Avoid persisting the very first (default) state before hydration.
  const hydratedRef = useRef(false);

  useEffect(() => {
    setState(loadWidgetsState());
    setIsLoaded(true);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (hydratedRef.current) saveWidgetsState(state);
  }, [state]);

  const toggleWidget = useCallback((id: WidgetId, visible?: boolean) => {
    setState((prev) => ({
      ...prev,
      visible: {
        ...prev.visible,
        [id]: visible ?? !prev.visible[id],
      },
    }));
  }, []);

  const setPosition = useCallback((id: WidgetId, position: WidgetPosition) => {
    setState((prev) => ({
      ...prev,
      positions: { ...prev.positions, [id]: position },
    }));
  }, []);

  const setWeatherLocation = useCallback((location: WeatherLocation) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, weatherLocation: location },
    }));
  }, []);

  const setNewsFeedUrl = useCallback((url: string) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, newsFeedUrl: url },
    }));
  }, []);

  const bringToFront = useCallback((id: WidgetId) => {
    setOrder((prev) => {
      if (prev[prev.length - 1] === id) return prev;

      return [...prev.filter((widgetId) => widgetId !== id), id];
    });
  }, []);

  const zIndexFor = useCallback(
    (id: WidgetId) => BASE_Z + Math.max(0, order.indexOf(id)),
    [order]
  );

  return useMemo(
    () => ({
      bringToFront,
      isLoaded,
      setNewsFeedUrl,
      setPosition,
      setWeatherLocation,
      state,
      toggleWidget,
      zIndexFor,
    }),
    [
      bringToFront,
      isLoaded,
      setNewsFeedUrl,
      setPosition,
      setWeatherLocation,
      state,
      toggleWidget,
      zIndexFor,
    ]
  );
};

export default useWidgets;
