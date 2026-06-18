import styled from "styled-components";

const StyledDevStudio = styled.div`
  background-color: #1e1e1e;
  color: ${({ theme }) => theme.colors.text};
  display: grid;
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 13px;
  grid-template-columns: var(--explorer-width, 200px) 1fr;
  grid-template-rows: 1fr var(--output-height, 160px);
  height: 100%;
  overflow: hidden;
  width: 100%;

  .explorer {
    background-color: #181818;
    border-right: 1px solid #0d0d0d;
    display: flex;
    flex-direction: column;
    grid-column: 1;
    grid-row: 1 / span 2;
    min-width: 0;
    overflow: hidden;
  }

  .explorer-header {
    align-items: center;
    background-color: #141414;
    border-bottom: 1px solid #0d0d0d;
    color: #b8b8b2;
    display: flex;
    font-size: 11px;
    justify-content: space-between;
    letter-spacing: 0.06em;
    padding: 4px 8px;
    text-transform: uppercase;
    user-select: none;

    .actions {
      display: flex;
      gap: 2px;

      button {
        border-radius: 3px;
        color: #b8b8b2;
        font-size: 13px;
        height: 20px;
        line-height: 1;
        width: 22px;

        &:hover {
          background-color: #2a2d2e;
          color: #fff;
        }
      }
    }
  }

  .explorer-root {
    color: #8a8a86;
    font-size: 11px;
    overflow: hidden;
    padding: 3px 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree {
    flex: 1;
    overflow: auto;
    padding-bottom: 8px;

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .node {
      align-items: center;
      cursor: pointer;
      display: flex;
      gap: 4px;
      overflow: hidden;
      padding: 2px 8px;
      text-overflow: ellipsis;
      user-select: none;
      white-space: nowrap;

      &:hover {
        background-color: #2a2d2e;
      }

      &.active {
        background-color: ${({ theme }) => theme.colors.highlightBackground};
      }

      .twist {
        display: inline-block;
        text-align: center;
        width: 12px;
      }

      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .main {
    display: flex;
    flex-direction: column;
    grid-column: 2;
    grid-row: 1;
    min-height: 0;
    min-width: 0;
  }

  .tabs {
    background-color: #252526;
    border-bottom: 1px solid #0d0d0d;
    display: flex;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;

    &::-webkit-scrollbar {
      height: 3px;
    }

    .tab {
      align-items: center;
      background-color: #2d2d2d;
      border-right: 1px solid #0d0d0d;
      color: #969692;
      cursor: pointer;
      display: flex;
      gap: 6px;
      max-width: 200px;
      padding: 5px 8px 5px 12px;
      white-space: nowrap;

      &.active {
        background-color: #1e1e1e;
        color: #fff;
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dot {
        color: #e0e0da;
        font-size: 16px;
        line-height: 8px;
      }

      .close {
        border-radius: 3px;
        color: inherit;
        font-size: 13px;
        height: 16px;
        line-height: 1;
        opacity: 0.7;
        width: 16px;

        &:hover {
          background-color: #4a4a4a;
          color: #fff;
          opacity: 1;
        }
      }
    }
  }

  .editor {
    flex: 1;
    min-height: 0;
    position: relative;
    width: 100%;

    .placeholder {
      align-items: center;
      background-color: #1e1e1e;
      color: #6c676a;
      display: flex;
      flex-direction: column;
      gap: 6px;
      inset: 0;
      justify-content: center;
      position: absolute;
      text-align: center;
      z-index: 1;
    }
  }

  .output {
    background-color: #181818;
    border-top: 1px solid #0d0d0d;
    display: flex;
    flex-direction: column;
    grid-column: 2;
    grid-row: 2;
    min-height: 0;
    overflow: hidden;
  }

  .toolbar {
    align-items: center;
    background-color: #141414;
    border-bottom: 1px solid #0d0d0d;
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    padding: 4px 8px;

    button {
      align-items: center;
      background-color: #2a2d2e;
      border-radius: 3px;
      color: #e0e0da;
      display: inline-flex;
      gap: 5px;
      padding: 3px 9px;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background-color: #37373d;
      }

      &:disabled {
        cursor: default;
        opacity: 0.4;
      }

      &.run {
        background-color: hsla(140, 55%, 32%, 95%);
        color: #fff;

        &:hover:not(:disabled) {
          background-color: hsla(140, 55%, 38%, 95%);
        }
      }

      &.stop {
        background-color: ${({ theme }) => theme.colors.titleBar.closeHover};
        color: #fff;
      }

      &.hint {
        background-color: transparent;
        color: #8a8a86;

        &:hover {
          background-color: #2a2d2e;
          color: #e0e0da;
        }
      }
    }

    .spacer {
      flex: 1;
    }

    .lang {
      color: #8a8a86;
      font-size: 11px;
      white-space: nowrap;
    }
  }

  .console {
    flex: 1;
    font-family: ${({ theme }) => theme.formats.monoFont};
    font-size: 12px;
    line-height: 1.5;
    overflow: auto;
    padding: 4px 8px;
    white-space: pre-wrap;
    word-break: break-word;

    .line {
      &.warn {
        color: #d7ba7d;
      }
      &.error,
      &.fail {
        color: #f48771;
      }
      &.info {
        color: #75beff;
      }
      &.system {
        color: #6c676a;
      }
      &.pass {
        color: ${({ theme }) => theme.colors.progressBarRgb};
      }
      &.result {
        color: #c8c8c2;
      }
    }
  }
`;

export default StyledDevStudio;
