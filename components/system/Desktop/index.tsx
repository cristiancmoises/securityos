import StyledDesktop from "components/system/Desktop/StyledDesktop";
import useFilePaste from "components/system/Desktop/useFilePaste";
import useWallpaper from "components/system/Desktop/Wallpapers/useWallpaper";
import Widgets from "components/system/Widgets";
import FileManager from "components/system/Files/FileManager";
import { useRef } from "react";
import { DESKTOP_PATH } from "utils/constants";

const Desktop: FC = ({ children }) => {
  const desktopRef = useRef<HTMLElement | null>(null);

  useWallpaper(desktopRef);
  // Paste files/images from the OS clipboard straight onto the Desktop.
  useFilePaste(DESKTOP_PATH);

  return (
    <StyledDesktop ref={desktopRef}>
      <FileManager
        url={DESKTOP_PATH}
        view="icon"
        allowMovingDraggableEntries
        hideLoading
        hideScrolling
        isDesktop
        loadIconsImmediately
        preloadShortcuts
      />
      <Widgets />
      {children}
    </StyledDesktop>
  );
};

export default Desktop;
