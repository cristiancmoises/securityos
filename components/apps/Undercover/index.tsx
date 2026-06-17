import StyledUndercover from "components/apps/Undercover/StyledUndercover";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useSession } from "contexts/session";
import { useEffect } from "react";
import {
  DEFAULT_THEME,
  DEFAULT_WALLPAPER,
  DEFAULT_WALLPAPER_FIT,
  UNDERCOVER_WALLPAPER,
} from "utils/constants";

// Kali-style "Undercover" toggle, as an app: clicking it instantly restyles the
// ENTIRE desktop (theme + wallpaper) to look like Windows 11, and back. It only
// changes appearance — files, apps and Tor routing are untouched.
const Undercover: FC<ComponentProcessProps> = () => {
  const { setThemeName, setWallpaper, themeName } = useSession();
  const active = themeName === "undercover";

  const enable = (): void => {
    setThemeName("undercover");
    setWallpaper(UNDERCOVER_WALLPAPER, DEFAULT_WALLPAPER_FIT);
  };
  const disable = (): void => {
    setThemeName(DEFAULT_THEME);
    setWallpaper(DEFAULT_WALLPAPER, DEFAULT_WALLPAPER_FIT);
  };

  // Opening the app IS the action: disguise the desktop as Windows 11 on launch.
  useEffect(() => {
    enable();
    // run once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledUndercover>
      <img
        alt="Undercover"
        className="logo"
        src="/System/Icons/96x96/undercover.webp"
      />
      <h1>Undercover Mode</h1>
      <p className="status">
        {active
          ? "Active — your desktop is disguised as Windows 11."
          : "Inactive — running the SecurityOS (Emacs) look."}
      </p>
      <p className="hint">
        Undercover instantly restyles the whole desktop to look like Windows 11
        — useful in public or over a shoulder. Only the appearance changes: your
        files, apps and Tor routing stay exactly as they are.
      </p>
      <div className="actions">
        {active ? (
          <button className="primary" onClick={disable} type="button">
            Return to SecurityOS
          </button>
        ) : (
          <button className="primary" onClick={enable} type="button">
            Disguise as Windows 11
          </button>
        )}
      </div>
    </StyledUndercover>
  );
};

export default Undercover;
