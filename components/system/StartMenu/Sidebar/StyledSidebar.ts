import styled from "styled-components";

const StyledSidebar = styled.nav`
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  margin-right: 7px;
  overflow: hidden;
  padding-top: 4px;
  position: absolute;
  top: 0;
  transition-duration: 150ms;
  width: ${({ theme }) => theme.sizes.startMenu.sideBar.width}px;
  z-index: 1;

  &:hover:not(&.collapsed) {
    backdrop-filter: blur(12px);

    /* KDE Kickoff category rail surface — token-driven so the expanded rail recolors
       with the theme (the Undercover light palette stays light). */
    background-color: ${({ theme }) => theme.colors.titleBar.background};
    box-shadow: ${({ theme }) => `8px 0 5px -5px ${theme.colors.accent.glow}`};
    transition: all 300ms ease, backdrop-filter 1ms;
    transition-timing-function: cubic-bezier(0.15, 1, 0.5, 1);
    width: ${({ theme }) => theme.sizes.startMenu.sideBar.expandedWidth};
  }
`;

export default StyledSidebar;
