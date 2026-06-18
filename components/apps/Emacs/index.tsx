import dynamic from "next/dynamic";
import StyledEmacs from "components/apps/Emacs/StyledEmacs";
import useEmacs from "components/apps/Emacs/useEmacs";
import WhichKey from "components/apps/Emacs/WhichKey";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useFileDrop from "components/system/Files/FileManager/useFileDrop";

// The simulated chat panels are heavy-ish and rarely shown; load them lazily.
const Telega = dynamic(() => import("components/apps/Emacs/panels/Telega"));
const Whatsappel = dynamic(
  () => import("components/apps/Emacs/panels/Whatsappel")
);

const Emacs: FC<ComponentProcessProps> = ({ id }) => {
  const {
    textareaRef,
    value,
    modeLine,
    minibuffer,
    bufferKind,
    whichKey,
    onKeyDown,
    onChange,
    onSelect,
    onMinibufferKeyDown,
    onMinibufferChange,
    minibufferRef,
  } = useEmacs({ id });

  const modeFlags = modeLine.modified ? "**" : "--";
  const minibufferActive = !!minibuffer.prompt;
  const candidates = minibuffer.candidates ?? [];

  return (
    <StyledEmacs {...useFileDrop({ id })}>
      <div className="header-line">
        <div className="tab">
          <span className="dot">{modeLine.modified ? "●" : "○"}</span>
          <span>{modeLine.bufferName}</span>
        </div>
        <div className="spacer" />
        <div className="hint">SPC (blank line) or M-m → leader</div>
      </div>
      <div className="buffer">
        {bufferKind === "telega" ? (
          <Telega />
        ) : bufferKind === "whatsappel" ? (
          <Whatsappel />
        ) : (
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
        )}
      </div>
      {whichKey ? (
        <WhichKey bindings={whichKey.bindings} title={whichKey.title} />
      ) : null}
      <div className="mode-line">
        <span className="seg window">{modeLine.windowNumber}</span>
        <span className="seg state">{modeLine.state}</span>
        <span className="seg buffer">
          <span className="flags">{modeFlags}</span>
          {modeLine.bufferName}
        </span>
        <span className="seg major">{modeLine.majorMode}</span>
        <span className="seg pos">
          L{modeLine.line}:C{modeLine.column} {modeLine.position}
        </span>
        <span className="fill" />
        <span className="seg clock">{modeLine.position}</span>
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
            {candidates.length > 0 ? (
              <span className="candidates">
                {candidates.map((c, i) => (
                  <span key={c} className={`cand${i === 0 ? " first" : ""}`}>
                    {c}
                  </span>
                ))}
              </span>
            ) : null}
          </>
        ) : (
          <span className="message">{minibuffer.message}</span>
        )}
      </div>
    </StyledEmacs>
  );
};

export default Emacs;
