import { isAdUrl } from "utils/adblock";

const TORDEX = "tordexu73joywapk2txdr54jed4imqledpcvcuf75qsas2gwdgksvnyd.onion";

describe("privacy-proxy ad filtering", () => {
  it.each([
    `http://${TORDEX}/banners/banner.gif`,
    `https://${TORDEX}/banners/campaign/image.webp?campaign=1`,
    `http://${TORDEX.toUpperCase()}/banners/image.png`,
    `http://${TORDEX}./banners/image.png`,
  ])("blocks the known Tordex banner inventory: %s", (url) => {
    expect(isAdUrl(url)).toBe(true);
  });

  it.each([
    `http://${TORDEX}/`,
    `http://${TORDEX}/search?query=privacy`,
    `http://${TORDEX}/styles/main.css`,
    `http://${TORDEX}/images/logo.png`,
    `http://${TORDEX}/banners`,
    `http://${TORDEX}/BANNERS/image.png`,
    `http://${TORDEX}/articles/banner-design`,
    `http://${TORDEX}/search?path=/banners/`,
    `http://${TORDEX}/banners/../search`,
    `http://cdn.${TORDEX}/banners/image.png`,
    `http://${TORDEX}.example.com/banners/image.png`,
    `http://${TORDEX}@example.com/banners/image.png`,
    "https://example.com/banners/image.png",
    "http://otherhiddenservice.onion/banners/image.png",
  ])("keeps unrelated pages and assets available: %s", (url) => {
    expect(isAdUrl(url)).toBe(false);
  });

  it("retains the existing tracker host policy", () => {
    expect(isAdUrl("https://sub.doubleclick.net/pixel.gif")).toBe(true);
  });

  it.each(["not a URL", `ftp://${TORDEX}/banners/image.png`])(
    "leaves unsupported URLs to the proxy validation: %s",
    (url) => {
      expect(isAdUrl(url)).toBe(false);
    }
  );
});
