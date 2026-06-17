import styled from "styled-components";

const StyledTaskbarEntries = styled.ol`
  column-gap: 1px;
  display: flex;
  height: 100%;

  /* Windows 11 centers its taskbar icons — Undercover does too; everything else
     stays left-aligned. */
  justify-content: ${({ theme }) =>
    theme.name === "Undercover" ? "center" : "flex-start"};
  left: ${({ theme }) => theme.sizes.startButton.width};
  margin: 0 3px;
  overflow: hidden;
  position: absolute;
  right: ${({ theme }) => theme.sizes.clock.width};

  /* Win11 gives each taskbar button a softly rounded hover/active pill. The
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
