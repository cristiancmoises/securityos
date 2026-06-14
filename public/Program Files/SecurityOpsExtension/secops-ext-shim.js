/*
 * SecurityOS — minimal WebExtension `browser`/`chrome` shim.
 *
 * The Security Ops extension (v10.1.0, by Cristian Cezar Moisés, GPL-3.0) is a
 * Manifest V3 extension. SecurityOS can't run a real WebExtensions runtime inside
 * the proxied browser iframe, but its CONTENT scripts (dark theme, YouTube
 * ad-block, tracking-param stripping) are plain JS/CSS. This shim provides the
 * small `browser.storage`/`browser.runtime` surface they read, seeded with the
 * extension's real DEFAULT_SETTINGS + whitelist, so they run when the proxy
 * injects them into a page. Network-level features (declarativeNetRequest
 * blocklists, the Tor proxy control) are already handled by SecurityOS itself.
 */
(function () {
  if (typeof window === "undefined" || (window.browser && window.browser.storage)) return;

  var DEFAULT_SETTINGS = {
    blockAds: true,
    blockTrackers: true,
    blockMalware: true,
    blockGambling: false,
    blockAdult: false,
    blockSocial: false,
    blockBadJS: false,
    blockMedia: false,
    blockGigachad: false,
    youtubeFocusMode: false,
    stripTrackingParams: true,
    enforceHttps: true,
    ipLookupEnabled: false,
    redirectGoogle: false,
    redirectBing: false,
    redirectYouTube: false,
    redirectReddit: false,
    blackThemeEnabled: true,
    fontColor: "cyan",
  };
  var DEFAULT_WHITELIST = [
    "securityops.co",
    "redlib.catsarch.com",
    "invidious.nerdvpn.de",
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
  ];
  var STATE = {
    settings: DEFAULT_SETTINGS,
    whitelist: DEFAULT_WHITELIST,
    proxy: { enabled: false, host: "", port: 0, scheme: "socks5" },
    ok: true,
  };

  function resolveOrCall(value, cb) {
    if (typeof cb === "function") {
      try { cb(value); } catch (e) { /* ignore */ }
      return undefined;
    }
    return Promise.resolve(value);
  }

  var noop = function () {};
  var api = {
    storage: {
      sync: {
        get: function (_keys, cb) { return resolveOrCall({ settings: STATE.settings }, cb); },
        set: function (_obj, cb) { return resolveOrCall(undefined, cb); },
      },
      local: {
        get: function (_keys, cb) { return resolveOrCall({ settings: STATE.settings }, cb); },
        set: function (_obj, cb) { return resolveOrCall(undefined, cb); },
      },
      onChanged: { addListener: noop, removeListener: noop },
    },
    runtime: {
      sendMessage: function (_msg, cb) { return resolveOrCall(STATE, cb); },
      onMessage: { addListener: noop, removeListener: noop },
      getURL: function (path) { return "/Program Files/SecurityOpsExtension/" + String(path).replace(/^\/+/, ""); },
      lastError: undefined,
      id: "securityos-injected",
    },
  };

  window.browser = window.browser || api;
  window.chrome = window.chrome || api;
})();
