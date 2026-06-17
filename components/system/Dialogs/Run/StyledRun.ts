import StyledButton from "components/system/Dialogs/Transfer/StyledButton";
import styled from "styled-components";

const StyledRun = styled.div`
  background-color: ${({ theme }) => theme.colors.titleBar.background};
  border: 1px solid ${({ theme }) => theme.colors.accent.edge};
  color: ${({ theme }) => theme.colors.text};
  font-size: 12px;

  figure {
    display: flex;
    flex-direction: row;
    padding: 20px 11px 14px;

    figcaption {
      line-height: 15px;
      margin-bottom: 4px;
    }

    img {
      height: 32px;
      margin-right: 19px;
      width: 32px;
    }
  }

  div {
    display: flex;
    flex-direction: row;

    label {
      margin-top: 3px;
      padding: 0 11px;
    }

    div {
      position: relative;
      width: 100%;

      input,
      select {
        border: 1px solid ${({ theme }) => theme.colors.accent.edge};
        border-radius: 0;
        color: ${({ theme }) => theme.colors.text};
        font-family: ${({ theme }) => theme.formats.systemFont};
        font-size: 12px;
        height: 23px;
        line-height: 16px;
        margin: 0 13px 21px 8px;
        padding-bottom: 2px;
        padding-left: 5px;
        width: 100%;
      }

      select {
        background-color: ${({ theme }) =>
          theme.colors.titleBar.backgroundInactive};
        clip-path: inset(0 0 0 calc(100% - 20px));
        position: absolute;
        width: calc(100% - 21px);

        &:disabled {
          border: 1px solid ${({ theme }) => theme.colors.accent.edge};
          opacity: 100%;
        }
      }

      input {
        border-right: 0;
        margin-right: 33px;

        &:focus {
          border: 1px solid ${({ theme }) => theme.colors.highlight};
          border-color: ${({ theme }) => theme.colors.highlight};
          border-right: 0;
          box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.highlight};

          + select {
            border-color: ${({ theme }) => theme.colors.highlight};
          }
        }
      }
    }
  }

  nav {
    background-color: ${({ theme }) =>
      theme.colors.titleBar.backgroundInactive};
    display: flex;
    flex-direction: row;
    height: 100%;

    ${StyledButton} {
      height: 24px;
      margin-top: 19px;
      position: absolute;
      right: 12px;
      width: 86px;

      &:first-child {
        right: 107px;
      }
    }
  }
`;

export default StyledRun;
