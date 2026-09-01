import styled from "styled-components";

/**
 * KDE Plasma "Kickoff" header strip: a thin search bar pinned to the top of the
 * launcher. Token-driven (titleBar.background / accent.edge / text) so the
 * The neutral light Undercover theme recolors it. The search field is a real input
 * that queries the app/file index and shows a results dropdown (see Search.tsx).
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
  position: relative;
  z-index: 1;

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
    padding: 0 8px;
    position: relative;

    svg {
      fill: ${({ theme }) => theme.colors.text};
      flex-shrink: 0;
      height: 13px;
      opacity: 70%;
      width: 13px;
    }

    input {
      background: transparent;
      border: 0;
      color: ${({ theme }) => theme.colors.text};
      flex: 1;
      font-size: 12px;
      height: 100%;
      min-width: 0;
      outline: none;
      padding: 0;
    }

    input::placeholder {
      color: ${({ theme }) => theme.colors.text};
      opacity: 55%;
    }

    .search-results {
      background-color: ${({ theme }) => theme.colors.window.background};
      border: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
      border-radius: ${({ theme }) => theme.sizes.window.radius};
      box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 60%);
      left: 0;
      list-style: none;
      margin: 0;
      max-height: 320px;
      overflow-y: auto;
      padding: 4px;
      position: absolute;
      right: 0;
      top: calc(100% + 5px);
      z-index: 2;
    }

    .search-results li {
      list-style: none;
    }

    .search-results .empty {
      color: ${({ theme }) => theme.colors.text};
      font-size: 12px;
      opacity: 55%;
      padding: 8px 10px;
    }

    .search-results button {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: ${({ theme }) => theme.sizes.window.radius};
      color: ${({ theme }) => theme.colors.text};
      cursor: pointer;
      display: flex;
      font-size: 12.5px;
      gap: 9px;
      padding: 7px 9px;
      text-align: left;
      width: 100%;
    }

    .search-results button:hover {
      background-color: ${({ theme }) => theme.colors.accent.edge};
    }

    .search-results img {
      flex-shrink: 0;
      height: 18px;
      width: 18px;
    }

    .search-results picture {
      flex-shrink: 0;
      height: 18px;
      width: 18px;
    }

    .search-results span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;

export default StyledKickoffHeader;
