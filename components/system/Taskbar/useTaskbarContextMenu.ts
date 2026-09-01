import { useMenu } from "contexts/menu";
import type {
  ContextMenuCapture,
  MenuItem,
} from "contexts/menu/useMenuContextState";
import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import { useProcessesRef } from "hooks/useProcessesRef";
import { useMemo } from "react";
import { MENU_SEPERATOR } from "utils/constants";
import { toggleFullScreen, toggleShowDesktop } from "utils/functions";

const useTaskbarContextMenu = (onStartButton = false): ContextMenuCapture => {
  const { contextMenu } = useMenu();
  const { minimize, open } = useProcesses();
  const { disableUndercover, enableUndercover, themeName } = useSession();
  const processesRef = useProcessesRef();

  return useMemo(
    () =>
      contextMenu?.(() => {
        const processArray = Object.entries(processesRef.current);
        const allWindowsMinimized =
          processArray.length > 0 &&
          !processArray.some(([, { minimized }]) => !minimized);
        const toggleLabel = allWindowsMinimized
          ? "Show Open Windows"
          : "Show the Desktop";
        const menuItems: MenuItem[] = [
          {
            action: () => toggleShowDesktop(processesRef.current, minimize),
            label: onStartButton ? "Desktop" : toggleLabel,
          },
        ];

        if (onStartButton) {
          menuItems.unshift(
            {
              action: () => open("Terminal"),
              label: "Terminal",
            },
            MENU_SEPERATOR,
            {
              action: () => open("FileExplorer"),
              label: "Explorer",
            },
            {
              action: () => open("Run"),
              label: "Run",
            },
            MENU_SEPERATOR
          );
        } else {
          menuItems.unshift(
            {
              action: toggleFullScreen,
              label: document.fullscreenElement
                ? "Exit Full Screen"
                : "Enter Full Screen",
            },
            MENU_SEPERATOR
          );
        }

        const undercoverOn = themeName === "undercover";

        menuItems.push(MENU_SEPERATOR, {
          action: () => {
            if (undercoverOn) {
              disableUndercover();
            } else {
              enableUndercover();
            }
          },
          label: "Undercover enterprise mode",
          toggle: undercoverOn,
        });

        return menuItems;
      }),
    [
      contextMenu,
      disableUndercover,
      enableUndercover,
      minimize,
      onStartButton,
      open,
      processesRef,
      themeName,
    ]
  );
};

export default useTaskbarContextMenu;
