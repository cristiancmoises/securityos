import StyledTaskbarEntry from "components/system/Taskbar/TaskbarEntry/StyledTaskbarEntry";
import { m as motion } from "framer-motion";
import styled from "styled-components";
import { PEEK_MAX_WIDTH, TASKBAR_HEIGHT } from "utils/constants";

type StyledPeekWindowProps = {
  $offsetX: number;
};

const StyledPeekWindow = styled(motion.div)<StyledPeekWindowProps>`
  background-color: ${({ theme }) => theme.colors.taskbar.background};
  border: ${({ theme }) => `1px solid ${theme.colors.taskbar.peekBorder}`};
  border-bottom: 0;
  bottom: ${TASKBAR_HEIGHT}px;
  display: flex;
  overflow: hidden;
  place-content: center;
  place-items: flex-start;
  position: fixed;
  transform: ${({ $offsetX }) =>
    $offsetX ? `translateX(${$offsetX}px)` : undefined};

  ${StyledTaskbarEntry}:hover & {
    background-color: hsla(190, 100%, 60%, 16%);

    &:active {
      background-color: ${({ theme }) => theme.colors.taskbar.activeForeground};
    }
  }

  img {
    height: ${({ theme }) => theme.sizes.taskbar.entry.peekImage.height}px;
    margin: ${({ theme }) => theme.sizes.taskbar.entry.peekImage.margin}px;
    max-height: ${PEEK_MAX_WIDTH}px;
    max-width: ${PEEK_MAX_WIDTH}px;
    min-height: 80px;
    min-width: 80px;
    object-fit: contain;
  }

  button {
    background-color: hsla(222, 47%, 7%, 85%);
    height: 32px;
    position: absolute;
    right: 0;
    top: 0;
    width: 32px;

    svg {
      fill: ${({ theme }) => theme.colors.text};
      width: 12px;
    }

    &:active {
      background-color: ${({ theme }) => theme.colors.titleBar.closeHover};
    }

    &:hover {
      background-color: hsla(312, 100%, 60%, 50%);
    }
  }
`;

export default StyledPeekWindow;
