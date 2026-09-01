import styled from "styled-components";

const StyledUndercover = styled.div`
  --accent: #087b94;
  --accent-dark: #075d73;
  --border: rgba(25, 43, 62, 14%);
  --muted: #607083;
  --surface: rgba(250, 252, 254, 94%);
  --text: #172333;

  align-items: center;
  background: radial-gradient(
      circle at 14% 8%,
      rgba(59, 186, 205, 18%),
      transparent 34%
    ),
    radial-gradient(circle at 90% 92%, rgba(79, 116, 201, 13%), transparent 38%),
    linear-gradient(145deg, #e9eff4, #dfe8ef);
  color: var(--text);
  display: flex;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue",
    Arial, sans-serif;
  height: 100%;
  justify-content: center;
  overflow: auto;
  padding: 14px;

  .profile-panel {
    backdrop-filter: blur(20px) saturate(125%);
    background: var(--surface);
    border: 1px solid rgba(255, 255, 255, 78%);
    border-radius: 12px;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 85%) inset,
      0 18px 45px rgba(42, 58, 76, 16%), 0 0 0 1px rgba(25, 43, 62, 8%);
    max-width: 430px;
    overflow: hidden;
    width: 100%;
  }

  .profile-header {
    align-items: center;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    min-height: 54px;
    padding: 9px 14px;
  }

  .brand {
    align-items: center;
    display: flex;
    gap: 10px;
    min-width: 0;
  }

  .brand-mark {
    align-items: center;
    background: linear-gradient(145deg, #0a8ca4, #075c78);
    border: 1px solid rgba(255, 255, 255, 55%);
    border-radius: 9px;
    box-shadow: 0 5px 14px rgba(7, 93, 115, 24%),
      0 1px 0 rgba(255, 255, 255, 35%) inset;
    color: white;
    display: flex;
    flex: 0 0 36px;
    font-size: 17px;
    font-weight: 720;
    height: 36px;
    justify-content: center;
    letter-spacing: -1px;
    position: relative;
    width: 36px;

    &::after {
      border: 1px solid rgba(255, 255, 255, 42%);
      border-radius: 50%;
      content: "";
      height: 23px;
      position: absolute;
      width: 23px;
    }
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .brand-name {
    font-size: 13px;
    font-weight: 680;
    letter-spacing: -0.1px;
  }

  .brand-caption {
    color: var(--muted);
    font-size: 10px;
    margin-top: 1px;
  }

  .status-pill {
    align-items: center;
    background: rgba(91, 105, 121, 9%);
    border: 1px solid rgba(91, 105, 121, 17%);
    border-radius: 999px;
    color: #556476;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 650;
    gap: 6px;
    padding: 5px 8px;

    &::before {
      background: #718095;
      border-radius: 50%;
      content: "";
      height: 6px;
      width: 6px;
    }

    &.active {
      background: rgba(5, 135, 103, 10%);
      border-color: rgba(5, 135, 103, 18%);
      color: #066a55;

      &::before {
        background: #08a47d;
        box-shadow: 0 0 0 3px rgba(8, 164, 125, 12%);
      }
    }
  }

  .profile-body {
    padding: 14px;
  }

  .hero {
    align-items: center;
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(0, 1fr) 118px;
  }

  .eyebrow {
    color: var(--accent-dark);
    font-size: 9px;
    font-weight: 760;
    letter-spacing: 0.12em;
    margin: 0 0 4px;
    text-transform: uppercase;
  }

  h1 {
    font-size: 20px;
    font-weight: 690;
    letter-spacing: -0.45px;
    line-height: 1.16;
    margin: 0;
  }

  .summary {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.45;
    margin: 6px 0 0;
    max-width: 255px;
  }

  .workspace-preview {
    background: linear-gradient(145deg, #d4edf2, #c7d9e7 58%, #bdcde0);
    border: 1px solid rgba(37, 68, 92, 16%);
    border-radius: 9px;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 80%) inset,
      0 8px 18px rgba(42, 58, 76, 12%);
    height: 78px;
    overflow: hidden;
    position: relative;
  }

  .preview-window {
    background: rgba(250, 252, 254, 88%);
    border: 1px solid rgba(36, 58, 78, 14%);
    border-radius: 6px;
    box-shadow: 0 5px 12px rgba(39, 55, 72, 14%);
    height: 47px;
    left: 18px;
    position: absolute;
    top: 9px;
    width: 83px;

    &::before {
      background: rgba(19, 111, 136, 12%);
      border-right: 1px solid rgba(36, 58, 78, 9%);
      content: "";
      height: 100%;
      left: 0;
      position: absolute;
      top: 0;
      width: 21px;
    }

    &::after {
      background: linear-gradient(#8b9aaa, #8b9aaa) 30px 13px / 34px 3px
          no-repeat,
        linear-gradient(#b6c1cb, #b6c1cb) 30px 22px / 43px 3px no-repeat,
        linear-gradient(#b6c1cb, #b6c1cb) 30px 31px / 28px 3px no-repeat;
      content: "";
      inset: 0;
      position: absolute;
    }
  }

  .preview-dock {
    align-items: center;
    background: rgba(250, 252, 254, 82%);
    border: 1px solid rgba(36, 58, 78, 12%);
    border-radius: 4px 4px 0 0;
    bottom: 0;
    display: flex;
    gap: 4px;
    height: 14px;
    justify-content: center;
    left: 20px;
    position: absolute;
    width: 78px;

    span {
      background: #668294;
      border-radius: 2px;
      height: 5px;
      opacity: 72%;
      width: 5px;

      &:first-child {
        background: var(--accent);
      }
    }
  }

  .facts {
    display: grid;
    gap: 7px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 13px;
  }

  .fact {
    align-items: center;
    background: rgba(234, 240, 245, 72%);
    border: 1px solid rgba(36, 58, 78, 10%);
    border-radius: 8px;
    display: flex;
    gap: 7px;
    min-width: 0;
    padding: 8px;
  }

  .fact-icon {
    border: 1.5px solid var(--accent);
    border-radius: 4px;
    box-sizing: border-box;
    flex: 0 0 19px;
    height: 16px;
    opacity: 88%;
    position: relative;
    width: 19px;

    &::after {
      background: var(--accent);
      border-radius: 999px;
      content: "";
      height: 2px;
      left: 3px;
      opacity: 70%;
      position: absolute;
      top: 4px;
      width: 10px;
    }

    &.session {
      border-radius: 50%;

      &::after {
        background: transparent;
        border: 1.5px solid var(--accent);
        border-left-color: transparent;
        height: 7px;
        left: 4px;
        top: 3px;
        transform: rotate(-25deg);
        width: 7px;
      }
    }

    &.route {
      border-left-color: transparent;
      border-radius: 50%;
      transform: rotate(25deg);

      &::after {
        height: 4px;
        left: -1px;
        top: 7px;
        transform: rotate(-45deg);
        width: 4px;
      }
    }
  }

  .fact-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .fact-label {
    color: #314154;
    font-size: 9px;
    font-weight: 650;
    white-space: nowrap;
  }

  .fact-value {
    color: var(--muted);
    font-size: 9px;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-footer {
    align-items: center;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-top: 12px;
    padding-top: 12px;
  }

  .privacy-note {
    color: var(--muted);
    font-size: 9px;
    line-height: 1.35;
    margin: 0;
    max-width: 218px;
  }

  button {
    align-items: center;
    background: linear-gradient(180deg, #0b849e, #076a83);
    border: 1px solid #075f75;
    border-radius: 7px;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 22%) inset,
      0 4px 10px rgba(7, 93, 115, 18%);
    color: white;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    font: 650 11px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    gap: 7px;
    min-height: 34px;
    padding: 0 12px;
    transition: background-color 120ms ease, box-shadow 120ms ease,
      transform 120ms ease;

    &::after {
      border-right: 1.5px solid currentColor;
      border-top: 1.5px solid currentColor;
      content: "";
      height: 5px;
      transform: rotate(45deg);
      width: 5px;
    }

    &:hover {
      background: linear-gradient(180deg, #08758e, #065b70);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 20%) inset,
        0 6px 14px rgba(7, 93, 115, 24%);
      transform: translateY(-1px);
    }

    &:active {
      box-shadow: 0 2px 6px rgba(7, 93, 115, 18%);
      transform: translateY(0);
    }

    &:focus-visible {
      outline: 2px solid #087b94;
      outline-offset: 2px;
    }
  }

  @media (max-width: 390px), (max-height: 320px) {
    padding: 10px;

    .workspace-preview {
      display: none;
    }

    .hero {
      grid-template-columns: 1fr;
    }

    .profile-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .privacy-note {
      max-width: none;
    }

    button {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
`;

export default StyledUndercover;
