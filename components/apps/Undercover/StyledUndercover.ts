import styled from "styled-components";

const StyledUndercover = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.window.background};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  gap: 14px;
  height: 100%;
  justify-content: center;
  padding: 24px 28px;
  text-align: center;

  .logo {
    height: 64px;
    width: 64px;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
  }

  .status {
    color: ${({ theme }) => theme.colors.highlight};
    font-size: 13px;
  }

  .hint {
    font-size: 12px;
    line-height: 1.5;
    max-width: 360px;
    opacity: 80%;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  button {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 16px;

    &:hover {
      background-color: ${({ theme }) => theme.colors.highlight};
      color: ${({ theme }) => theme.colors.window.background};
    }
  }
`;

export default StyledUndercover;
