import styled from "styled-components";

/**
 * KDE Plasma "Kickoff" header strip: a thin search-affordance bar pinned to the top
 * of the launcher. Token-driven (titleBar.background / accent.edge / text) so the
 * Undercover (Windows 11 light) theme recolors it. The search field is presentational
 * — it reads as an intentional Plasma search box without altering the app list/scroll.
 */
const StyledKickoffHeader = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.titleBar.background};
  border-bottom: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  height: 36px;
  padding: 0 10px;

  .search {
    align-items: center;
    background-color: ${({ theme }) => theme.colors.window.background};
    border: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
    border-radius: ${({ theme }) => theme.sizes.window.radius};
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    flex: 1;
    gap: 7px;
    height: 24px;
    opacity: 80%;
    padding: 0 8px;

    svg {
      fill: ${({ theme }) => theme.colors.text};
      flex-shrink: 0;
      height: 13px;
      opacity: 70%;
      width: 13px;
    }

    .placeholder {
      color: ${({ theme }) => theme.colors.text};
      font-size: 12px;
      opacity: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;

export default StyledKickoffHeader;
