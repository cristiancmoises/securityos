import StyledFileManager from "components/system/Files/Views/List/StyledFileManager";
import { m as motion } from "framer-motion";
import styled, { css } from "styled-components";
import ScrollBars from "styles/common/ScrollBars";
import { TASKBAR_HEIGHT, THIN_SCROLLBAR_WIDTH } from "utils/constants";

type StyledStartMenuProps = {
  $showScrolling: boolean;
};

const SCROLLBAR_PADDING_OFFSET = 3;
const HOVER_ADJUSTED_PADDING = THIN_SCROLLBAR_WIDTH - SCROLLBAR_PADDING_OFFSET;

const ThinScrollBars = css<StyledStartMenuProps>`
  &::-webkit-scrollbar {
    width: ${({ $showScrolling }) =>
      $showScrolling ? THIN_SCROLLBAR_WIDTH : SCROLLBAR_PADDING_OFFSET}px;
  }

  &::-webkit-scrollbar-corner,
  &::-webkit-scrollbar-track {
    background-color: ${({ $showScrolling }) =>
      $showScrolling ? undefined : "transparent"};
  }

  &::-webkit-scrollbar-button:single-button {
    background-color: ${({ $showScrolling }) =>
      $showScrolling ? undefined : "transparent"};
    border: ${({ $showScrolling }) =>
      $showScrolling ? undefined : "1px solid transparent"};
  }

  &::-webkit-scrollbar-thumb:vertical {
    background-color: ${({ $showScrolling, theme }) => {
      if ($showScrolling) return undefined;

      /* Resting (overlay) thumb. Default keeps its existing tint; Undercover uses the
         theme highlight so a faint cyan doesn't float on the light track. */
      return theme.name === "Undercover"
        ? theme.colors.highlight
        : "hsla(190, 100%, 60%, 45%)";
    }};
  }
`;

const StyledStartMenu = styled(motion.nav)<StyledStartMenuProps>`
  /* KDE Plasma "Kickoff" launcher panel surface. The default (Emacs) keeps its
     near-black buffer tone; Undercover uses the light window.background so the panel
     reads as one consistent surface with its header/body/footer strips instead of a
     dark slab behind light chrome. */
  background-color: ${({ theme }) =>
    theme.name === "Undercover"
      ? theme.colors.window.background
      : "hsla(222, 47%, 7%, 95%)"};

  /* A clean panel with an accent.edge outline (instead of a single neon right edge)
     so the header/body/footer strips read as one Plasma surface; theme-driven so
     Undercover flattens it. */
  border: ${({ theme }) => `1px solid ${theme.colors.accent.edge}`};
  border-radius: ${({ theme }) => theme.sizes.window.radius};
  bottom: ${TASKBAR_HEIGHT}px;

  /* Drop shadow sized per theme: the default keeps its heavy near-black cast; the
     light Undercover theme borrows the softer window.shadow tone so it doesn't sit
     under a harsh dark halo. The accent.glow layers are transparent in both. */
  box-shadow: ${({ theme }) =>
    theme.name === "Undercover"
      ? `0 0 0 1px ${theme.colors.accent.glow}, ${theme.colors.window.shadow}, 0 0 30px 0 ${theme.colors.accent.glow}`
      : `0 0 0 1px ${theme.colors.accent.glow}, 6px 0 26px 2px hsla(222, 70%, 2%, 70%), 0 0 30px 0 ${theme.colors.accent.glow}`};
  contain: strict;
  display: flex;
  flex-direction: column;
  height: 100%;
  left: 0;
  max-height: ${({ theme }) => theme.sizes.startMenu.maxHeight}px;
  max-width: ${({ theme }) => theme.sizes.startMenu.size}px;
  overflow: hidden;
  position: absolute;
  width: 100%;
  z-index: 10000;

  @supports ((-webkit-backdrop-filter: none) or (backdrop-filter: none)) {
    backdrop-filter: blur(18px) saturate(160%);

    /* Translucent surface so the blur shows through. Default keeps its near-black
       buffer tone; Undercover uses a translucent light glass to match its strips. */
    background-color: ${({ theme }) =>
      theme.name === "Undercover"
        ? "hsla(214, 33%, 97%, 70%)"
        : "hsla(222, 47%, 7%, 70%)"};
  }

  ${StyledFileManager} {
    ${ScrollBars(THIN_SCROLLBAR_WIDTH, -2, -1)};

    flex: 1;
    margin-top: 0;
    min-height: 0;
    padding-left: ${({ theme }) => theme.sizes.startMenu.sideBar.width}px;
    padding-right: ${THIN_SCROLLBAR_WIDTH}px;
    padding-top: 7px;
    scrollbar-width: none;

    ${StyledFileManager} {
      margin: 0;
      overflow: hidden;
      padding: 0;

      /* Plasma launcher app rows: tidy, slightly rounded rows with a highlight /
         highlightBackground hover wash. Scoped to the Start Menu only (it does not
         touch the shared FileExplorer list view); token-driven for Undercover. */
      figure {
        border-radius: ${({ theme }) => theme.sizes.window.radius};
        margin: 1px 4px;

        picture {
          margin-left: 9px;
        }

        &:active {
          picture {
            margin-left: 13px;
          }
        }

        &:hover {
          background-color: ${({ theme }) => theme.colors.highlightBackground};
          border: ${({ theme }) => `1px solid ${theme.colors.highlight}`};
        }
      }
    }

    &::-webkit-scrollbar {
      width: 0;
    }

    &:hover {
      ${ThinScrollBars};
      padding-right: ${({ $showScrolling }) =>
        $showScrolling ? 0 : `${HOVER_ADJUSTED_PADDING}px`};

      @supports (scrollbar-width: thin) {
        padding-right: 5px;
        scrollbar-width: thin;
      }
    }

    @media (hover: none), (pointer: coarse) {
      ${ThinScrollBars};

      &::-webkit-scrollbar-track {
        margin: 13px 0;
      }
    }
  }
`;

export default StyledStartMenu;
