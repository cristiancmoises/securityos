import styled from "styled-components";

type StyledBrowserProps = {
  $hasSrcDoc: boolean;
};

const StyledBrowser = styled.div<StyledBrowserProps>`
  background-color: rgb(0, 0, 1);

  iframe {
    background-color: ${({ $hasSrcDoc }) => ($hasSrcDoc ? "#fff" : "initial")};
    border: 0;
    height: calc(100% - 32px - 40px - 33px);
    width: 100%;
  }

  nav.tabstrip {
    align-items: flex-end;
    background-color: rgb(18, 16, 20);
    display: flex;
    gap: 2px;
    height: 32px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px 6px 0;
    scrollbar-width: thin;
    white-space: nowrap;

    .tab {
      align-items: center;
      background-color: rgb(38, 36, 40);
      border-radius: 8px 8px 0 0;
      color: rgb(190, 188, 194);
      display: inline-flex;
      flex: 0 1 190px;
      height: 28px;
      max-width: 190px;
      min-width: 56px;
      overflow: hidden;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .tab:hover {
      background-color: rgb(50, 48, 53);
      color: rgb(235, 233, 238);
    }
    .tab.active {
      background-color: rgb(64, 62, 65);
      box-shadow: inset 0 2px 0 rgb(138, 180, 248);
      color: rgb(255, 255, 255);
    }
    .tab .tab-select {
      color: inherit;
      flex: 1;
      font-size: 12px;
      letter-spacing: 0.1px;
      min-width: 0;
      overflow: hidden;
      padding: 0 4px 0 11px;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tab .tab-close {
      align-items: center;
      border-radius: 50%;
      color: inherit;
      display: inline-flex;
      flex: 0 0 auto;
      font-size: 16px;
      height: 19px;
      justify-content: center;
      line-height: 1;
      margin-right: 5px;
      opacity: 0.65;
      width: 19px;
    }
    .tab .tab-close:hover {
      background-color: rgb(96, 94, 99);
      opacity: 1;
    }
    .tab-new {
      align-items: center;
      border-radius: 6px;
      color: rgb(210, 208, 214);
      display: inline-flex;
      flex: 0 0 auto;
      font-size: 19px;
      height: 26px;
      justify-content: center;
      line-height: 1;
      margin-bottom: 1px;
      width: 28px;
    }
    .tab-new:hover {
      background-color: rgb(50, 48, 53);
      color: #fff;
    }
  }

  nav.controls {
    align-items: center;
    background-color: rgb(0, 0, 1);
    display: flex;
    gap: 2px;
    height: 40px;
    padding: 0 8px;

    .nav-buttons {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      gap: 1px;
    }
    button {
      align-items: center;
      border-radius: 50%;
      color: rgb(240, 240, 240);
      display: flex;
      flex: 0 0 auto;
      height: 30px;
      justify-content: center;
      transition: background 0.15s ease-in-out;
      width: 30px;
      svg {
        fill: rgb(240, 240, 240);
        height: 20px;
        width: 20px;
      }
      &:hover {
        background-color: rgb(40, 40, 44);
      }
      &:active {
        background-color: rgb(80, 80, 86);
      }
      &:disabled {
        cursor: default;
        svg {
          fill: rgb(70, 70, 74);
        }
        &:hover {
          background-color: transparent;
        }
      }
    }
    input {
      background-color: rgb(64, 62, 65);
      border-radius: 18px;
      color: rgb(255, 255, 255);
      flex: 1;
      font-family: ${({ theme }) => theme.formats.systemFont};
      font-size: 13px;
      height: 30px;
      letter-spacing: 0.2px;
      margin: 0 4px 0 8px;
      min-width: 0;
      padding: 0 14px;
      &:focus {
        outline: 2px solid rgb(138, 180, 248);
      }
    }
  }

  nav.bookmarks {
    align-items: center;
    background-color: rgb(0, 0, 1);
    border-bottom: 1px solid rgb(40, 38, 42);
    border-top: 1px solid rgb(40, 38, 42);
    display: flex;
    gap: 4px;
    height: 33px;
    justify-content: flex-start;
    overflow-x: auto;
    padding: 0 8px;
    scrollbar-width: thin;
    white-space: nowrap;
    button {
      border-radius: 5px;
      color: rgb(220, 220, 222);
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 600;
      height: 23px;
      padding: 0 9px;
      width: auto;
    }
    button:hover {
      background-color: rgb(40, 40, 44);
    }
  }
`;

export default StyledBrowser;
