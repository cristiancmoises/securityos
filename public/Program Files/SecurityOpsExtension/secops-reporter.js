/*
 * Security Ops — Blocked-Resource Reporter (v7.0.0)
 * Copyright (C) 2024-2026 Cristian Cezar Moises <ethicalhacker@riseup.net>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Detects blocked sub-resources from inside the page and reports them to
 * the background script for the logs view.
 *
 * v7.0 changes:
 *   - PerformanceObserver heuristic widened: any cross-origin resource with
 *     transferSize=0 + duration<5 + decodedBodySize=0 is reported (was
 *     gated on KNOWN_AD_PATTERNS which excluded too much)
 *   - Buffered=true on PerformanceObserver to catch resources blocked
 *     before reporter loaded
 *   - Robust message sending: use try/catch around every sendMessage call
 *     and never let a rejected Promise crash the script
 */

(() => {
  'use strict';
  const browser = self.browser || self.chrome;

  // Skip YouTube — has dedicated content script
  if (/(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname)) return;

  const MAX_URL_LENGTH = 2048;
  const RATE_LIMIT_MS = 500;
  const recentReports = new Map();

  function shouldReport(url) {
    const now = Date.now();
    const last = recentReports.get(url);
    if (last && (now - last) < RATE_LIMIT_MS) return false;
    recentReports.set(url, now);
    // Trim old entries periodically
    if (recentReports.size > 200) {
      const cutoff = now - 30000;
      for (const [k, t] of recentReports) {
        if (t < cutoff) recentReports.delete(k);
      }
    }
    return true;
  }

  function report(url, reason) {
    if (typeof url !== 'string' || url.length > MAX_URL_LENGTH) return;
    if (!/^https?:\/\//i.test(url)) return;
    if (!shouldReport(url)) return;
    try {
      const result = browser.runtime.sendMessage({
        action: 'reportBlockedResource',
        url: url,
        reason: reason || 'resource'
      });
      // Always swallow Promise rejections silently
      if (result && typeof result.then === 'function') {
        result.then(() => {}, () => {});
      }
    } catch (e) {
      // ignore
    }
  }

  // ============================================================
  // PRIMARY signal: error events on resource elements
  // Bubbles through document → catches all dynamic <img>/<script>/etc.
  // ============================================================
  function onErrorCapture(ev) {
    const t = ev.target;
    if (!t || !t.tagName) return;
    let url, reason;
    switch (t.tagName) {
      case 'IMG':    url = t.src;     reason = 'image';   break;
      case 'SCRIPT': url = t.src;     reason = 'script';  break;
      case 'IFRAME': url = t.src;     reason = 'frame';   break;
      case 'LINK':   url = t.href;    reason = 'stylesheet'; break;
      case 'VIDEO':
      case 'AUDIO':
      case 'SOURCE': url = t.src;     reason = 'media';   break;
      default: return;
    }
    if (url) report(url, reason);
  }

  try { document.addEventListener('error', onErrorCapture, true); } catch (e) {}
  try { window.addEventListener('error', onErrorCapture, true); } catch (e) {}

  // ============================================================
  // SECONDARY signal: PerformanceObserver — catches blocked requests
  // even when no error event fires (some cancellations are silent)
  //
  // Heuristic: cross-origin resource with transferSize=0 + duration<5
  // is almost certainly blocked. We keep our rate limiter to dedupe.
  // ============================================================
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const myOrigin = location.origin;
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.name) continue;
          // Same-origin resources rarely get blocked; focus on cross-origin
          let urlObj;
          try { urlObj = new URL(entry.name); } catch (e) { continue; }
          if (urlObj.origin === myOrigin) continue;
          // Heuristic: 0-byte and ultra-fast = blocked
          if (entry.transferSize === 0 &&
              entry.duration < 5 &&
              entry.decodedBodySize === 0 &&
              entry.encodedBodySize === 0) {
            report(entry.name, 'resource');
          }
        }
      });
      po.observe({ type: 'resource', buffered: true });
    }
  } catch (e) {}

  console.log('[SecOps] reporter v7.0.0 active on', location.hostname);
})();
