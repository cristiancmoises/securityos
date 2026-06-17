import FileManager from "components/system/Files/FileManager";
import Sidebar from "components/system/StartMenu/Sidebar";
import { Power } from "components/system/StartMenu/Sidebar/SidebarIcons";
import StyledKickoffBody from "components/system/StartMenu/StyledKickoffBody";
import StyledKickoffFooter from "components/system/StartMenu/StyledKickoffFooter";
import StyledKickoffHeader from "components/system/StartMenu/StyledKickoffHeader";
import StyledStartMenu from "components/system/StartMenu/StyledStartMenu";
import StyledStartMenuBackground from "components/system/StartMenu/StyledStartMenuBackground";
import useStartMenuTransition from "components/system/StartMenu/useStartMenuTransition";
import { useFileSystem } from "contexts/fileSystem";
import { resetStorage } from "contexts/fileSystem/functions";
import { useSession } from "contexts/session";
import type { Variant } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import {
  DEFAULT_SCROLLBAR_WIDTH,
  FOCUSABLE_ELEMENT,
  HOME,
  PREVENT_SCROLL,
} from "utils/constants";
import { haltEvent } from "utils/functions";

type StartMenuProps = {
  toggleStartMenu: (showMenu?: boolean) => void;
};

type StyleVariant = Variant & {
  height?: string;
};

const StartMenu: FC<StartMenuProps> = ({ toggleStartMenu }) => {
  const menuRef = useRef<HTMLElement | null>(null);
  const { rootFs } = useFileSystem();
  const { setHaltSession } = useSession();
  const [showScrolling, setShowScrolling] = useState(false);
  const restartSession = (): void => {
    setHaltSession(true);
    resetStorage(rootFs).finally(() => window.location.reload());
  };
  const revealScrolling: React.MouseEventHandler = ({ clientX = 0 }) => {
    const { width = 0 } = menuRef.current?.getBoundingClientRect() || {};

    setShowScrolling(clientX > width - DEFAULT_SCROLLBAR_WIDTH);
  };
  const maybeCloseMenu: React.FocusEventHandler<HTMLElement> = ({
    relatedTarget,
  }) => {
    const focusedElement = relatedTarget as HTMLElement | null;
    const focusedInsideMenu =
      focusedElement && menuRef.current?.contains(focusedElement);

    if (!focusedInsideMenu) {
      const focusedTaskbar = focusedElement === menuRef.current?.nextSibling;
      const focusedStartButton =
        focusedElement?.parentElement === menuRef.current?.nextSibling;

      if (!focusedTaskbar && !focusedStartButton) {
        toggleStartMenu(false);
      } else {
        menuRef.current?.focus(PREVENT_SCROLL);
      }
    }
  };
  const startMenuTransition = useStartMenuTransition();
  const { height } =
    (startMenuTransition.variants?.active as StyleVariant) ?? {};

  useLayoutEffect(() => menuRef.current?.focus(PREVENT_SCROLL), []);

  return (
    <StyledStartMenu
      ref={menuRef}
      $showScrolling={showScrolling}
      onBlurCapture={maybeCloseMenu}
      onMouseMove={revealScrolling}
      {...startMenuTransition}
      {...FOCUSABLE_ELEMENT}
    >
      <StyledStartMenuBackground $height={height} />
      <StyledKickoffHeader onContextMenu={haltEvent}>
        <div className="search">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
          </svg>
          <span className="placeholder">Search…</span>
        </div>
      </StyledKickoffHeader>
      <StyledKickoffBody>
        <Sidebar />
        <FileManager
          url={`${HOME}/Start Menu`}
          view="list"
          hideLoading
          hideShortcutIcons
          loadIconsImmediately
          preloadShortcuts
          readOnly
          skipFsWatcher
          skipSorting
          useNewFolderIcon
        />
      </StyledKickoffBody>
      <StyledKickoffFooter onContextMenu={haltEvent}>
        <button
          aria-label="Restart session"
          title="Clears the session and restarts."
          type="button"
          onClick={restartSession}
        >
          <Power />
          <span>Leave</span>
        </button>
      </StyledKickoffFooter>
    </StyledStartMenu>
  );
};

export default StartMenu;
