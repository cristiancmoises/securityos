/*
 * Security Ops — YouTube DOM/Ad-Skip + Theme (v7.0.0)
 * Copyright (C) 2024-2026 Cristian Cezar Moises <ethicalhacker@riseup.net>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This script runs in the ISOLATED world. The page-world script
 * (youtube-adblock-page.js, world:MAIN) handles the JSON.parse/fetch/XHR
 * patching. This script handles:
 *   - YouTube native dark mode (dark="" attribute + cookie)
 *   - Skip-button click + fast-forward through unskippable ads
 *   - DOM-level ad container removal
 *   - Apply Security Ops --secops-fc font color CSS variable
 */

(() => {
  'use strict';
  const browser = self.browser || self.chrome;

  const COLOR_BY_NAME = {
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
  };

  // ============================================================
  // (1) YouTube native dark mode
  // ============================================================
  function enableYouTubeDark() {
    try {
      document.documentElement.setAttribute('dark', '');
      try {
        document.cookie = 'PREF=f6=400; path=/; domain=.youtube.com; max-age=' + (60*60*24*365);
      } catch (e) {}
    } catch (e) {}
  }
  function disableYouTubeDark() {
    try { document.documentElement.removeAttribute('dark'); } catch (e) {}
  }

  // ============================================================
  // (2) SecOps font color
  // ============================================================
  function applySecOpsColor(colorName) {
    const color = COLOR_BY_NAME[colorName] || COLOR_BY_NAME.cyan;
    try {
      document.documentElement.style.setProperty('--secops-fc', color, 'important');
    } catch (e) {}
  }

  // ============================================================
  // (3) Ad-skip handler — runs at 100ms interval + on video events
  // ============================================================
  let lastSkipAt = 0;
  function handleAd() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return;
    const adShowing = player.classList.contains('ad-showing') ||
                      player.classList.contains('ad-interrupting');
    if (!adShowing) return;

    const now = performance.now();
    if (now - lastSkipAt < 80) return;
    lastSkipAt = now;

    // Click skip button if visible
    const skipBtn = player.querySelector(
      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, ' +
      '.ytp-skip-ad-button, .ytp-ad-skip-button-container button, ' +
      '.ytp-ad-skip-button-text'
    );
    if (skipBtn) {
      try { skipBtn.click(); } catch (e) {}
      return;
    }

    // Fast-forward through unskippable ad
    const video = player.querySelector('video.html5-main-video') ||
                  player.querySelector('video');
    if (video && isFinite(video.duration) && video.duration > 0) {
      try {
        video.muted = true;
        video.playbackRate = 16;
        if (video.duration > 0.5) {
          video.currentTime = video.duration - 0.05;
        }
      } catch (e) {}
    }

    // Dismiss overlay close
    const overlayClose = player.querySelector(
      '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button'
    );
    if (overlayClose) { try { overlayClose.click(); } catch (e) {} }
  }

  // ============================================================
  // (4) DOM ad container removal
  // ============================================================
  const AD_SELECTORS = [
    'ytd-display-ad-renderer', 'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer', 'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer', 'ytd-companion-slot-renderer',
    'ytd-video-masthead-ad-v3-renderer', 'ytd-action-companion-ad-renderer',
    'ytd-promoted-sparkles-text-search-renderer',
    'ytd-product-shelf-renderer', 'ytd-merch-shelf-renderer',
    'ytd-mealbar-promo-renderer',
    'ytm-promoted-sparkles-web-renderer', 'ytm-companion-slot',
    'ytm-promoted-video-renderer', 'ytm-display-ad-renderer',
    '.ytp-ad-module', '.ytp-ad-overlay-container',
    '.ytp-featured-product', '.ytp-paid-content-overlay',
    '.ytp-ad-image-overlay', '.ytp-ad-text-overlay',
    '#masthead-ad', '#player-ads', '#offer-module'
  ];

  function pruneAds(root) {
    if (!root || root.nodeType !== 1) return;
    for (const sel of AD_SELECTORS) {
      try {
        if (root.matches && root.matches(sel)) { root.remove(); return; }
        const matches = root.querySelectorAll ? root.querySelectorAll(sel) : [];
        for (const el of matches) { try { el.remove(); } catch (e) {} }
      } catch (e) {}
    }
  }

  // ============================================================
  // Init
  // ============================================================
  let observer = null;
  let adPoll = null;
  let videoBoundCheck = null;

  function init() {
    // Read settings
    let storagePromise;
    try {
      const result = browser.storage.sync.get(['settings'], (data) => {
        applySettings((data && data.settings) || {});
      });
      if (result && typeof result.then === 'function') {
        result.then((data) => applySettings((data && data.settings) || {}));
      }
    } catch (e) {
      applySettings({});
    }

    // Always start ad blocking regardless of theme
    startAdObserver();
    if (!adPoll) adPoll = setInterval(handleAd, 100);
    bindVideoEvents();
    if (!videoBoundCheck) videoBoundCheck = setInterval(bindVideoEvents, 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (adPoll) { clearInterval(adPoll); adPoll = null; }
      } else if (!adPoll) {
        adPoll = setInterval(handleAd, 100);
      }
    });
  }

  function applySettings(s) {
    const enabled = s.blackThemeEnabled !== false;
    const colorName = (typeof s.fontColor === 'string') ? s.fontColor : 'cyan';
    const focusOn = s.youtubeFocusMode === true;
    if (enabled) {
      enableYouTubeDark();
      applySecOpsColor(colorName);
    } else {
      disableYouTubeDark();
    }
    // v8.0: Focus mode toggle (independent of dark theme)
    setFocusMode(focusOn);
  }

  function setFocusMode(on) {
    try {
      if (document.documentElement && document.documentElement.classList) {
        if (on) document.documentElement.classList.add('secops-yt-focus');
        else document.documentElement.classList.remove('secops-yt-focus');
      }
    } catch (e) {}
  }

  function startAdObserver() {
    if (observer) return;
    const root = document.documentElement;
    if (!root) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) pruneAds(n);
      }
      handleAd();
    });
    observer.observe(root, { childList: true, subtree: true });
    pruneAds(root);
  }

  function bindVideoEvents() {
    const video = document.querySelector('video.html5-main-video') ||
                  document.querySelector('video');
    if (!video || video.__secopsBound) return;
    video.__secopsBound = true;
    ['timeupdate', 'durationchange', 'play', 'playing'].forEach(ev => {
      try {
        video.addEventListener(ev, handleAd, { passive: true });
      } catch (e) {}
    });
  }

  // React to theme/color changes
  try {
    browser.storage.onChanged.addListener((changes, ns) => {
      if (ns !== 'sync') return;
      if (changes.settings && changes.settings.newValue) {
        applySettings(changes.settings.newValue);
      }
    });
  } catch (e) {}

  // Message channel
  try {
    browser.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.action !== 'updateTheme') return false;
      if (msg.settings) applySettings(msg.settings);
      return false;
    });
  } catch (e) {}

  init();
  console.log('[SecOps/YT] isolated v7.0.0 active');
})();
