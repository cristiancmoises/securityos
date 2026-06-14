/*
 * Security Ops — YouTube Page-World Ad Killer (v7.0.0)
 * Copyright (C) 2024-2026 Cristian Cezar Moises <ethicalhacker@riseup.net>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This script runs in the PAGE world (Manifest V3 world:MAIN content script).
 * It runs at document_start, BEFORE YouTube's own scripts.
 *
 * Strategy adapted from uBlock Origin's youtube-misc.js + scriptlets:
 *   1. Patch Object.defineProperty so YouTube can't set ad-related keys
 *   2. Patch JSON.parse to strip ad placements as YT parses player config
 *   3. Patch fetch + XHR for ad-network endpoints  
 *   4. Use Object.defineProperty on window.ytInitialPlayerResponse with a
 *      setter that strips ads before storing
 *   5. Disable Premium ad pings (api/stats/ads, api/stats/qoe?adFormat=...)
 */

(() => {
  'use strict';

  // ============================================================
  // Idempotency
  // ============================================================
  if (window.__secopsYTPatched_v7) return;
  window.__secopsYTPatched_v7 = true;

  // ============================================================
  // Ad keys to strip from player responses
  // ============================================================
  const AD_KEYS = new Set([
    'adPlacements', 'playerAds', 'adSlots',
    'adBreakHeartbeatParams', 'adBreakParams',
    'adInsertionGroups', 'adServingData',
    'serverSideAdInsertionEnabled',
    'auxiliaryUi', 'adIneligibilityReason'
  ]);

  // Recursive strip — strip ad keys from this object and all descendants
  function deepStrip(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 12) return obj;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) deepStrip(obj[i], depth + 1);
      return obj;
    }
    for (const key of AD_KEYS) {
      if (key in obj) {
        try { delete obj[key]; } catch (e) {}
      }
    }
    for (const k in obj) {
      try {
        const v = obj[k];
        if (v && typeof v === 'object') deepStrip(v, depth + 1);
      } catch (e) {}
    }
    return obj;
  }

  // ============================================================
  // (1) Patch JSON.parse — strips ads before any YT code sees them
  // ============================================================
  const _parse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const obj = _parse.call(this, text, reviver);
    try { deepStrip(obj, 0); } catch (e) {}
    return obj;
  };

  // ============================================================
  // (2) Lock window.ytInitialPlayerResponse and ytInitialData
  //     so YT can't store ad data
  // ============================================================
  function installSetterStripper(propName) {
    let storedValue;
    try {
      Object.defineProperty(window, propName, {
        configurable: true,
        get() { return storedValue; },
        set(value) {
          try { deepStrip(value, 0); } catch (e) {}
          storedValue = value;
        }
      });
    } catch (e) {}
  }
  installSetterStripper('ytInitialPlayerResponse');
  installSetterStripper('ytInitialData');

  // ============================================================
  // (3) Patch fetch — clean ad data from /youtubei/v1/player etc.
  // ============================================================
  if (typeof window.fetch === 'function') {
    const _fetch = window.fetch;
    window.fetch = function (...args) {
      let url = '';
      try {
        url = (typeof args[0] === 'string') ? args[0] :
              (args[0] && args[0].url) || '';
      } catch (e) {}

      // Block ad-stat pings
      if (/\/(?:pagead|api\/stats\/ads|youtubei\/v1\/log_event)/.test(url)) {
        // Return a fake successful empty response
        return Promise.resolve(new Response('{}', { status: 200 }));
      }

      return _fetch.apply(this, args).then((res) => {
        if (!/\/youtubei\/v1\/(?:player|next|browse|reel)/.test(url)) {
          return res;
        }
        // Clone and strip
        return res.clone().text().then((body) => {
          try {
            const obj = _parse(body);
            deepStrip(obj, 0);
            return new Response(JSON.stringify(obj), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
          } catch (e) {
            return res;
          }
        });
      });
    };
  }

  // ============================================================
  // (4) Patch XMLHttpRequest — older paths use it
  // ============================================================
  if (typeof XMLHttpRequest !== 'undefined') {
    const proto = XMLHttpRequest.prototype;
    const _open = proto.open;
    const _send = proto.send;

    proto.open = function (method, url, ...rest) {
      this.__secopsURL = url || '';
      return _open.call(this, method, url, ...rest);
    };

    proto.send = function (body) {
      const url = this.__secopsURL;
      // Block ad pings
      if (url && /\/(?:pagead|api\/stats\/ads)/.test(url)) {
        // Don't actually send — fire fake events
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, configurable: true });
          Object.defineProperty(this, 'responseText', { value: '{}', configurable: true });
          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onload) this.onload();
        }, 0);
        return;
      }
      // Clean response for player endpoints
      if (url && /\/youtubei\/v1\/(?:player|next|browse|reel)/.test(url)) {
        this.addEventListener('readystatechange', function () {
          if (this.readyState !== 4) return;
          if (this.responseType !== '' && this.responseType !== 'text') return;
          try {
            const obj = _parse(this.responseText || '{}');
            deepStrip(obj, 0);
            const scrubbed = JSON.stringify(obj);
            Object.defineProperty(this, 'responseText', {
              value: scrubbed, configurable: true
            });
            Object.defineProperty(this, 'response', {
              value: scrubbed, configurable: true
            });
          } catch (e) {}
        });
      }
      return _send.call(this, body);
    };
  }

  // ============================================================
  // (5) Periodic re-scrub of window globals (defense in depth)
  // ============================================================
  setInterval(() => {
    try {
      if (window.ytInitialPlayerResponse) deepStrip(window.ytInitialPlayerResponse, 0);
      if (window.ytInitialData) deepStrip(window.ytInitialData, 0);
    } catch (e) {}
  }, 500);

  console.log('[SecOps/YT] page-world v7.0.0 ad killer installed (world:MAIN)');
})();
