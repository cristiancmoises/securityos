/*
 * Security Ops — Privacy-focused browser extension
 * Copyright (C) 2024-2026 Cristian Cezar Moises <ethicalhacker@riseup.net>
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// stable-content.js — Security Ops v10.1.0 — Site dark theme + font color
//
// v8.0 changes:
//   - Bug 6: deactivateTheme now WALKS DOM and removes inline styles we set,
//     using a WeakSet to track which elements we modified. Body styles
//     also cleaned up.
//   - Bug 3: New 4th channel — fetch settings from background directly via
//     sendMessage. Background has authoritative state in memory (no
//     storage round-trip). Polling tightened to 1s.
//   - Bug 3: readSettings uses Firefox-aware Promise-only path.
//   - YouTube Focus Mode (v8): toggle html.secops-yt-focus class.

(() => {
  'use strict';
  const browser = self.browser || self.chrome;
  const IS_FIREFOX = (typeof navigator !== 'undefined') &&
                     navigator.userAgent.includes('Firefox');

  // ============================================================
  // Color palette
  // ============================================================
  const COLOR_BY_NAME = Object.freeze({
    cyan:    '#4dd0e1',
    teal:    '#2dd4bf',
    blue:    '#60a5fa',
    purple:  '#c084fc',
    green:   '#6ee7b7',
    amber:   '#fcd34d',
    'soft-green':  '#90EE90',
    'soft-blue':   '#87CEEB',
    'soft-yellow': '#F0E68C',
    'soft-purple': '#DDA0DD',
    'soft-violet': '#EE82EE',
    'white':       '#FFFFFF'
  });
  const VALID_COLOR_NAMES = new Set(Object.keys(COLOR_BY_NAME));
  const colorOf = (name) => COLOR_BY_NAME[name] || COLOR_BY_NAME.cyan;

  // ============================================================
  // State
  // ============================================================
  const APPLIED_CLASS = 'secops-dark';
  const FOCUS_CLASS   = 'secops-yt-focus';
  const isYouTube = /(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname);

  let active = false;
  let focusActive = false;
  let currentColorName = 'cyan';
  let currentColorHex = COLOR_BY_NAME.cyan;
  let observer = null;
  let pollTimer = null;

  // Bug 6 fix: track which elements we've modified so we can undo on
  // deactivate. WeakSet — automatically cleaned up when nodes are
  // garbage collected.
  const modifiedElements = new WeakSet();

  const SKIP_TAGS = new Set([
    'VIDEO','IMG','PICTURE','SVG','CANVAS','IFRAME','OBJECT','EMBED',
    'SCRIPT','STYLE','LINK','NOSCRIPT','META','HEAD','HTML','TITLE'
  ]);

  // YT skip — don't fight the player UI
  const YT_SKIP_CLASSES = new Set([
    'ytp-player-content','video-stream','ytp-pause-overlay',
    'ytp-cued-thumbnail-overlay','ytp-spinner','ytp-chapter-container',
    'html5-video-container','html5-video-player','html5-main-video',
    'ytp-progress-bar-container','ytp-tooltip','ytp-popup','ytp-button',
    'ytp-suggestions','ytp-ce-element','ytp-iv-player-content',
    'iv-promo','ytp-title-text','ytp-chrome-bottom','ytp-chrome-top',
    'thumbnail','ytd-thumbnail','ytd-player'
  ]);

  function shouldSkipElement(el) {
    if (!el || !el.tagName) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    // Skip custom elements with hyphens that aren't ours
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('yt-') || tag.startsWith('ytd-') ||
        tag.startsWith('tp-yt-') || tag.startsWith('ytmusic-') ||
        tag.startsWith('paper-') || tag.startsWith('iron-')) {
      return true;
    }
    if (isYouTube) {
      const cls = el.classList;
      if (cls && typeof cls.contains === 'function') {
        for (const c of YT_SKIP_CLASSES) {
          if (cls.contains(c)) return true;
        }
      }
    }
    return false;
  }

  // Cross-realm-safe querySelectorAll (Firefox isolated world fix from v5)
  function safeQSA(node, selector) {
    if (!node) return [];
    try {
      if (typeof node.querySelectorAll === 'function') {
        return node.querySelectorAll(selector);
      }
    } catch (e) {}
    return [];
  }

  // ============================================================
  // Color application
  // ============================================================
  function setColorVariable(colorHex) {
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--secops-fc', colorHex, 'important');
      }
    } catch (e) {}
  }

  function applyInlineColor(el, colorHex) {
    if (shouldSkipElement(el)) return;
    if (!el.style) return;
    try {
      el.style.setProperty('color', colorHex, 'important');
      el.style.setProperty('-webkit-text-fill-color', colorHex, 'important');
      modifiedElements.add(el);
    } catch (e) {}
  }

  function removeInlineColor(el) {
    if (!el || !el.style) return;
    try {
      el.style.removeProperty('color');
      el.style.removeProperty('-webkit-text-fill-color');
      el.style.removeProperty('background-color');
    } catch (e) {}
  }

  function walkAndApplyInline(colorHex) {
    if (!document.body) return;
    applyInlineColor(document.body, colorHex);
    const all = safeQSA(document.body, '*');
    for (let i = 0; i < all.length; i++) {
      applyInlineColor(all[i], colorHex);
    }
  }

  function walkAndRemoveInline() {
    if (!document.body) return;
    removeInlineColor(document.body);
    if (document.documentElement) removeInlineColor(document.documentElement);
    const all = safeQSA(document.body, '*');
    for (let i = 0; i < all.length; i++) {
      removeInlineColor(all[i]);
    }
  }

  // ============================================================
  // Activate / Deactivate
  // ============================================================
  function activateTheme(colorName) {
    active = true;
    currentColorName = colorName;
    currentColorHex = colorOf(colorName);

    setColorVariable(currentColorHex);

    try {
      if (document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.add(APPLIED_CLASS);
      }
    } catch (e) {}

    if (document.body) {
      walkAndApplyInline(currentColorHex);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        walkAndApplyInline(currentColorHex);
      }, { once: true });
    }

    startObserver();
  }

  // Bug 6 FIX: properly clean up on deactivate
  function deactivateTheme() {
    active = false;

    // Stop MutationObserver FIRST so it doesn't keep adding styles
    if (observer) {
      try { observer.disconnect(); } catch (e) {}
      observer = null;
    }

    // Remove the class hook (CSS rules stop applying)
    try {
      if (document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.remove(APPLIED_CLASS);
        document.documentElement.style.removeProperty('--secops-fc');
        document.documentElement.style.removeProperty('background-color');
        document.documentElement.style.removeProperty('color');
      }
    } catch (e) {}

    // Walk DOM and remove the inline styles we applied
    walkAndRemoveInline();
  }

  function changeColor(newColorName) {
    if (!VALID_COLOR_NAMES.has(newColorName)) return;
    if (newColorName === currentColorName) return;
    currentColorName = newColorName;
    currentColorHex = colorOf(newColorName);

    setColorVariable(currentColorHex);

    if (active && document.body) {
      walkAndApplyInline(currentColorHex);
    }
  }

  // ============================================================
  // YouTube Focus Mode (v8 NEW)
  // ============================================================
  function setFocusMode(on) {
    if (!isYouTube) return;
    focusActive = !!on;
    try {
      if (document.documentElement && document.documentElement.classList) {
        if (on) document.documentElement.classList.add(FOCUS_CLASS);
        else document.documentElement.classList.remove(FOCUS_CLASS);
      }
    } catch (e) {}
  }

  // ============================================================
  // MutationObserver
  // ============================================================
  function startObserver() {
    if (observer || !document.body) return;
    try {
      observer = new MutationObserver((mutations) => {
        if (!active) return;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            applyInlineColor(node, currentColorHex);
            const desc = safeQSA(node, '*');
            for (let i = 0; i < desc.length; i++) {
              applyInlineColor(desc[i], currentColorHex);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  // ============================================================
  // Settings reading — Firefox-aware (v8 Bug 3 fix)
  // ============================================================
  function readSettings() {
    return new Promise((resolve) => {
      try {
        if (IS_FIREFOX) {
          // Firefox: Promise-only path. Don't pass callback.
          const p = browser.storage.sync.get(['settings']);
          if (p && typeof p.then === 'function') {
            p.then((data) => resolve(data || {}))
             .catch(() => resolve({}));
          } else {
            resolve({});
          }
        } else {
          // Chrome: callback path
          browser.storage.sync.get(['settings'], (data) => {
            resolve(data || {});
          });
        }
      } catch (e) {
        resolve({});
      }
    });
  }

  // 4th channel: ask background directly for current settings
  function fetchSettingsFromBackground() {
    return new Promise((resolve) => {
      try {
        const msg = { action: 'getStats' };
        if (IS_FIREFOX) {
          const p = browser.runtime.sendMessage(msg);
          if (p && typeof p.then === 'function') {
            p.then((res) => {
              if (res && res.settings) resolve(res.settings);
              else resolve(null);
            }).catch(() => resolve(null));
          } else {
            resolve(null);
          }
        } else {
          browser.runtime.sendMessage(msg, (res) => {
            if (browser.runtime.lastError) { resolve(null); return; }
            if (res && res.settings) resolve(res.settings);
            else resolve(null);
          });
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  function applyFromSettings(s) {
    if (!s || typeof s !== 'object') return;
    const enabled = s.blackThemeEnabled !== false;
    const colorName = (typeof s.fontColor === 'string' && VALID_COLOR_NAMES.has(s.fontColor))
      ? s.fontColor : 'cyan';
    const focusOn = s.youtubeFocusMode === true;

    if (enabled) {
      if (!active) {
        activateTheme(colorName);
      } else {
        changeColor(colorName);
      }
    } else if (active) {
      deactivateTheme();
    }

    // Focus mode (independent of dark theme)
    if (isYouTube) setFocusMode(focusOn);

    console.log('[SecOps] applied: enabled=' + enabled + ' color=' + colorName + ' focus=' + focusOn);
  }

  // ============================================================
  // Channel 1: Direct push from background via runtime.onMessage
  // ============================================================
  try {
    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return false;
      if (msg.action !== 'updateTheme' && msg.action !== 'reapplyTheme') return false;

      if (msg.settings && typeof msg.settings === 'object') {
        applyFromSettings(msg.settings);
      } else {
        readSettings().then((data) => {
          const s = (data && data.settings) || {};
          applyFromSettings(s);
        });
      }

      try { if (sendResponse) sendResponse({ ok: true }); } catch (e) {}
      return false;
    });
  } catch (e) {}

  // ============================================================
  // Channel 2: storage.onChanged
  // ============================================================
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes.settings) return;
      const newVal = changes.settings.newValue;
      if (newVal && typeof newVal === 'object') {
        applyFromSettings(newVal);
      }
    });
  } catch (e) {}

  // ============================================================
  // Channel 3: Polling fallback (1s — was 2s in v7)
  // ============================================================
  let lastPollState = '';
  function pollOnce() {
    readSettings().then((data) => {
      const s = (data && data.settings) || {};
      const enabled = s.blackThemeEnabled !== false;
      const colorName = (typeof s.fontColor === 'string' && VALID_COLOR_NAMES.has(s.fontColor))
        ? s.fontColor : 'cyan';
      const focusOn = s.youtubeFocusMode === true;
      const stateKey = enabled + '|' + colorName + '|' + focusOn;
      if (stateKey !== lastPollState) {
        lastPollState = stateKey;
        applyFromSettings(s);
      }
    });
  }
  pollTimer = setInterval(pollOnce, 1000);

  // ============================================================
  // Initial activation — try background first, fall back to storage
  // ============================================================
  function init() {
    fetchSettingsFromBackground().then((s) => {
      if (s) {
        applyFromSettings(s);
        const enabled = s.blackThemeEnabled !== false;
        const colorName = (typeof s.fontColor === 'string' && VALID_COLOR_NAMES.has(s.fontColor)) ? s.fontColor : 'cyan';
        const focusOn = s.youtubeFocusMode === true;
        lastPollState = enabled + '|' + colorName + '|' + focusOn;
      } else {
        readSettings().then((data) => {
          const s2 = (data && data.settings) || {};
          applyFromSettings(s2);
          const enabled = s2.blackThemeEnabled !== false;
          const colorName = (typeof s2.fontColor === 'string' && VALID_COLOR_NAMES.has(s2.fontColor)) ? s2.fontColor : 'cyan';
          const focusOn = s2.youtubeFocusMode === true;
          lastPollState = enabled + '|' + colorName + '|' + focusOn;
        });
      }
    });
  }

  init();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (active && document.body) {
        walkAndApplyInline(currentColorHex);
        startObserver();
      }
    });
  }

  console.log('[SecOps] content v10.1.0 active on ' + location.hostname + ' (FF=' + IS_FIREFOX + ')');
})();
