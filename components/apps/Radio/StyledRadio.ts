import styled from "styled-components";

// Radio — internet-radio player for the SecurityOS desktop. Dark, theme-token
// driven (no hardcoded brand colors): surfaces read from theme.colors.*, type
// from theme.formats.systemFont. Layout: a filter bar, a scrolling results list,
// and a fixed now-playing bar pinned to the bottom.
const StyledRadio = styled.div`
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  font-size: 13px;
  height: 100%;
  overflow: hidden;
  width: 100%;

  @keyframes radio-pulse {
    0%,
    100% {
      opacity: 100%;
    }

    50% {
      opacity: 30%;
    }
  }

  input,
  select {
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: 13px;
    outline: none;
    padding: 7px 8px;
  }

  input:focus,
  select:focus {
    border-color: ${({ theme }) => theme.colors.highlight};
  }

  select option {
    background: ${({ theme }) => theme.colors.window.background};
    color: ${({ theme }) => theme.colors.text};
  }

  /* Filter bar: search box + country + genre dropdowns */
  .filters {
    background: ${({ theme }) => theme.colors.window.background};
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
  }

  .filters form {
    display: flex;
    flex: 1 1 220px;
    gap: 6px;
    min-width: 0;
  }

  .filters input.search {
    flex: 1 1 auto;
    min-width: 0;
  }

  .filters select {
    flex: 1 1 130px;
    max-width: 200px;
    min-width: 0;
  }

  .search-btn {
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 4px;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    flex: 0 0 auto;
    font-family: inherit;
    font-size: 13px;
    padding: 6px 14px;
  }

  .search-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.activeForeground};
  }

  .search-btn:disabled {
    cursor: default;
    opacity: 55%;
  }

  /* Tabs: Stations vs Favorites */
  .tabs {
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 auto;
  }

  .tab {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    flex: 1 1 0;
    font-family: inherit;
    font-size: 11px;
    padding: 7px 4px;
  }

  .tab:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .tab.active {
    border-bottom-color: ${({ theme }) => theme.colors.highlight};
    color: ${({ theme }) => theme.colors.highlight};
  }

  /* Results list */
  .list {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .station {
    align-items: center;
    background: transparent;
    border: 0;
    border-bottom: 1px solid
      ${({ theme }) => theme.colors.window.outlineInactive};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    font-family: inherit;
    gap: 9px;
    padding: 8px 10px;
    text-align: left;
    width: 100%;
  }

  .station:hover {
    background: ${({ theme }) => theme.colors.taskbar.hover};
  }

  .station.active {
    background: ${({ theme }) => theme.colors.highlightBackground};
  }

  .station.muted {
    cursor: default;
    opacity: 60%;
  }

  .station .favicon {
    background: ${({ theme }) => theme.colors.window.background};
    border-radius: 4px;
    flex: 0 0 auto;
    height: 28px;
    object-fit: contain;
    width: 28px;
  }

  .station .favicon.placeholder {
    align-items: center;
    display: flex;
    font-size: 15px;
    justify-content: center;
  }

  .station .meta {
    flex: 1 1 auto;
    min-width: 0;
  }

  .station .name {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .station .sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .station .nohttps {
    color: ${({ theme }) => theme.colors.titleBar.closeHover};
  }

  .fav-btn {
    background: transparent;
    border: 0;
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    cursor: pointer;
    flex: 0 0 auto;
    font-size: 15px;
    line-height: 1;
    padding: 4px 6px;
  }

  .fav-btn:hover {
    color: ${({ theme }) => theme.colors.highlight};
  }

  .fav-btn.on {
    color: ${({ theme }) => theme.colors.highlight};
  }

  /* Status rows */
  .empty,
  .status {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 11px;
    padding: 12px 10px;
  }

  .status.busy {
    animation: radio-pulse 1.1s ease-in-out infinite;
  }

  .error {
    background: ${({ theme }) => theme.colors.titleBar.closeHover};
    border-radius: 4px;
    color: rgb(255, 235, 235);
    font-size: 11px;
    margin: 8px 10px;
    overflow-wrap: anywhere;
    padding: 6px 8px;
  }

  /* Now-playing bar */
  .nowplaying {
    align-items: center;
    background: ${({ theme }) => theme.colors.taskbar.background};
    border-top: 1px solid ${({ theme }) => theme.colors.window.outlineInactive};
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
    padding: 8px 10px;
  }

  .play-btn {
    align-items: center;
    background: ${({ theme }) => theme.colors.highlightBackground};
    border: 1px solid ${({ theme }) => theme.colors.highlight};
    border-radius: 50%;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    font-size: 15px;
    height: 36px;
    justify-content: center;
    width: 36px;
  }

  .play-btn:hover {
    background: ${({ theme }) => theme.colors.taskbar.activeForeground};
  }

  .play-btn:disabled {
    cursor: default;
    opacity: 50%;
  }

  .np-meta {
    flex: 1 1 auto;
    min-width: 0;
  }

  .np-name {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .np-sub {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .np-sub.live {
    color: ${({ theme }) => theme.colors.progressBarRgb};
  }

  .volume {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
  }

  .volume input[type="range"] {
    accent-color: ${({ theme }) => theme.colors.highlight};
    cursor: pointer;
    padding: 0;
    width: 84px;
  }

  .volume .vol-icon {
    color: ${({ theme }) => theme.colors.titleBar.textInactive};
    font-size: 14px;
  }
`;

export default StyledRadio;
