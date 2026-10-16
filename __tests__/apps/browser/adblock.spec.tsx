import { Browser } from "components/apps/TorBrowser";
import { act, type ReactNode } from "react";
import { fetchProxyCapability } from "utils/useProxyCapability";

const { createRoot } = jest.requireActual<{
  createRoot: (container: DocumentFragment | Element) => {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };
}>("react-dom/client");

jest.mock("components/apps/Browser/StyledBrowser", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("components/system/Window/useTitle", () => ({
  __esModule: true,
  default: () => ({ prependFileToTitle: jest.fn() }),
}));
jest.mock("contexts/process", () => ({
  useProcesses: () => ({
    processes: { browser: { url: "https://example.com/article" } },
  }),
}));
jest.mock("utils/useProxyCapability", () => ({
  fetchProxyCapability: jest.fn(),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const CAPABILITY = "test-route-capability";
const PRESSED_ATTRIBUTE = "aria-pressed";

describe("browser ad-filter policy", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const frameUrls = (): URL[] =>
    [...container.querySelectorAll("iframe")].map(
      (frame) => new URL(frame.src)
    );
  const filterButton = (): HTMLButtonElement | null =>
    container.querySelector('button[aria-label="Block ads and trackers"]');

  const renderBrowser = async (
    mode: "clearnet" | "tor" = "tor"
  ): Promise<void> => {
    await act(async () => {
      root.render(<Browser id="browser" mode={mode} />);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    jest.clearAllMocks();
    jest.mocked(fetchProxyCapability).mockResolvedValue(CAPABILITY);
    jest.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
  });

  it("starts Tor with filtering and scripts off, retaining scoped authorization", async () => {
    await renderBrowser();
    const [frame] = frameUrls();

    expect(filterButton()?.getAttribute(PRESSED_ATTRIBUTE)).toBe("true");
    expect(filterButton()?.title).toBe(
      "Ads: Blocked — click to allow ads and reload tabs"
    );
    expect(frame.searchParams.get("adblock")).toBe("1");
    expect(frame.searchParams.get("nojs")).toBe("1");
    expect(frame.searchParams.get("direct")).toBeNull();
    expect(frame.searchParams.get("iso")).toMatch(/^[\da-f]{32}$/);
    expect(frame.searchParams.get("cap")).toBe(CAPABILITY);
    expect(
      container.querySelector("iframe")?.getAttribute("sandbox")
    ).not.toContain("allow-scripts");
    expect(fetchProxyCapability).toHaveBeenCalledWith(
      "tor",
      "browser",
      frame.searchParams.get("iso"),
      "off"
    );
  });

  it("keeps clearnet defaults and controls unchanged", async () => {
    await renderBrowser("clearnet");
    const [frame] = frameUrls();

    expect(filterButton()).toBeNull();
    expect(frame.searchParams.get("adblock")).toBeNull();
    expect(frame.searchParams.get("direct")).toBe("1");
    expect(frame.searchParams.get("nojs")).toBeNull();
    expect(frame.searchParams.get("cap")).toBe(CAPABILITY);
  });

  it("keeps native focus and keyboard activation available", async () => {
    await renderBrowser();
    const button = filterButton();

    expect(button).not.toBeNull();
    button?.focus();
    expect(button === document.activeElement).toBe(true);
    expect(button?.tabIndex).toBe(0);
    for (const key of ["Enter", " ", "Tab"]) {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      });

      button?.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it("reloads every tab on reversible policy changes without rotating isolation", async () => {
    await renderBrowser();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="New tab"]')
        ?.click();
      await Promise.resolve();
    });
    const before = frameUrls();
    const originalFrames = [...container.querySelectorAll("iframe")];

    expect(before).toHaveLength(2);
    expect(new Set(before.map((url) => url.searchParams.get("iso"))).size).toBe(
      2
    );
    expect(filterButton()).not.toBeNull();
    await act(async () => {
      filterButton()?.click();
      await Promise.resolve();
    });
    expect(filterButton()?.getAttribute(PRESSED_ATTRIBUTE)).toBe("false");
    expect(filterButton()?.title).toBe(
      "Ads: Allowed — click to block ads and reload tabs"
    );
    for (const [index, url] of frameUrls().entries()) {
      expect(url.searchParams.get("adblock")).toBeNull();
      expect(url.searchParams.get("iso")).toBe(
        before[index].searchParams.get("iso")
      );
      expect(url.searchParams.get("url")).toBe(
        before[index].searchParams.get("url")
      );
      expect(url.searchParams.get("nojs")).toBe("1");
      expect(url.searchParams.get("cap")).toBe(CAPABILITY);
      expect(container.querySelectorAll("iframe")[index]).not.toBe(
        originalFrames[index]
      );
    }

    await act(async () => {
      filterButton()?.click();
      await Promise.resolve();
    });
    expect(filterButton()?.getAttribute(PRESSED_ATTRIBUTE)).toBe("true");
    for (const [index, url] of frameUrls().entries()) {
      expect(url.searchParams.get("adblock")).toBe("1");
      expect(url.searchParams.get("iso")).toBe(
        before[index].searchParams.get("iso")
      );
    }
  });
});
