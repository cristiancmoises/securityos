import {
  getFormattedSize,
  getUrlOrSearch,
  loadFiles,
  updateBrowserHistory,
} from "utils/functions";
import { mockOnLoadEventListener } from "utils/testFunctions";

const TEST_SEARCH_QUERY = "https://search/?q=";
const ONE_URL = "https://one.example/";
const TWO_URL = "https://two.example/";

const formattedSizeCases: [number, string][] = [
  [0, "0 bytes"],
  [1, "1 byte"],
  [2, "2 bytes"],
  [1023, "1023 bytes"],
  [1024, "1.00 KB"],
  [1034, "1.00 KB"],
  [1035, "1.01 KB"],
  [3957, "3.86 KB"],
  [238770, "233 KB"],
  [1048081, "0.99 MB"],
  [9968640, "9.50 MB"],
  [16777216, "16.0 MB"],
];

describe("gets formatted size", () => {
  test.each(formattedSizeCases)("given %p render %p", (size, result) =>
    expect(getFormattedSize(size)).toBe(result)
  );
});

const scriptsStylesCases: string[][][] = [
  [["/Example/Path/script.js", "/Example/Path/style.css"]],
];

describe("loads scripts & styles", () => {
  beforeAll(() => {
    HTMLLinkElement.prototype.addEventListener = mockOnLoadEventListener;
    HTMLScriptElement.prototype.addEventListener = mockOnLoadEventListener;
  });

  test.each(scriptsStylesCases)(
    "load js files as <script /> & css files as <link />",
    async (urls) => {
      await loadFiles(urls);

      urls.forEach((url) =>
        expect(
          [...document.head.childNodes].some((childNode) => {
            const childUrl =
              (childNode as HTMLLinkElement)?.href ||
              (childNode as HTMLScriptElement)?.src;

            return childUrl?.includes(encodeURI(url));
          })
        ).toBeTruthy()
      );
    }
  );
});

describe("resolves browser address-bar input", () => {
  test.each([
    ["securityops.co/path", "https://securityops.co/path"],
    ["git.securityops.com.br/repo", "https://git.securityops.com.br/repo"],
    ["example.io", "https://example.io/"],
    ["127.0.0.1:8080/status", "https://127.0.0.1:8080/status"],
    ["serviceexample.onion/path", "http://serviceexample.onion/path"],
  ])("navigates host-like input %s", async (address, expected) => {
    await expect(getUrlOrSearch(address, TEST_SEARCH_QUERY)).resolves.toBe(
      expected
    );
  });

  test("searches text and encodes it", async () => {
    await expect(
      getUrlOrSearch("security operations", TEST_SEARCH_QUERY)
    ).resolves.toBe("https://search/?q=security%20operations");
  });

  test("never navigates executable URL schemes", async () => {
    const executableUrl = ["javascript", "alert(1)"].join(":");

    await expect(
      getUrlOrSearch(executableUrl, TEST_SEARCH_QUERY)
    ).resolves.toBe("https://search/?q=javascript%3Aalert(1)");
  });
});

describe("updates browser navigation history", () => {
  test("does not duplicate the current address", () => {
    const history = [ONE_URL, TWO_URL];

    expect(updateBrowserHistory(history, 1, TWO_URL)).toEqual({
      history,
      position: 1,
    });
  });

  test("replaces an unresolved current address after its first load", () => {
    expect(
      updateBrowserHistory(["example.com"], 0, "https://example.com/", true)
    ).toEqual({ history: ["https://example.com/"], position: 0 });
  });

  test("adds an in-page navigation and truncates forward history", () => {
    expect(
      updateBrowserHistory(
        [ONE_URL, TWO_URL, "https://old.example/"],
        1,
        "https://new.example/"
      )
    ).toEqual({
      history: [ONE_URL, TWO_URL, "https://new.example/"],
      position: 2,
    });
  });
});
