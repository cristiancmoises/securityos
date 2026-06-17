import styled from "styled-components";
import ScrollBars from "styles/common/ScrollBars";
import { DEFAULT_SCROLLBAR_WIDTH } from "utils/constants";

const StyledPDF = styled.div`
  ${ScrollBars(DEFAULT_SCROLLBAR_WIDTH)};

  display: block;
  overflow: auto;
  position: relative;
  text-align: center;
  top: 40px;

  && {
    height: ${({ theme }) =>
      `calc(100% - ${theme.sizes.titleBar.height}px - 40px)`};
  }

  canvas {
    box-shadow: 0 0 8px hsla(222, 60%, 3%, 60%),
      0 0 12px hsla(190, 100%, 55%, 18%);
    margin: 4px 4px 0;
  }
`;

export default StyledPDF;
