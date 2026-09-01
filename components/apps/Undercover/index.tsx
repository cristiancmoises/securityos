import StyledUndercover from "components/apps/Undercover/StyledUndercover";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useSession } from "contexts/session";
import { useEffect, useRef } from "react";

// Undercover is a presentation-only workspace profile. Opening the app applies a
// familiar, low-profile desktop treatment; files, applications, session data, and
// network routing are never changed.
const Undercover: FC<ComponentProcessProps> = () => {
  const { disableUndercover, enableUndercover, themeName } = useSession();
  const appliedOnOpen = useRef(false);
  const active = themeName === "undercover";

  // Opening the app is the shortcut: apply the low-profile workspace immediately.
  useEffect(() => {
    if (!appliedOnOpen.current) {
      appliedOnOpen.current = true;
      enableUndercover();
    }
  }, [enableUndercover]);

  return (
    <StyledUndercover>
      <section aria-labelledby="undercover-title" className="profile-panel">
        <header className="profile-header">
          <div className="brand">
            <span aria-hidden="true" className="brand-mark">
              S
            </span>
            <span className="brand-copy">
              <span className="brand-name">SecurityOS</span>
              <span className="brand-caption">Workspace profiles</span>
            </span>
          </div>
          <span
            aria-live="polite"
            className={`status-pill${active ? " active" : ""}`}
            role="status"
          >
            {active ? "Profile active" : "Standard profile"}
          </span>
        </header>

        <div className="profile-body">
          <div className="hero">
            <div>
              <p className="eyebrow">Undercover mode</p>
              <h1 id="undercover-title">
                {active ? "Low-profile workspace" : "SecurityOS workspace"}
              </h1>
              <p className="summary">
                {active
                  ? "A familiar, neutral desktop presentation is running."
                  : "Switch to a quiet, neutral presentation for shared or public spaces."}
              </p>
            </div>

            <div aria-hidden="true" className="workspace-preview">
              <span className="preview-window" />
              <span className="preview-dock">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>

          <div aria-label="Profile impact" className="facts" role="list">
            <div className="fact" role="listitem">
              <span aria-hidden="true" className="fact-icon" />
              <span className="fact-copy">
                <span className="fact-label">Appearance</span>
                <span className="fact-value">
                  {active ? "Low-profile" : "SecurityOS"}
                </span>
              </span>
            </div>
            <div className="fact" role="listitem">
              <span aria-hidden="true" className="fact-icon session" />
              <span className="fact-copy">
                <span className="fact-label">Files &amp; apps</span>
                <span className="fact-value">Unchanged</span>
              </span>
            </div>
            <div className="fact" role="listitem">
              <span aria-hidden="true" className="fact-icon route" />
              <span className="fact-copy">
                <span className="fact-label">Tor routing</span>
                <span className="fact-value">Unchanged</span>
              </span>
            </div>
          </div>

          <footer className="profile-footer">
            <p className="privacy-note" id="undercover-note">
              Visual profile only. Leaving restores your previous theme,
              wallpaper, and fit; privacy controls stay in place.
            </p>
            <button
              aria-describedby="undercover-note"
              aria-pressed={active}
              onClick={active ? disableUndercover : enableUndercover}
              type="button"
            >
              {active ? "Restore previous appearance" : "Use low-profile mode"}
            </button>
          </footer>
        </div>
      </section>
    </StyledUndercover>
  );
};

export default Undercover;
