import StyledButton from "components/system/Dialogs/Transfer/StyledButton";
import styled, { css } from "styled-components";

const gradientAnimation = css`
  animation: gradient 5s ease-in-out alternate infinite;
  background: ${({ theme }) =>
    `linear-gradient(-45deg, ${theme.colors.progressBackground}, ${theme.colors.progressBarRgb}, ${theme.colors.progressBackground})`};
  background-size: 300% 300%;
  content: "";
  inset: 0;
  position: absolute;
`;

const StyledTransfer = styled.div`
  color: ${({ theme }) => theme.colors.text};

  h1,
  div {
    align-items: baseline;
    display: flex;
    flex-direction: column;
    height: calc(100% - 40px - 41px - 2px);
    justify-content: space-around;
    padding: 0 22px;

    progress {
      border: 1px solid ${({ theme }) => theme.colors.accent.edge};
      height: 15px;
      overflow: hidden;
      position: relative;
      width: 100%;

      &::-webkit-progress-bar {
        background: ${({ theme }) => theme.colors.progressBackground};
      }

      &::-webkit-progress-value {
        background: ${({ theme }) => theme.colors.progressBarRgb};
      }

      &::-moz-progress-bar {
        background: ${({ theme }) => theme.colors.progressBarRgb};
      }

      &:indeterminate {
        /* stylelint-disable-next-line block-no-empty */
        &::-moz-progress-bar {
          ${gradientAnimation}
        }

        /* stylelint-disable-next-line block-no-empty */
        &::after {
          ${gradientAnimation}
        }
      }

      @keyframes gradient {
        0% {
          background-position: 0% 50%;
        }

        50% {
          background-position: 100% 50%;
        }

        100% {
          background-position: 0% 50%;
        }
      }
    }
  }

  div {
    margin-top: -3px;
  }

  h1 {
    background: ${({ theme }) =>
      `linear-gradient(to right, ${theme.colors.titleBar.background}, ${theme.colors.highlight})`};
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    font-size: 15px;
    font-weight: 400;
    height: 40px;
    place-items: flex-start;
    white-space: nowrap;
    width: 100%;
  }

  h2 {
    font-size: 12px;
    font-weight: 400;
  }

  nav {
    background-color: ${({ theme }) =>
      theme.colors.titleBar.backgroundInactive};
    border-top: 1px solid ${({ theme }) => theme.colors.accent.edge};
    bottom: 0;
    box-sizing: content-box;
    display: flex;
    height: 41px;
    padding-bottom: 1px;
    place-items: center;
    position: absolute;
    width: 100%;

    ${StyledButton} {
      padding-bottom: 1px;
      position: absolute;
      right: 23px;
    }
  }
`;

export default StyledTransfer;
