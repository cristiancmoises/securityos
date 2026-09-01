import {
  FORECAST_API,
  WEATHER_REFRESH_MS,
} from "components/system/Widgets/constants";
import {
  formatLocation,
  shortDay,
  weatherCodeToInfo,
} from "components/system/Widgets/functions";
import WidgetCard from "components/system/Widgets/WidgetCard";
import type {
  WeatherLocation,
  WidgetProps,
} from "components/system/Widgets/types";
import { useEffect, useState } from "react";

type WeatherWidgetProps = WidgetProps & {
  location: WeatherLocation;
};

type Forecast = {
  current: {
    temperature: number;
    weatherCode: number;
    windSpeed: number;
  };
  daily: {
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
  }[];
  unit: string;
};

type OpenMeteoForecast = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  current_units?: { temperature_2m?: string };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    time?: string[];
    weather_code?: number[];
  };
};

const FORECAST_DAYS = 4;

const parseForecast = (data: OpenMeteoForecast): Forecast => {
  const days: Forecast["daily"] = [];
  const time = data.daily?.time ?? [];

  for (let i = 0; i < Math.min(time.length, FORECAST_DAYS); i += 1) {
    days.push({
      date: time[i],
      tempMax: Math.round(data.daily?.temperature_2m_max?.[i] ?? 0),
      tempMin: Math.round(data.daily?.temperature_2m_min?.[i] ?? 0),
      weatherCode: data.daily?.weather_code?.[i] ?? 0,
    });
  }

  return {
    current: {
      temperature: Math.round(data.current?.temperature_2m ?? 0),
      weatherCode: data.current?.weather_code ?? 0,
      windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
    },
    daily: days,
    unit: data.current_units?.temperature_2m ?? "°C",
  };
};

const WeatherWidget: FC<WeatherWidgetProps> = ({ location, ...props }) => {
  const [forecast, setForecast] = useState<Forecast>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let interval = 0;

    const fetchForecast = async (): Promise<void> => {
      try {
        const params = new URLSearchParams({
          current: "temperature_2m,weather_code,wind_speed_10m",
          daily: "temperature_2m_max,temperature_2m_min,weather_code",
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          timezone: "auto",
        });
        const response = await fetch(`${FORECAST_API}?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        setForecast(
          parseForecast((await response.json()) as OpenMeteoForecast)
        );
        setError("");
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError("Couldn't load weather");
        if (caught instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("Weather widget:", caught.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    setLoading(true);
    fetchForecast();
    interval = window.setInterval(fetchForecast, WEATHER_REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [location.latitude, location.longitude]);

  const info = forecast && weatherCodeToInfo(forecast.current.weatherCode);

  return (
    <WidgetCard title="Weather" {...props}>
      <div className="weather-location">{formatLocation(location)}</div>
      {loading && !forecast ? (
        <div className="widget-status">Loading…</div>
      ) : error && !forecast ? (
        <div className="widget-status widget-error">{error}</div>
      ) : forecast && info ? (
        <>
          <div className="weather-now">
            <span className="weather-emoji">{info.icon}</span>
            <div>
              <div className="weather-temp">
                {forecast.current.temperature}
                {forecast.unit}
              </div>
              <div className="weather-text">{info.text}</div>
            </div>
          </div>
          <div className="weather-meta">
            Wind {forecast.current.windSpeed} km/h
          </div>
          {forecast.daily.length > 0 && (
            <div className="weather-forecast">
              {forecast.daily.map((day) => {
                const dayInfo = weatherCodeToInfo(day.weatherCode);

                return (
                  <div key={day.date} className="day">
                    <span>{shortDay(day.date)}</span>
                    <span className="day-icon" title={dayInfo.text}>
                      {dayInfo.icon}
                    </span>
                    <span className="day-temps">
                      {day.tempMax}° <span className="lo">{day.tempMin}°</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </WidgetCard>
  );
};

export default WeatherWidget;
