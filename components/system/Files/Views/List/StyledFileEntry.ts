import styled from "styled-components";

const StyledFileEntry = styled.li`
  figure {
    border: 1px solid transparent;
    display: flex;
    height: 36px;
    padding-bottom: 1px;
    place-items: center;

    figcaption {
      color: ${({ theme }) => theme.colors.fileEntry.text};
    }

    picture {
      margin-left: 3px;
      margin-right: 8px;
    }

    svg {
      fill: ${({ theme }) => theme.colors.fileEntry.text};
      height: 8px;
      margin-left: auto;
      margin-right: 8px;
      width: 8px;
    }

    &:active {
      figcaption {
        letter-spacing: -0.15px;
        opacity: 90%;
      }

      picture {
        margin-left: 7px;
      }

      svg {
        margin-right: 12px;
      }
    }

    &:hover {
      background-color: ${({ theme }) => theme.colors.fileEntry.background};
      border: 1px solid ${({ theme }) => theme.colors.fileEntry.border};
    }
  }
`;

export default StyledFileEntry;
