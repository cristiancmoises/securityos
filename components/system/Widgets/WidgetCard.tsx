import { StyledWidgetCard } from "components/system/Widgets/StyledWidgets";
import useDraggableCard from "components/system/Widgets/useDraggableCard";
import type { WidgetProps } from "components/system/Widgets/types";

type WidgetCardProps = WidgetProps & {
  title: string;
};

/** Shared draggable shell for every widget (title + drag handle). */
const WidgetCard: FC<WidgetCardProps> = ({
  children,
  id,
  onFocus,
  onMove,
  position,
  title,
  zIndex,
}) => {
  const { isDragging, onPointerDown, ref, style } = useDraggableCard(
    id,
    position,
    onMove,
    onFocus
  );

  return (
    <StyledWidgetCard
      ref={ref}
      className={isDragging ? "dragging" : undefined}
      style={{ ...style, zIndex }}
      onPointerDown={onPointerDown}
    >
      <div className="widget-title">{title}</div>
      {children}
    </StyledWidgetCard>
  );
};

export default WidgetCard;
