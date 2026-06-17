import styled from "styled-components";

const StyledComponentError = styled.div`
  background-color: ${({ theme }) => theme.colors.window.background};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  font-size: 20px;
  height: 100%;
  place-content: center;
  place-items: center;
  width: 100%;
`;

const ERROR_MESSAGE = "Error occured within component.";

const ComponentError: FC = () => (
  <StyledComponentError>{ERROR_MESSAGE}</StyledComponentError>
);

export default ComponentError;
