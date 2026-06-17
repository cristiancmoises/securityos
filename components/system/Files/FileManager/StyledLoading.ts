import styled from "styled-components";

const StyledLoading = styled.div`
  cursor: wait;
  height: 100%;
  width: 100%;

  &::before {
    color: ${({ theme }) => theme.colors.text};
    content: "Loading at the speed of light...";
    display: flex;
    font-size: 12px;
    justify-content: center;
    mix-blend-mode: difference;
    padding-top: 18px;
  }
`;

export default StyledLoading;
