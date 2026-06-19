import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";
import { useEffect, useRef, useState } from "react";

// Assume a 60fps target. We can't know the real refresh rate cheaply, so we
// clamp the expected interval; on a 120Hz display this just reads as low load.
const EXPECTED_FRAME_MS = 1000 / 60;
// Only update the displayed value this often (keeps re-renders cheap).
const UPDATE_INTERVAL_MS = 1000;
// Smoothing factor for the exponential moving average of the jank ratio.
const SMOOTHING = 0.2;

/**
 * Estimated CPU/render load via a requestAnimationFrame jank monitor.
 *
 * A browser cannot read real CPU usage. Instead we measure how late each frame
 * arrives vs. the ideal ~16.7ms interval: under load the main thread is busy and
 * frames slip, so (actualGap - expectedGap) / expectedGap approximates pressure.
 * It is an ESTIMATE (clearly labeled) and stays cheap — one rAF callback that
 * does a couple of subtractions and only re-renders once per second.
 */
const CpuWidget: FC<WidgetProps> = (props) => {
  const [load, setLoad] = useState(0);
  const loadRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let rafId = 0;

    const tick = (timestamp: number): void => {
      if (lastFrameRef.current !== 0) {
        const delta = timestamp - lastFrameRef.current;
        // How much later than ideal did this frame land? 0 = perfect.
        const jankRatio = Math.max(
          0,
          (delta - EXPECTED_FRAME_MS) / EXPECTED_FRAME_MS
        );
        const instant = Math.min(100, jankRatio * 100);

        loadRef.current =
          loadRef.current + SMOOTHING * (instant - loadRef.current);
      }

      lastFrameRef.current = timestamp;

      if (timestamp - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = timestamp;
        setLoad(Math.round(loadRef.current));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <WidgetCard title="CPU (estimated)" {...props}>
      <div className="gauge">
        <div className="gauge-value">{load}%</div>
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: `${load}%` }} />
        </div>
        <div className="gauge-detail">
          Estimated render load (frame-jank monitor)
        </div>
      </div>
    </WidgetCard>
  );
};

export default CpuWidget;
