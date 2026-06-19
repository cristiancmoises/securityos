import { CLOCK_TICK_MS } from "components/system/Widgets/constants";
import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";
import { useEffect, useState } from "react";

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

const dateFormat: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  weekday: "long",
  year: "numeric",
};

const ClockWidget: FC<WidgetProps> = (props) => {
  const [now, setNow] = useState<Date | undefined>();

  useEffect(() => {
    setNow(new Date());

    const interval = window.setInterval(
      () => setNow(new Date()),
      CLOCK_TICK_MS
    );

    return () => window.clearInterval(interval);
  }, []);

  return (
    <WidgetCard title="Clock" {...props}>
      <div className="clock-time">
        {now ? now.toLocaleTimeString(undefined, timeFormat) : "--:--:--"}
      </div>
      <div className="clock-date">
        {now ? now.toLocaleDateString(undefined, dateFormat) : ""}
      </div>
    </WidgetCard>
  );
};

export default ClockWidget;
