// SecurityOS built-in ad/tracker blocker for the privacy proxy.
//
// The Clearnet Browser fetches pages server-side through `pages/api/proxy.ts`,
// which rewrites every sub-resource URL. That gives us a clean network-level
// choke point: any request whose host matches a known ad/tracking domain is
// neutralized BEFORE it ever loads (no script runs, no beacon fires, no pixel
// is fetched) — far stronger than a content-script blocker, and it works even
// with JavaScript fully disabled.
//
// `AD_HOST_SUFFIXES` is a curated, high-impact subset of the EasyList +
// EasyPrivacy block lists (the domains responsible for the bulk of real-world
// ad/tracking traffic). It is intentionally hand-maintained rather than parsing
// the full multi-megabyte lists at request time; to broaden coverage, add more
// suffixes here (or load a generated list) — `isAdHost` matches a host and all
// of its sub-domains.
const AD_HOST_SUFFIXES: readonly string[] = [
  // --- Google ad / tracking infrastructure ---
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagmanager.com",
  "googletagservices.com",
  "google-analytics.com",
  "analytics.google.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "partner.googleadservices.com",
  "2mdn.net",
  "app-measurement.com",
  // --- Facebook / Meta tracking ---
  "connect.facebook.net",
  "facebook.net",
  "atdmt.com",
  // --- Amazon ads ---
  "amazon-adsystem.com",
  "assoc-amazon.com",
  "adtago.s3.amazonaws.com",
  // --- Major ad exchanges / SSPs / DSPs ---
  "adnxs.com",
  "adsrvr.org",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "casalemedia.com",
  "criteo.com",
  "criteo.net",
  "smartadserver.com",
  "moatads.com",
  "33across.com",
  "sharethrough.com",
  "districtm.io",
  "gumgum.com",
  "indexww.com",
  "contextweb.com",
  "bidswitch.net",
  "spotxchange.com",
  "spotx.tv",
  "teads.tv",
  "outbrain.com",
  "taboola.com",
  "revcontent.com",
  "mgid.com",
  "media.net",
  "adform.net",
  "yieldmo.com",
  "advertising.com",
  "adcolony.com",
  "applovin.com",
  "inmobi.com",
  "mopub.com",
  "unityads.unity3d.com",
  // --- Analytics / fingerprinting / session-replay trackers ---
  "scorecardresearch.com",
  "quantserve.com",
  "quantcount.com",
  "hotjar.com",
  "hotjar.io",
  "mouseflow.com",
  "fullstory.com",
  "mixpanel.com",
  "segment.com",
  "segment.io",
  "amplitude.com",
  "heap.io",
  "heapanalytics.com",
  "crazyegg.com",
  "optimizely.com",
  "newrelic.com",
  "nr-data.net",
  "branch.io",
  "kissmetrics.com",
  "chartbeat.com",
  "chartbeat.net",
  "parsely.com",
  "bounceexchange.com",
  "clarity.ms",
  "yandex.ru",
  "mc.yandex.ru",
  "matomo.cloud",
  "bugsnag.com",
  "sentry.io",
  "fundingchoicesmessages.google.com",
  // --- Consent / "anti-adblock" / push-notification nags ---
  "onesignal.com",
  "pushcrew.com",
  "cookielaw.org",
  "onetrust.com",
  "quantcast.com",
  "consensu.org",
  "privacy-center.org",
  // --- Misc high-volume ad/tracking ---
  "zedo.com",
  "adroll.com",
  "taboolanews.com",
  "ad-delivery.net",
  "adsafeprotected.com",
  "go-mpulse.net",
  "demdex.net",
  "everesttech.net",
  "omtrdc.net",
  "rlcdn.com",
  "agkn.com",
  "bluekai.com",
  "crwdcntrl.net",
  "exelator.com",
  "tapad.com",
  "addthis.com",
  "sharethis.com",
  "disqusads.com",
];

// Pre-split into an exact-host set for O(1) checks plus the suffix list for
// sub-domain matching.
const adHostSet = new Set(AD_HOST_SUFFIXES);

/**
 * True when `hostname` is, or is a sub-domain of, a known ad/tracking domain.
 * Matching is case-insensitive and covers `ads.example.com` for `example.com`.
 */
export const isAdHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (!host) return false;
  if (adHostSet.has(host)) return true;

  return AD_HOST_SUFFIXES.some((suffix) => host.endsWith(`.${suffix}`));
};

/**
 * True when the absolute URL points at an ad/tracking host. Non-http(s) and
 * unparseable URLs are never treated as ads (they're handled elsewhere).
 */
export const isAdUrl = (absoluteUrl: string): boolean => {
  try {
    const { hostname, protocol } = new URL(absoluteUrl);

    if (protocol !== "http:" && protocol !== "https:") return false;

    return isAdHost(hostname);
  } catch {
    return false;
  }
};

// Cosmetic filtering: hide the most common ad containers/placeholders so a page
// doesn't leave gaping empty boxes once the network requests are blocked. These
// are deliberately conservative, structural selectors (mirroring EasyList's
// generic cosmetic rules) to minimize false positives. Injected into proxied
// pages and effective even with scripts stripped (LibreJS / no-JS modes).
export const ADBLOCK_COSMETIC_CSS = [
  "ins.adsbygoogle",
  "iframe[src*='doubleclick']",
  "iframe[src*='googlesyndication']",
  "iframe[src*='/ads/']",
  "iframe[id^='google_ads']",
  "div[id^='google_ads']",
  "div[id^='div-gpt-ad']",
  "div[id^='taboola']",
  "div[class^='taboola']",
  "div[class*='trc_rbox']",
  "div[id^='outbrain']",
  "div[class^='OUTBRAIN']",
  "[id*='sponsored']",
  "[class*='-sponsored']",
  "[class*='sponsored-']",
  "[class*='advertisement']",
  "[class*='ad-banner']",
  "[class*='banner-ad']",
  "[id*='ad-banner']",
  "[class*='adsbox']",
  "[class*='ad-slot']",
  "[id*='ad-slot']",
  "[data-ad-slot]",
  "[data-adunit]",
].join(",") + "{display:none!important;height:0!important;}";
