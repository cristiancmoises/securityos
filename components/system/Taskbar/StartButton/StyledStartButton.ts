import styled from "styled-components";
import Button from "styles/common/Button";

type StyledStartButtonProps = {
  $active: boolean;
};

const StyledStartButton = styled(Button)<StyledStartButtonProps>`
  background-color: ${({ $active, theme }) =>
    $active && theme.colors.taskbar.foreground};
  display: flex;
  fill: ${({ theme }) => theme.colors.startButton};
  height: 100%;
  left: 0;
  place-content: center;
  place-items: center;
  position: absolute;

  && {
    width: ${({ theme }) => theme.sizes.startButton.width};
  }

  svg,
  img {
    height: ${({ theme }) => theme.sizes.startButton.iconSize};
    width: auto;
  }

  svg {
    filter: ${({ theme }) =>
      `drop-shadow(0 0 5px ${theme.colors.accent.start})`};
  }

  &:hover {
    background-color: ${({ $active, theme }) =>
      $active ? undefined : theme.colors.taskbar.hover};

    svg {
      fill: ${({ theme }) => theme.colors.highlight};
      filter: ${({ theme }) =>
        `drop-shadow(0 0 8px ${theme.colors.accent.glowStrong})`};
    }
  }

  &:active {
    background-color: hsla(190, 100%, 60%, 18%);

    svg {
      fill: hsla(190, 100%, 65%, 90%);
    }
  }
`;

export default StyledStartButton;
