import styled from "styled-components";

/**
 * The full-desktop overlay layer. It must NOT eat pointer events itself (so the
 * desktop icons + right-click work in the gaps), only the cards/buttons on it do.
 */
export const StyledWidgetsLayer = styled.div`
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 1;

  /* Re-enable interaction on the actual interactive children. */
  button,
  input,
  select,
  textarea {
    pointer-events: auto;
  }
`;

/** Floating gear button (bottom-right, above the taskbar). */
export const StyledGearButton = styled.button`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.taskbar.background};
  border: 1px solid ${({ theme }) => theme.colors.accent.edge};
  border-radius: 6px;
  bottom: 42px;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  font-size: 18px;
  height: 34px;
  justify-content: center;
  line-height: 1;
  opacity: 0.65;
  padding: 0;
  pointer-events: auto;
  position: absolute;
  right: 12px;
  transition: opacity 120ms ease-in-out;
  width: 34px;

  &:hover,
  &:focus-visible {
    opacity: 1;
  }
`;

/** The settings popover anchored above the gear. */
export const StyledGearPanel = styled.div`
  background-color: ${({ theme }) => theme.colors.window.background};
  border: 1px solid ${({ theme }) => theme.colors.accent.edge};
  border-radius: 8px;
  bottom: 84px;
  box-shadow: ${({ theme }) => theme.colors.window.shadow};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 13px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding: 12px 14px;
  pointer-events: auto;
  position: absolute;
  right: 12px;
  width: 260px;

  h2 {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.4px;
    margin: 0 0 8px;
    opacity: 0.85;
    text-transform: uppercase;
  }

  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.accent.edge};
    margin: 12px 0;
    opacity: 0.4;
  }

  label.toggle {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding: 4px 0;

    input {
      cursor: pointer;
    }
  }

  label.field {
    display: block;
    margin-top: 8px;

    span {
      display: block;
      margin-bottom: 4px;
      opacity: 0.8;
    }
  }

  input[type="text"] {
    background-color: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.accent.edge};
    border-radius: 4px;
    box-sizing: border-box;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 12px;
    padding: 5px 7px;
    width: 100%;

    &:focus-visible {
      border-color: ${({ theme }) => theme.colors.highlight};
      outline: none;
    }
  }

  .results {
    list-style: none;
    margin: 4px 0 0;
    max-height: 140px;
    overflow-y: auto;
    padding: 0;

    li button {
      background: none;
      border: none;
      border-radius: 4px;
      color: ${({ theme }) => theme.colors.text};
      cursor: pointer;
      display: block;
      font-family: inherit;
      font-size: 12px;
      padding: 5px 7px;
      text-align: left;
      width: 100%;

      &:hover,
      &:focus-visible {
        background-color: ${({ theme }) => theme.colors.highlightBackground};
        outline: none;
      }
    }
  }

  .hint {
    font-size: 11px;
    margin-top: 6px;
    opacity: 0.6;
  }
`;

/**
 * A single translucent "rainmeter" card. Draggable via pointer events; the
 * whole card is the drag handle.
 */
export const StyledWidgetCard = styled.div`
  backdrop-filter: blur(6px);
  background-color: hsla(220, 9%, 8%, 60%);
  border: 1px solid ${({ theme }) => theme.colors.accent.edge};
  border-radius: 10px;
  box-shadow: 0 6px 18px 0 hsla(220, 25%, 3%, 45%);
  color: ${({ theme }) => theme.colors.text};
  cursor: grab;
  font-family: ${({ theme }) => theme.formats.displayFont};
  padding: 14px 16px;
  pointer-events: auto;
  position: absolute;
  -webkit-user-select: none;
  user-select: none;

  &.dragging {
    cursor: grabbing;
  }

  .widget-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-bottom: 8px;
    opacity: 0.55;
    text-transform: uppercase;
  }

  .clock-time {
    font-size: 44px;
    font-weight: 500;
    letter-spacing: 1px;
    line-height: 1;
  }

  .clock-date {
    font-size: 14px;
    margin-top: 6px;
    opacity: 0.8;
  }

  .weather-now {
    align-items: center;
    display: flex;
    gap: 12px;

    .weather-emoji {
      font-size: 40px;
      line-height: 1;
    }

    .weather-temp {
      font-size: 30px;
      font-weight: 500;
    }

    .weather-text {
      font-size: 12px;
      opacity: 0.8;
    }
  }

  .weather-location {
    font-size: 12px;
    margin-bottom: 8px;
    opacity: 0.7;
  }

  .weather-meta {
    font-size: 11px;
    margin-top: 4px;
    opacity: 0.6;
  }

  .weather-forecast {
    display: flex;
    gap: 12px;
    margin-top: 12px;

    .day {
      align-items: center;
      display: flex;
      flex-direction: column;
      font-size: 11px;
      gap: 2px;
      min-width: 38px;

      .day-icon {
        font-size: 18px;
        line-height: 1;
      }

      .day-temps {
        white-space: nowrap;
      }

      .day-temps .lo {
        opacity: 0.55;
      }
    }
  }

  .gauge {
    margin-top: 4px;

    .gauge-value {
      font-size: 28px;
      font-weight: 500;
    }

    .gauge-track {
      background-color: ${({ theme }) => theme.colors.progressBackground};
      border-radius: 999px;
      height: 7px;
      margin-top: 8px;
      overflow: hidden;
      width: 100%;
    }

    .gauge-fill {
      background-color: ${({ theme }) => theme.colors.progress};
      height: 100%;
      transition: width 300ms ease-out, background-color 300ms ease-out;
    }

    .gauge-detail {
      font-size: 11px;
      margin-top: 6px;
      opacity: 0.6;
    }
  }

  .news-list {
    list-style: none;
    margin: 0;
    max-width: 280px;
    padding: 0;

    li {
      font-family: ${({ theme }) => theme.formats.systemFont};
      font-size: 12px;
      line-height: 1.35;
      overflow: hidden;
      padding: 4px 0;
      text-overflow: ellipsis;
      white-space: nowrap;

      & + li {
        border-top: 1px solid ${({ theme }) => theme.colors.accent.edge};
      }
    }

    li a {
      color: ${({ theme }) => theme.colors.text};
      text-decoration: none;

      &:hover {
        color: ${({ theme }) => theme.colors.highlight};
        text-decoration: underline;
      }
    }
  }

  .widget-status {
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    opacity: 0.65;
  }

  .widget-error {
    color: ${({ theme }) => theme.colors.titleBar.closeHover};
  }

  .calendar {
    font-family: ${({ theme }) => theme.formats.systemFont};
    width: 224px;

    .calendar-header {
      align-items: center;
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .calendar-month {
      font-size: 13px;
      font-weight: 600;
    }

    .calendar-nav {
      background: none;
      border: 1px solid ${({ theme }) => theme.colors.accent.edge};
      border-radius: 4px;
      color: ${({ theme }) => theme.colors.text};
      cursor: pointer;
      font-size: 14px;
      height: 22px;
      line-height: 1;
      padding: 0;
      width: 22px;

      &:hover,
      &:focus-visible {
        background-color: ${({ theme }) => theme.colors.highlightBackground};
        outline: none;
      }
    }

    .calendar-grid {
      display: grid;
      gap: 2px;
      grid-template-columns: repeat(7, 1fr);
    }

    .calendar-weekday {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      opacity: 0.55;
      padding-bottom: 2px;
      text-align: center;
      text-transform: uppercase;
    }

    .calendar-day {
      align-items: center;
      border-radius: 4px;
      display: flex;
      font-size: 12px;
      height: 26px;
      justify-content: center;

      &.muted {
        opacity: 0.3;
      }

      &.today {
        background-color: ${({ theme }) => theme.colors.highlight};
        color: ${({ theme }) => theme.colors.background};
        font-weight: 600;
      }
    }
  }

  &.postit {
    background-color: hsla(48, 95%, 60%, 92%);
    border-color: hsla(45, 80%, 45%, 80%);
    color: hsl(40, 35%, 12%);

    .widget-title {
      opacity: 0.6;
    }

    .postit-text {
      background: transparent;
      border: none;
      color: inherit;
      cursor: text;
      font-family: ${({ theme }) => theme.formats.systemFont};
      font-size: 13px;
      height: 132px;
      line-height: 1.4;
      outline: none;
      padding: 0;
      resize: none;
      -webkit-user-select: text;
      user-select: text;
      width: 188px;

      &::placeholder {
        color: hsla(40, 35%, 12%, 55%);
      }
    }
  }
`;
