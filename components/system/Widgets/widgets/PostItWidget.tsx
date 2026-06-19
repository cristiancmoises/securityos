import WidgetCard from "components/system/Widgets/WidgetCard";
import type { WidgetProps } from "components/system/Widgets/types";

type PostItWidgetProps = WidgetProps & {
  /** Persisted note text (lives in the widgets settings state). */
  text: string;
  /** Persist edited note text. */
  onChange: (text: string) => void;
};

/**
 * Editable yellow sticky note. The text lives in the persisted widgets settings
 * (via `onChange`) so it survives reloads. The drag handler ignores pointer-down
 * on the textarea, so dragging the card and typing in it don't conflict.
 */
const PostItWidget: FC<PostItWidgetProps> = ({ onChange, text, ...props }) => (
  <WidgetCard className="postit" title="Post-it" {...props}>
    <textarea
      aria-label="Sticky note"
      className="postit-text"
      placeholder="Write a note…"
      spellCheck={false}
      value={text}
      onChange={(event) => onChange(event.target.value)}
    />
  </WidgetCard>
);

export default PostItWidget;
