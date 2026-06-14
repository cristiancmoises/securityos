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

type SidebarProps = {
  height?: string;
};

const Sidebar: FC<SidebarProps> = ({ height }) => {
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
      name: "Iniciar",
      ...(collapsed && { tooltip: "Expand" }),
    },
    {
      active: true,
      icon: <AllApps />,
      name: "Todos os Programas",
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
          name: "Documentos",
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
          name: "Imagens",
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
          name: "Vídeos",
          ...(collapsed && { tooltip: "Videos" }),
        }
      : undefined,
    {
      action: () => {
        setHaltSession(true);
        resetStorage(rootFs).finally(() => window.location.reload());
      },
      icon: <Power />,
      name: "Desligar",
      tooltip: "Limpa a sessão e reinicia.",
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
      style={{ height }}
    >
      <SidebarGroup sidebarButtons={topButtons} />
      <SidebarGroup sidebarButtons={bottomButtons} />
    </StyledSidebar>
  );
};

export default Sidebar;
