import StyledEmacs from "components/apps/Emacs/StyledEmacs";
import useEmacs from "components/apps/Emacs/useEmacs";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useFileDrop from "components/system/Files/FileManager/useFileDrop";

const Emacs: FC<ComponentProcessProps> = ({ id }) => {
  const {
    textareaRef,
    value,
    modeLine,
    minibuffer,
    onKeyDown,
    onChange,
    onSelect,
    onMinibufferKeyDown,
    onMinibufferChange,
    minibufferRef,
  } = useEmacs({ id });

  const modeFlags = modeLine.modified ? "**" : "--";
  const minibufferActive = !!minibuffer.prompt;

  return (
    <StyledEmacs {...useFileDrop({ id })}>
      <div className="buffer">
        <textarea
          ref={textareaRef}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="surface"
          onChange={onChange}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          spellCheck={false}
          value={value}
          wrap="off"
        />
      </div>
      <div className="mode-line">
        <span className="flags">-UUU:{modeFlags}F1</span>
        <span className="name">{modeLine.bufferName}</span>
        <span className="major">({modeLine.majorMode})</span>
        <span className="pos">
          L{modeLine.line} C{modeLine.column}
        </span>
        <span className="where">{modeLine.position}</span>
      </div>
      <div className="minibuffer">
        {minibufferActive ? (
          <>
            <span className="prompt">{minibuffer.prompt?.label}</span>
            <input
              ref={minibufferRef}
              autoComplete="off"
              className="mini-input"
              onChange={onMinibufferChange}
              onKeyDown={onMinibufferKeyDown}
              spellCheck={false}
              type="text"
              value={minibuffer.input}
            />
          </>
        ) : (
          <span className="message">{minibuffer.message}</span>
        )}
      </div>
    </StyledEmacs>
  );
};

export default Emacs;
