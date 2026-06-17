import styled from "styled-components";

type StyledButtonProps = {
  $active?: boolean;
};

const StyledButton = styled.button<StyledButtonProps>`
  background-color: ${({ theme }) => theme.colors.titleBar.backgroundInactive};
  border: ${({ $active, theme }) =>
    $active
      ? `2px solid ${theme.colors.highlight}`
      : `1px solid ${theme.colors.accent.edge}`};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 12px;
  height: 23px;
  transition: all 0.25s ease;
  width: 73px;

  &:focus {
    border: 2px solid ${({ theme }) => theme.colors.highlight};
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
  }

  &:active {
    background-color: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    transition: none;
  }

  &:disabled {
    background-color: ${({ theme }) =>
      theme.colors.titleBar.backgroundInactive};
    border: 1px solid ${({ theme }) => theme.colors.accent.edge};
  }
`;

export default StyledButton;
