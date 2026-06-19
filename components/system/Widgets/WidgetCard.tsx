import { StyledWidgetCard } from "components/system/Widgets/StyledWidgets";
import useDraggableCard from "components/system/Widgets/useDraggableCard";
import type { WidgetProps } from "components/system/Widgets/types";

type WidgetCardProps = WidgetProps & {
  /** Optional extra class on the card shell (e.g. "postit" for theming). */
  className?: string;
  title: string;
};

/** Shared draggable shell for every widget (title + drag handle). */
const WidgetCard: FC<WidgetCardProps> = ({
  children,
  className,
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
      className={[className, isDragging ? "dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ ...style, zIndex }}
      onPointerDown={onPointerDown}
    >
      <div className="widget-title">{title}</div>
      {children}
    </StyledWidgetCard>
  );
};

export default WidgetCard;
