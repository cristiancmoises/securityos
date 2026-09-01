import styled from "styled-components";

const StyledClock = styled.div`
  color: ${({ theme }) => theme.colors.text};
  display: flex;

  /* HUD readout: the theme display font, wide tracking and a faint accent glow. */
  font-family: ${({ theme }) => theme.formats.displayFont};
  font-size: ${({ theme }) => theme.sizes.clock.fontSize};
  font-weight: 500;
  letter-spacing: 0.4px;
  text-shadow: ${({ theme }) => `0 0 6px ${theme.colors.accent.start}`};
  height: 100%;
  max-width: ${({ theme }) => `calc(${theme.sizes.clock.width} + 10px)`};
  min-width: ${({ theme }) => theme.sizes.clock.width};
  padding: 0 5px;
  place-content: center;
  place-items: center;
  position: absolute;
  right: 0;

  &:hover {
    background-color: ${({ theme }) => theme.colors.taskbar.hover};
  }

  &:active {
    background-color: ${({ theme }) => theme.colors.taskbar.foreground};
  }

  /* Enterprise disguise: stack the time over the date, right-aligned and smaller,
     in the bottom-right corner of the taskbar. Gated on the Undercover theme so the
     default single-line HUD clock above is completely untouched. */
  &.undercover {
    flex-direction: column;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1.15;
    max-width: none;
    min-width: 0;
    padding: 0 12px;
    place-content: center;
    place-items: end center;
    text-align: center;
    text-shadow: none;
  }
`;

export default StyledClock;
