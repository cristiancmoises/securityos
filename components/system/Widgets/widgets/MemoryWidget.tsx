import { MEMORY_TICK_MS } from "components/system/Widgets/constants";
import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";
import { useEffect, useState } from "react";

type PerformanceMemory = {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
};

type MemorySample = {
  limitMb: number;
  percent: number;
  usedMb: number;
};

const toMb = (bytes: number): number => Math.round(bytes / (1024 * 1024));

const readMemory = (): MemorySample | undefined => {
  const memory = (performance as Performance & { memory?: PerformanceMemory })
    .memory;

  if (
    !memory ||
    typeof memory.usedJSHeapSize !== "number" ||
    typeof memory.jsHeapSizeLimit !== "number" ||
    memory.jsHeapSizeLimit <= 0
  ) {
    return undefined;
  }

  return {
    limitMb: toMb(memory.jsHeapSizeLimit),
    percent: Math.min(
      100,
      Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    ),
    usedMb: toMb(memory.usedJSHeapSize),
  };
};

/**
 * Live JS-heap gauge from the non-standard `performance.memory` (Chromium only).
 * `supported` starts undefined so SSR/first paint render nothing; the parent
 * keeps this card visible per the user's toggle and we just show "unavailable".
 */
const MemoryWidget: FC<WidgetProps> = (props) => {
  const [sample, setSample] = useState<MemorySample | undefined>();
  const [supported, setSupported] = useState<boolean | undefined>();

  useEffect(() => {
    const initial = readMemory();

    setSupported(Boolean(initial));

    if (!initial) return undefined;

    setSample(initial);

    const interval = window.setInterval(() => {
      const next = readMemory();

      if (next) setSample(next);
    }, MEMORY_TICK_MS);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <WidgetCard title="Memory" {...props}>
      {supported === false ? (
        <div className="widget-status">
          performance.memory unavailable in this browser.
        </div>
      ) : sample ? (
        <div className="gauge">
          <div className="gauge-value">{sample.percent}%</div>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{ width: `${sample.percent}%` }}
            />
          </div>
          <div className="gauge-detail">
            {sample.usedMb} MB / {sample.limitMb} MB JS heap
          </div>
        </div>
      ) : (
        <div className="widget-status">Reading…</div>
      )}
    </WidgetCard>
  );
};

export default MemoryWidget;
