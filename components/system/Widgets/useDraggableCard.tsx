import { clampPosition } from "components/system/Widgets/functions";
import type { WidgetId, WidgetPosition } from "components/system/Widgets/types";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type UseDraggableCard = {
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  ref: React.RefObject<HTMLDivElement>;
  style: React.CSSProperties;
};

/**
 * Pointer-events based dragging for a single widget card. Captures the pointer
 * so a drag keeps tracking even if it leaves the card, ignores drags that start
 * on interactive controls (so inputs/links/buttons still work), and clamps the
 * final position so the card can never be lost off-screen.
 */
const useDraggableCard = (
  id: WidgetId,
  position: WidgetPosition,
  onMove: (id: WidgetId, position: WidgetPosition) => void,
  onFocus: (id: WidgetId) => void
): UseDraggableCard => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Live position used while dragging (avoids a state update per pointermove).
  const [livePosition, setLivePosition] = useState<WidgetPosition>(position);
  const dragState = useRef<{
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);

  // Sync from props when not actively dragging (e.g. external reset/load).
  useEffect(() => {
    if (!dragState.current) setLivePosition(position);
  }, [position]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!dragState.current || event.pointerId !== dragState.current.pointerId) {
      return;
    }

    const { offsetX, offsetY } = dragState.current;

    setLivePosition({
      x: event.clientX - offsetX,
      y: event.clientY - offsetY,
    });
  }, []);

  const endDrag = useCallback(
    (event: PointerEvent) => {
      if (
        !dragState.current ||
        event.pointerId !== dragState.current.pointerId
      ) {
        return;
      }

      const { offsetX, offsetY } = dragState.current;
      const rect = ref.current?.getBoundingClientRect();
      const next = clampPosition(
        event.clientX - offsetX,
        event.clientY - offsetY,
        rect?.width,
        rect?.height
      );

      dragState.current = null;
      setIsDragging(false);
      setLivePosition(next);
      onMove(id, next);

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    },
    [id, onMove, onPointerMove]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Don't start a drag from interactive controls inside the card.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, a, input, select, textarea")
      ) {
        return;
      }

      if (event.button !== 0) return;

      onFocus(id);

      const rect = ref.current?.getBoundingClientRect();

      if (!rect) return;

      dragState.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        pointerId: event.pointerId,
      };
      setIsDragging(true);

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [endDrag, id, onFocus, onPointerMove]
  );

  // Clean up listeners on unmount mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    },
    [endDrag, onPointerMove]
  );

  return {
    isDragging,
    onPointerDown,
    ref,
    style: {
      left: livePosition.x,
      top: livePosition.y,
    },
  };
};

export default useDraggableCard;
