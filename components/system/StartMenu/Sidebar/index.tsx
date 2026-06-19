import type { SidebarButtons } from "components/system/StartMenu/Sidebar/SidebarButton";
import SidebarButton from "components/system/StartMenu/Sidebar/SidebarButton";
import {
  AllApps,
  Documents,
  Pictures,
  Power,
  SideMenu,
  Videos,
} from "components/system/StartMenu/Sidebar/SidebarIcons";
import StyledSidebar from "components/system/StartMenu/Sidebar/StyledSidebar";
import { lockScreen } from "components/system/Lockscreen/useLock";
import { useFileSystem } from "contexts/fileSystem";
import { resetStorage } from "contexts/fileSystem/functions";
import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "styled-components";
import { HOME, TASKBAR_HEIGHT } from "utils/constants";
import { haltEvent, viewHeight } from "utils/functions";

type SidebarGroupProps = {
  sidebarButtons: SidebarButtons;
};

const SidebarGroup: FC<SidebarGroupProps> = ({ sidebarButtons }) => (
  <ol>
    {sidebarButtons.map((button) => (
      <SidebarButton key={button.name} {...button} />
    ))}
  </ol>
);

const Sidebar: FC = () => {
  const { rootFs } = useFileSystem();
  const { open } = useProcesses();
  const { setHaltSession } = useSession();
  const [collapsed, setCollapsed] = useState(true);
  const expandTimer = useRef<number>();
  const clearTimer = (): void => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
  };
  const topButtons: SidebarButtons = [
    {
      heading: true,
      icon: <SideMenu />,
      name: "Start",
      ...(collapsed && { tooltip: "Expand" }),
    },
    {
      active: true,
      icon: <AllApps />,
      name: "All Programs",
      ...(collapsed && { tooltip: "All apps" }),
    },
  ];
  const { sizes } = useTheme();
  const vh = viewHeight();
  const buttonAreaCount = useMemo(
    () => Math.floor((vh - TASKBAR_HEIGHT) / sizes.startMenu.sideBar.width),
    [sizes.startMenu.sideBar.width, vh]
  );

  const bottomButtons = [
    buttonAreaCount > 3
      ? {
          action: () =>
            open(
              "FileExplorer",
              { url: `${HOME}/Documents` },
              "/System/Icons/documents.webp"
            ),
          icon: <Documents />,
          name: "Documents",
          ...(collapsed && { tooltip: "Documents" }),
        }
      : undefined,
    buttonAreaCount > 4
      ? {
          action: () =>
            open(
              "FileExplorer",
              { url: `${HOME}/Pictures` },
              "/System/Icons/pictures.webp"
            ),
          icon: <Pictures />,
          name: "Pictures",
          ...(collapsed && { tooltip: "Pictures" }),
        }
      : undefined,
    buttonAreaCount > 5
      ? {
          action: () =>
            open(
              "Explorer",
              { url: `${HOME}/Videos` },
              "/System/Icons/videos.webp"
            ),
          icon: <Videos />,
          name: "Videos",
          ...(collapsed && { tooltip: "Videos" }),
        }
      : undefined,
    {
      action: () => lockScreen(),
      icon: (
        <svg height="100%" viewBox="0 0 24 24" width="100%">
          <path
            d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z"
            fill="currentColor"
          />
        </svg>
      ),
      name: "Lock",
      ...(collapsed && { tooltip: "Lock screen" }),
    },
    {
      action: () => {
        setHaltSession(true);
        resetStorage(rootFs).finally(() => window.location.reload());
      },
      icon: <Power />,
      name: "Power",
      tooltip: "Clears the session and restarts.",
    },
  ].filter(Boolean) as SidebarButtons;

  useEffect(() => clearTimer, []);

  return (
    <StyledSidebar
      className={collapsed ? "collapsed" : undefined}
      onClick={() => {
        clearTimer();
        setCollapsed((collapsedState) => !collapsedState);
      }}
      onContextMenu={haltEvent}
      onMouseEnter={() => {
        expandTimer.current = window.setTimeout(() => setCollapsed(false), 700);
      }}
      onMouseLeave={() => {
        clearTimer();
        setCollapsed(true);
      }}
    >
      <SidebarGroup sidebarButtons={topButtons} />
      <SidebarGroup sidebarButtons={bottomButtons} />
    </StyledSidebar>
  );
};

export default Sidebar;
