import styled from "styled-components";

type StyledBrowserProps = {
  $hasSrcDoc: boolean;
};

const StyledBrowser = styled.div<StyledBrowserProps>`
  background-color: #000;

  iframe {
    background-color: ${({ $hasSrcDoc }) => ($hasSrcDoc ? "#fff" : "#000")};
    border: 0;
    height: calc(100% - 32px - 40px - 33px);
    width: 100%;
  }

  nav.tabstrip {
    align-items: flex-end;
    background-color: #000;
    display: flex;
    gap: 2px;
    height: 32px;
    overflow: auto hidden;
    padding: 4px 6px 0;
    scrollbar-width: thin;
    white-space: nowrap;

    .tab {
      align-items: center;
      background-color: rgb(10, 10, 10);
      border-radius: 8px 8px 0 0;
      color: rgb(235, 235, 235);
      display: inline-flex;
      flex: 0 1 190px;
      height: 28px;
      max-width: 190px;
      min-width: 56px;
      overflow: hidden;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .tab:hover {
      background-color: rgb(26, 26, 26);
      color: #fff;
    }
    .tab.active {
      background-color: rgb(34, 34, 34);
      box-shadow: inset 0 2px 0 hsla(190, 100%, 62%, 85%);
      color: #fff;
    }
    .tab .tab-select {
      background-color: transparent;
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
      background-color: transparent;
      border-radius: 50%;
      color: inherit;
      display: inline-flex;
      flex: 0 0 auto;
      font-size: 16px;
      height: 19px;
      justify-content: center;
      line-height: 1;
      margin-right: 5px;
      opacity: 65%;
      width: 19px;
    }
    .tab .tab-close:hover {
      background-color: rgb(64, 64, 64);
      opacity: 100%;
    }
    .tab-new {
      align-items: center;
      background-color: transparent;
      border-radius: 6px;
      color: rgb(235, 235, 235);
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
      background-color: rgb(34, 34, 34);
      color: #fff;
    }
  }

  nav.controls {
    align-items: center;
    background-color: #000;
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
        background-color: rgb(28, 28, 28);
      }
      &:active {
        background-color: rgb(48, 48, 48);
      }
      &:disabled {
        cursor: default;
        svg {
          fill: rgb(80, 80, 80);
        }
        &:hover {
          background-color: transparent;
        }
      }
    }
    input {
      background-color: rgb(26, 26, 26);
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
        outline: 2px solid hsla(190, 100%, 62%, 90%);
      }
    }
  }

  nav.bookmarks {
    align-items: center;
    background-color: #000;
    border-bottom: 1px solid rgb(26, 26, 26);
    border-top: 1px solid rgb(26, 26, 26);
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
      color: rgb(235, 235, 235);
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 600;
      height: 23px;
      padding: 0 9px;
      width: auto;
    }
    button:hover {
      background-color: rgb(28, 28, 28);
    }
    .bm-star {
      color: rgb(150, 150, 150);
      font-size: 14px;
      padding: 0 7px;
    }
    .bm-star.on {
      color: rgb(185, 139, 224);
    }
    .bm-star:disabled {
      opacity: 40%;
    }
    .bm-sep {
      align-self: center;
      background-color: rgb(40, 40, 40);
      flex: 0 0 auto;
      height: 16px;
      margin: 0 2px;
      width: 1px;
    }
    /* A saved user bookmark: name chip + a hover-revealed remove ×. */
    .bm-user {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
    }
    .bm-user .bm-go {
      max-width: 140px;
      overflow: hidden;
      padding-right: 5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bm-user .bm-remove {
      color: rgb(150, 150, 150);
      font-size: 14px;
      opacity: 0%;
      padding: 0 6px 0 2px;
    }
    .bm-user:hover .bm-remove {
      opacity: 100%;
    }
    .bm-user .bm-remove:hover {
      color: rgb(235, 120, 120);
    }
  }
`;

export default StyledBrowser;
