import {
  CLEARNET_BOOKMARKS,
  CLEARNET_HOME,
  CLEARNET_SEARCH_QUERY,
  DEFAULT_CLEARNET_JS_MODE,
  DEFAULT_TOR_JS_MODE,
  isOnionUrl,
} from "components/apps/Browser/config";
import { getUrlOrSearch } from "utils/functions";

describe("browser defaults", () => {
  it("starts clearnet on SecurityOps with all scripts allowed", () => {
    expect(CLEARNET_HOME).toBe("https://securityops.co/");
    expect(DEFAULT_CLEARNET_JS_MODE).toBe("all");
  });

  it("keeps free-text clearnet searches on SecurityOps", async () => {
    await expect(
      getUrlOrSearch("tor browser hardening", CLEARNET_SEARCH_QUERY)
    ).resolves.toBe("https://securityops.co/?q=tor%20browser%20hardening");
  });

  it("keeps Tor in its fail-closed safest script policy by default", () => {
    expect(DEFAULT_TOR_JS_MODE).toBe("off");
  });

  it("ships the Wiki bookmark without the retired CryptPad entry", () => {
    expect(CLEARNET_BOOKMARKS).toContainEqual({
      name: "Wiki",
      url: "https://wiki.securityops.co/",
    });
    expect(CLEARNET_BOOKMARKS.map(({ name }) => name)).not.toContain(
      "CryptPad"
    );
  });

  it("recognizes hidden-service URLs before clearnet resolution", () => {
    expect(isOnionUrl("http://examplehiddenservice.onion/path")).toBe(true);
    expect(isOnionUrl("http://examplehiddenservice.onion./path")).toBe(true);
    expect(isOnionUrl("https://onion.example/")).toBe(false);
    expect(isOnionUrl("not a URL")).toBe(false);
  });
});
