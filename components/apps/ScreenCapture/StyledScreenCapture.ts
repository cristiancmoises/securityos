import styled from "styled-components";

// Screen Capture — a compact "capture studio" panel. Theme-token driven (purple
// accent from theme.colors.highlight) with a red record action. Top-aligned and
// scrollable so the option grid breathes; the Screenshot / Record buttons sit in a
// prominent action bar.
const StyledScreenCapture = styled.div`
  background: radial-gradient(
      130% 90% at 50% -10%,
      color-mix(
          in srgb,
          ${({ theme }) => theme.colors.highlight} 18%,
          transparent
        )
        0%,
      transparent 55%
    ),
    ${({ theme }) => theme.colors.background};
  box-sizing: border-box;
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  gap: 14px;
  height: 100%;
  overflow: auto;
  padding: 18px 18px 20px;
  position: relative;
  width: 100%;

  h1 {
    align-items: center;
    display: flex;
    font-size: 18px;
    font-weight: 700;
    gap: 8px;
    letter-spacing: 0.2px;
    margin: 0;
  }

  h1::before {
    content: "🎬";
    font-size: 20px;
  }

  .sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11.5px;
    line-height: 1.5;
    margin: -8px 0 0;
  }

  .sub b {
    color: ${({ theme }) => theme.colors.text};
  }

  /* Two-column responsive grid of option "fields". */
  .options {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .options label {
    align-items: center;
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.text} 5%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, ${({ theme }) => theme.colors.text} 10%, transparent);
    border-radius: 8px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    font-size: 11.5px;
    gap: 8px;
    justify-content: space-between;
    min-height: 34px;
    padding: 6px 10px;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .options label:hover:not(:has(:disabled)) {
    border-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.highlight} 55%,
      transparent
    );
  }

  .options select {
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 45%,
        transparent
      );
    border-radius: 5px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    flex: 0 1 auto;
    font-family: inherit;
    font-size: 11.5px;
    max-width: 58%;
    padding: 3px 5px;
  }

  .options select:focus {
    border-color: ${({ theme }) => theme.colors.highlight};
    outline: none;
  }

  /* Checkbox fields: the box sits first, so left-align them. */
  .options label:has(input[type="checkbox"]) {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    justify-content: flex-start;
  }

  .options input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.highlight};
    cursor: pointer;
    height: 15px;
    margin: 0;
    width: 15px;
  }

  /* Dim any option whose control is disabled. */
  .options label:has(select:disabled),
  .options label:has(input:disabled) {
    cursor: default;
    opacity: 55%;
  }

  .options select:disabled,
  .options input:disabled {
    cursor: default;
  }

  .options .codec-badge {
    align-items: center;
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.highlight} 22%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 50%,
        transparent
      );
    border-radius: 8px;
    color: ${({ theme }) => theme.colors.text};
    display: inline-flex;
    font-size: 10.5px;
    grid-column: 1 / -1;
    justify-content: center;
    letter-spacing: 0.4px;
    min-height: 26px;
    padding: 3px 8px;
  }

  .webcam-preview {
    align-items: center;
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .webcam-preview canvas {
    background: #000;
    border: 1px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 60%,
        transparent
      );
    border-radius: 8px;
    box-shadow: 0 4px 14px -6px rgb(0 0 0 / 60%);
    height: 120px;
    object-fit: cover;
    width: 160px;
  }

  .webcam-preview .preview-label {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
  }

  /* Action bar — Screenshot (accent) + Record (red). */
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 2px;
  }

  button {
    align-items: center;
    border: 0;
    border-radius: 9px;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    gap: 6px;
    justify-content: center;
    padding: 11px 16px;
    transition: filter 0.15s ease, transform 0.08s ease;
  }

  button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  button:active:not(:disabled) {
    transform: translateY(1px);
  }

  button:disabled {
    cursor: default;
    opacity: 45%;
  }

  .shoot-btn {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${({ theme }) => theme.colors.highlight} 92%, #fff) 0%,
      ${({ theme }) => theme.colors.highlight} 100%
    );
    flex: 1 1 150px;
  }

  .rec-btn {
    background: linear-gradient(180deg, #f0556a 0%, #d6293f 100%);
    flex: 1 1 150px;
  }

  .rec-btn.recording {
    animation: rec-pulse 1.2s ease-in-out infinite;
  }

  .rec-btn.recording.paused {
    animation: none;
    filter: saturate(0.6);
  }

  .pause {
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.text} 14%,
      transparent
    );
    color: ${({ theme }) => theme.colors.text};
    flex: 0 0 auto;
  }

  @keyframes rec-pulse {
    50% {
      opacity: 70%;
    }
  }

  .rec-indicator {
    align-items: center;
    align-self: center;
    background: color-mix(in srgb, #d6293f 16%, transparent);
    border: 1px solid color-mix(in srgb, #d6293f 45%, transparent);
    border-radius: 999px;
    color: #ff8593;
    display: inline-flex;
    font-size: 12px;
    font-weight: 700;
    gap: 7px;
    letter-spacing: 0.6px;
    padding: 5px 14px;
  }

  .rec-indicator .dot {
    animation: rec-pulse 1.2s ease-in-out infinite;
    background: #ff4d62;
    border-radius: 50%;
    box-shadow: 0 0 8px #ff4d62;
    display: inline-block;
    height: 9px;
    width: 9px;
  }

  .rec-indicator .timer {
    color: ${({ theme }) => theme.colors.text};
    font-variant-numeric: tabular-nums;
  }

  .rec-indicator.paused {
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.titleBar.textInactive} 16%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.titleBar.textInactive} 40%,
      transparent
    );
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
  }

  .rec-indicator.paused .dot {
    animation: none;
    background: ${({ theme }) => theme.colors.titleBar.textInactive};
    box-shadow: none;
  }

  .countdown {
    align-items: center;
    align-self: center;
    background: rgb(0 0 0 / 60%);
    border: 2px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 60%,
        transparent
      );
    border-radius: 14px;
    color: #fff;
    display: flex;
    font-size: 60px;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    height: 110px;
    justify-content: center;
    width: 110px;
  }

  .last-capture {
    align-items: center;
    background: color-mix(
      in srgb,
      ${({ theme }) => theme.colors.text} 6%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 35%,
        transparent
      );
    border-radius: 10px;
    display: flex;
    gap: 11px;
    padding: 9px 11px;
    text-align: left;
  }

  .last-capture img {
    border: 1px solid
      color-mix(
        in srgb,
        ${({ theme }) => theme.colors.highlight} 50%,
        transparent
      );
    border-radius: 6px;
    flex-shrink: 0;
    height: 50px;
    object-fit: cover;
    width: 68px;
  }

  .last-capture .meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .last-capture .name {
    font-size: 11.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .last-capture .note {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10.5px;
  }

  .status {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11.5px;
    min-height: 14px;
    text-align: center;
  }

  .status.warn {
    color: #ff8593;
  }
`;

export default StyledScreenCapture;
