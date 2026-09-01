import StyledSidebar from "components/system/StartMenu/Sidebar/StyledSidebar";
import styled from "styled-components";

type StyledSidebarButtonProps = {
  $active?: boolean;
};

const StyledSidebarButton = styled.li<StyledSidebarButtonProps>`
  /* KDE Plasma "Kickoff" category rail: flat rows, a left accent bar on the active
     item and a highlightBackground selected/hover wash — all theme-driven so the
     light Undercover palette recolors the rail. */
  background-color: ${({ $active, theme }) =>
    $active ? theme.colors.highlightBackground : "transparent"};
  border: 1px solid transparent;
  display: flex;
  height: ${({ theme }) => theme.sizes.startMenu.sideBar.height};
  place-content: center;
  place-items: center;
  transition-duration: 150ms;
  width: ${({ theme }) => theme.sizes.startMenu.sideBar.width}px;

  &::before {
    border-left: ${({ $active, theme }) =>
      `4px solid ${$active ? theme.colors.highlight : "transparent"}`};
    content: "";
    height: ${({ theme }) => theme.sizes.startMenu.sideBar.height};
    left: 0;
    position: absolute;
    width: ${({ theme }) => theme.sizes.startMenu.sideBar.width}px;
  }

  figure {
    color: ${({ $active, theme }) =>
      $active ? theme.colors.highlight : theme.colors.text};
    display: flex;
    place-items: center;

    svg {
      fill: ${({ $active, theme }) =>
        $active ? theme.colors.highlight : theme.colors.text};
      height: ${({ theme }) => theme.sizes.startMenu.sideBar.iconSize};
      left: ${({ theme }) => theme.sizes.startMenu.sideBar.iconSize};
      margin-left: 1px;
      position: absolute;
      width: ${({ theme }) => theme.sizes.startMenu.sideBar.iconSize};
    }

    figcaption {
      border: 1px solid transparent;
      left: ${({ theme }) => theme.sizes.startMenu.sideBar.width}px;
      position: absolute;
      white-space: nowrap;

      strong {
        font-weight: 600;
      }
    }
  }

  ${StyledSidebar}:hover:not(${StyledSidebar}.collapsed) & {
    transition: width 300ms;
    transition-timing-function: cubic-bezier(0.15, 1, 0.5, 1);
    width: ${({ theme }) => theme.sizes.startMenu.sideBar.expandedWidth};
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
  }

  &:active {
    background-color: ${({ theme }) => theme.colors.taskbar.active};
  }
`;

export default StyledSidebarButton;
