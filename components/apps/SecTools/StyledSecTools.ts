import styled from "styled-components";

const StyledSecTools = styled.div`
  background: #150f1b;
  color: #e8e2ee;
  display: grid;
  font-family: ${({ theme }) => theme.formats.systemFont};
  grid-template-columns: 168px 1fr;
  height: 100%;
  overflow: hidden;

  nav {
    background: #100b15;
    border-right: 1px solid #2f2740;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 8px 6px;
  }

  nav .group-label {
    color: #6f6080;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 8px 8px 4px;
    text-transform: uppercase;
  }

  nav button {
    background: transparent;
    border: none;
    border-radius: 5px;
    color: #cfc4dc;
    cursor: pointer;
    font-size: 12.5px;
    padding: 7px 9px;
    text-align: left;
    width: 100%;
  }

  nav button:hover {
    background: #221a2d;
  }

  nav button.active {
    background: #7d4eaf;
    color: #fff;
    font-weight: 600;
  }

  section {
    height: 100%;
    overflow: hidden;
  }
`;

export default StyledSecTools;
