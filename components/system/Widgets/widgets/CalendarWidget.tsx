import { CALENDAR_WEEKDAYS } from "components/system/Widgets/constants";
import {
  buildCalendarGrid,
  monthLabel,
} from "components/system/Widgets/functions";
import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";
import { useEffect, useMemo, useState } from "react";

/**
 * Month-view calendar: weekday headers, the current month's grid with today
 * highlighted, and prev/next month navigation. Pure date logic (no deps); the
 * displayed month is local state so navigating away never mutates persistence.
 */
const CalendarWidget: FC<WidgetProps> = (props) => {
  // `today` resolves on the client so SSR/first paint stay deterministic.
  const [today, setToday] = useState<Date | undefined>();
  const [view, setView] = useState<{ month: number; year: number }>();

  useEffect(() => {
    const now = new Date();

    setToday(now);
    setView({ month: now.getMonth(), year: now.getFullYear() });
  }, []);

  const cells = useMemo(
    () =>
      today && view
        ? buildCalendarGrid(view.year, view.month, today)
        : [],
    [today, view]
  );

  const goToMonth = (delta: number): void => {
    setView((prev) => {
      if (!prev) return prev;

      const next = new Date(prev.year, prev.month + delta, 1);

      return { month: next.getMonth(), year: next.getFullYear() };
    });
  };

  return (
    <WidgetCard title="Calendar" {...props}>
      <div className="calendar">
        {view ? (
          <>
            <div className="calendar-header">
              <button
                aria-label="Previous month"
                className="calendar-nav"
                type="button"
                onClick={() => goToMonth(-1)}
              >
                ‹
              </button>
              <span className="calendar-month">
                {monthLabel(view.year, view.month)}
              </span>
              <button
                aria-label="Next month"
                className="calendar-nav"
                type="button"
                onClick={() => goToMonth(1)}
              >
                ›
              </button>
            </div>
            <div className="calendar-grid">
              {CALENDAR_WEEKDAYS.map((weekday) => (
                <span key={weekday} className="calendar-weekday">
                  {weekday}
                </span>
              ))}
              {cells.map((cell, index) => {
                const classNames = ["calendar-day"];

                if (!cell.inMonth) classNames.push("muted");
                if (cell.isToday) classNames.push("today");

                return (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${cell.day}-${index}`}
                    className={classNames.join(" ")}
                  >
                    {cell.day}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="widget-status">Loading…</div>
        )}
      </div>
    </WidgetCard>
  );
};

export default CalendarWidget;
