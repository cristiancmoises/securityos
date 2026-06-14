import styled from "styled-components";

type StyledBrowserProps = {
  $hasSrcDoc: boolean;
};

const StyledBrowser = styled.div<StyledBrowserProps>`
  iframe {
    background-color: ${({ $hasSrcDoc }) => ($hasSrcDoc ? "#fff" : "initial")};
    border: 0;
    height: calc(100% - 30px - 36px - 33px);
    width: 100%;
  }

  nav.tabstrip {
    align-items: center;
    background-color: rgb(0, 0, 1);
    display: flex;
    gap: 3px;
    height: 30px;
    overflow-x: auto;
    padding: 0 6px;
    white-space: nowrap;

    .tab {
      align-items: center;
      background-color: rgb(40, 38, 41);
      border-radius: 7px 7px 0 0;
      color: rgb(205, 205, 205);
      display: inline-flex;
      flex: 0 1 180px;
      height: 24px;
      max-width: 180px;
      min-width: 64px;
      overflow: hidden;
    }
    .tab.active {
      background-color: rgb(64, 62, 65);
      color: rgb(255, 255, 255);
    }
    .tab .tab-select {
      color: inherit;
      flex: 1;
      font-size: 11px;
      overflow: hidden;
      padding: 0 4px 0 9px;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tab .tab-close {
      border-radius: 50%;
      color: inherit;
      flex: 0 0 auto;
      font-size: 15px;
      height: 18px;
      line-height: 1;
      margin-right: 4px;
      width: 18px;
    }
    .tab .tab-close:hover {
      background-color: rgb(90, 88, 92);
    }
    .tab-new {
      border-radius: 5px;
      color: rgb(225, 225, 225);
      flex: 0 0 auto;
      font-size: 18px;
      height: 22px;
      line-height: 1;
      width: 26px;
    }
    .tab-new:hover {
      background-color: rgb(45, 45, 48);
    }
  }

  nav.controls {
    background-color: rgb(0, 0, 1);
    display: flex;
    padding: 4px 0;
    place-content: center;
    place-items: center;
    div {
      display: flex;
      justify-content: space-around;
      min-width: 102px;
      padding-left: 6px;
      width: 102px;
    }
    button {
      border-radius: 50%;
      display: flex;
      height: 28px;
      place-content: center;
      place-items: center;
      transition: background 0.2s ease-in-out;
      width: 28px;
      svg {
        fill: rgb(240, 240, 240);
        height: 22px;
        width: 22px;
      }
      &:hover {
        background-color: rgb(0, 0, 1);
      }
      &:active {
        background-color: rgb(110, 110, 110);
      }
      &:disabled {
        background-color: inherit;
        svg {
          fill: rgb(0, 0, 1);
        }
      }
    }
    input {
      background-color: rgb(64, 62, 65);
      border-radius: 18px;
      color: rgb(255, 255, 255);
      font-family: ${({ theme }) => theme.formats.systemFont};
      font-size: 13px;
      height: 28px;
      letter-spacing: 0.2px;
      line-height: 26px;
      margin: 0 6px;
      padding: 0 13px;
      width: 100%;
      &:focus {
        outline: 2px solid rgb(138, 180, 248);
      }
    }
  }

  nav.bookmarks {
    background-color: rgb(0, 0, 1);
    border-bottom: 1px solid rgb(118, 115, 118);
    display: flex;
    gap: 4px;
    height: 33px;
    justify-content: flex-start;
    overflow-x: auto;
    padding: 4px 8px;
    white-space: nowrap;
    button {
      border-radius: 5px;
      color: rgb(225, 225, 225);
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 600;
      height: 22px;
      padding: 0 9px;
      width: auto;
    }
    button:hover {
      background-color: rgb(45, 45, 48);
    }
  }
`;

export default StyledBrowser;
