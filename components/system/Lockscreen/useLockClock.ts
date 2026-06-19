import { useEffect, useState } from "react";
import { DEFAULT_LOCALE } from "utils/constants";

/**
 * Large lock-screen clock. Independent of the taskbar Clock (which runs in a Web
 * Worker / NTP); here a plain 1s interval is plenty and avoids extra wiring.
 */

const timeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  hour: "numeric",
  hour12: true,
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: "numeric",
  month: "long",
  weekday: "long",
});

export type LockClock = {
  date: string;
  time: string;
};

const format = (now: Date): LockClock => ({
  date: dateFormatter.format(now),
  time: timeFormatter.format(now).replace(/\s?[AP]M$/i, ""),
});

const useLockClock = (active: boolean): LockClock => {
  const [clock, setClock] = useState<LockClock>(() => format(new Date()));

  useEffect(() => {
    if (!active) return undefined;

    setClock(format(new Date()));

    const interval = window.setInterval(
      () => setClock(format(new Date())),
      1000
    );

    return () => window.clearInterval(interval);
  }, [active]);

  return clock;
};

export default useLockClock;
