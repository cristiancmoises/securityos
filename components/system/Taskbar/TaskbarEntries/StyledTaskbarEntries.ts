import styled from "styled-components";

const StyledTaskbarEntries = styled.ol`
  column-gap: 1px;
  display: flex;
  height: 100%;

  /* Undercover centers its taskbar icons; every other theme stays left-aligned. */
  justify-content: ${({ theme }) =>
    theme.name === "Undercover" ? "center" : "flex-start"};
  left: ${({ theme }) => theme.sizes.startButton.width};
  margin: 0 3px;
  overflow: hidden;
  position: absolute;
  right: ${({ theme }) =>
    `calc(${theme.sizes.clock.width} + ${theme.sizes.volume.width})`};

  /* Undercover gives each taskbar button a softly rounded hover/active pill. The
     per-entry highlight is a ::before on the child <li> (StyledTaskbarEntry);
     reach into it from here so Undercover rounds the corners. Default (Emacs)
     keeps its square, full-height fill untouched. */
  ${({ theme }) =>
    theme.name === "Undercover"
      ? `
    li::before {
      border-radius: 6px;
    }
  `
      : ""}
`;

export default StyledTaskbarEntries;
