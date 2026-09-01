import styled from "styled-components";

/**
 * KDE Plasma "Kickoff" leave/power footer row: a thin strip pinned to the bottom of
 * the launcher, separated from the app list by an accent.edge top border. Token-driven
 * (titleBar.background / accent.edge / text / highlight) so the light Undercover
 * theme recolors it. The "Restart session" action mirrors the existing sidebar
 * Power button so the row is functional rather than purely decorative.
 */
const StyledKickoffFooter = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.titleBar.background};
  border-top: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  height: 34px;
  justify-content: flex-end;
  padding: 0 8px;

  button {
    align-items: center;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: ${({ theme }) => theme.sizes.window.radius};
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    font-size: 12px;
    gap: 6px;
    height: 24px;
    padding: 0 9px;

    svg {
      fill: ${({ theme }) => theme.colors.text};
      height: 13px;
      width: 13px;
    }

    &:hover {
      background-color: ${({ theme }) => theme.colors.highlightBackground};
      border-color: ${({ theme }) => theme.colors.accent.edge};
      color: ${({ theme }) => theme.colors.highlight};

      svg {
        fill: ${({ theme }) => theme.colors.highlight};
      }
    }

    &:active {
      opacity: 85%;
    }
  }
`;

export default StyledKickoffFooter;
