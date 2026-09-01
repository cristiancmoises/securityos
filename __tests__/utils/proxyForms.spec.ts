import { type ProxyFormFlags, rewriteProxyGetForms } from "utils/proxyForms";

const ORIGIN = "https://os.securityops.co";
const BASE = "https://wiki.securityops.co/articles/current?lang=en";
const ALL_FLAGS: ProxyFormFlags = {
  adblock: true,
  app: true,
  capability: "signed-route-capability",
  injectExt: true,
  isDirect: true,
  iso: "a".repeat(32),
  keywave: true,
  libreJs: true,
  noJs: true,
  profile: "keywave",
  zupt: true,
};

describe("privacy-proxy GET forms", () => {
  it("preserves every proxy policy flag, including Keywave", () => {
    const target = "https://chat.securityops.co/search";
    const html = `<form method="get" action="${ORIGIN}/api/proxy?url=${encodeURIComponent(
      target
    )}"><input name="q"></form>`;
    const rewritten = rewriteProxyGetForms(html, BASE, ORIGIN, ALL_FLAGS);

    expect(rewritten).toContain(`action="${ORIGIN}/api/proxy"`);
    expect(rewritten).toContain(`name="__pxurl" value="${target}"`);
    for (const flag of [
      "adblock",
      "app",
      "direct",
      "ext",
      "keywave",
      "librejs",
      "nojs",
      "zupt",
    ]) {
      expect(rewritten).toContain(`name="${flag}" value="1"`);
    }
    expect(rewritten).toContain(`name="iso" value="${"a".repeat(32)}"`);
    expect(rewritten).toContain('name="profile" value="keywave"');
    expect(rewritten).toContain('name="cap" value="signed-route-capability"');
  });

  it.each(["<form>", '<form action="">', '<form action="#results">'])(
    "keeps current-page GET form %s inside the proxy",
    (form) => {
      const rewritten = rewriteProxyGetForms(
        `${form}<input name="q"></form>`,
        BASE,
        ORIGIN,
        { ...ALL_FLAGS, isDirect: false }
      );

      expect(rewritten).toContain(`action="${ORIGIN}/api/proxy"`);
      expect(rewritten).toContain(`name="__pxurl" value="${BASE}"`);
      expect(rewritten).not.toContain('name="direct"');
    }
  );

  it("leaves body-bearing forms unchanged", () => {
    const html = '<form method="post"><input name="payload"></form>';

    expect(rewriteProxyGetForms(html, BASE, ORIGIN, ALL_FLAGS)).toBe(html);
  });
});
