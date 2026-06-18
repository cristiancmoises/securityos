import styled from "styled-components";
import { TASKBAR_HEIGHT } from "utils/constants";

// Volume widget — sits immediately to the LEFT of the Clock (right: clock.width)
// and reserves theme.sizes.volume.width (StyledTaskbarEntries leaves room for it).
const StyledVolume = styled.div`
  height: 100%;
  position: absolute;
  right: ${({ theme }) => theme.sizes.clock.width};
  width: ${({ theme }) => theme.sizes.volume.width};
  z-index: 1;

  .volume-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    height: 100%;
    justify-content: center;
    width: 100%;
  }

  .volume-button:hover {
    background-color: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .volume-button:active {
    background-color: ${({ theme }) => theme.colors.taskbar.foreground};
  }

  .volume-button svg {
    fill: ${({ theme }) => theme.colors.text};
    filter: drop-shadow(
      ${({ theme }) => `0 0 4px ${theme.colors.accent.start}`}
    );
    height: 16px;
    width: 16px;
  }

  .popover {
    align-items: center;
    backdrop-filter: blur(${({ theme }) => theme.sizes.taskbar.blur});
    background-color: ${({ theme }) => theme.colors.taskbar.background};
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 6px;
    bottom: ${TASKBAR_HEIGHT + 6}px;
    box-shadow: 0 6px 18px rgb(0 0 0 / 45%);
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 8px 10px;
    position: absolute;
    right: 2px;
  }

  .popover input[type="range"] {
    accent-color: ${({ theme }) => theme.colors.highlight};
    cursor: pointer;
    width: 110px;
  }

  .popover .mute {
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
  }

  .popover .pct {
    color: ${({ theme }) => theme.colors.text};
    font-size: 10px;
    min-width: 30px;
    text-align: right;
  }
`;

export default StyledVolume;
