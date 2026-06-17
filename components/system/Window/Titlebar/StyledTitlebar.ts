import type { DefaultTheme } from "styled-components";
import styled from "styled-components";

type StyledTitlebarProps = {
  $foreground: boolean;
};

const styledBorder = ({
  $foreground,
  theme,
}: StyledTitlebarProps & { theme: DefaultTheme }): string =>
  $foreground
    ? `1px solid ${theme.colors.titleBar.background}`
    : `1px solid ${theme.colors.titleBar.backgroundInactive}`;

const StyledTitlebar = styled.header<StyledTitlebarProps>`
  background-color: ${({ $foreground, theme }) =>
    $foreground
      ? theme.colors.titleBar.background
      : theme.colors.titleBar.backgroundInactive};
  border-bottom: ${styledBorder};
  display: flex;
  height: ${({ theme }) => theme.sizes.titleBar.height}px;
  position: relative;
  top: 0;
  z-index: 2;

  h1 {
    color: ${({ $foreground, theme }) =>
      $foreground
        ? theme.colors.titleBar.text
        : theme.colors.titleBar.textInactive};
    display: flex;
    flex-grow: 1;
    font-size: ${({ theme }) => theme.sizes.titleBar.fontSize};
    font-weight: 400;
    min-width: 0;

    figure {
      align-items: center;
      display: flex;
      margin-left: 8px;
      min-width: inherit;
      position: relative;
      top: -1px;

      picture {
        height: ${({ theme }) => theme.sizes.titleBar.iconSize};
        margin-right: ${({ theme }) => theme.sizes.titleBar.iconMarginRight};
        width: ${({ theme }) => theme.sizes.titleBar.iconSize};
      }

      figcaption {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  nav {
    display: flex;

    button {
      border-left: ${styledBorder};
      box-sizing: content-box;
      display: flex;
      place-content: center;
      place-items: center;
      width: ${({ theme }) => theme.sizes.titleBar.buttonWidth};

      /* Win11 caption buttons read as clean, borderless cells with a softly
         rounded hover; Undercover drops the dividing border-left and rounds the
         hover fill (applied below). Default (Emacs) keeps its bordered cells. */
      ${({ theme }) =>
        theme.name === "Undercover" ? "border-left: none;" : ""}

      svg {
        fill: ${({ $foreground, theme }) =>
          $foreground
            ? theme.colors.titleBar.text
            : theme.colors.titleBar.buttonInactive};
        margin: 0 1px 2px 0;
        width: ${({ theme }) => theme.sizes.titleBar.buttonIconWidth};
      }

      &.minimize {
        svg {
          margin-bottom: 1px;
          margin-right: 0;
        }
      }

      &:hover {
        background-color: ${({ theme }) =>
          theme.colors.titleBar.backgroundHover};

        /* Win11 hover fill is a clean, softly rounded cell rather than a hard
           full-height block; Undercover only. Just rounds the corners of the
           fill — no padding/margin, so button geometry never shifts. Colors
           stay token-driven. */
        ${({ theme }) =>
          theme.name === "Undercover" ? "border-radius: 5px;" : ""}

        svg {
          fill: ${({ theme }) => theme.colors.titleBar.text};
        }

        &.close {
          background-color: ${({ theme }) => theme.colors.titleBar.closeHover};
          transition: background-color 0.25s ease;

          /* The Win11 red close hover needs white glyph for contrast. */
          ${({ theme }) =>
            theme.name === "Undercover"
              ? "svg { fill: rgb(255, 255, 255); }"
              : ""}
        }
      }

      &:active {
        background-color: ${({ theme }) =>
          theme.colors.titleBar.backgroundHover};

        ${({ theme }) =>
          theme.name === "Undercover" ? "border-radius: 5px;" : ""}

        &.close {
          background-color: ${({ theme }) => theme.colors.titleBar.closeHover};
        }
      }

      &:disabled {
        svg {
          fill: ${({ $foreground, theme }) =>
            $foreground
              ? theme.colors.titleBar.buttonInactive
              : theme.colors.titleBar.textInactive};
        }

        &:hover {
          background-color: inherit;
        }
      }
    }
  }
`;

export default StyledTitlebar;
