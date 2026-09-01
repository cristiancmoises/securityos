import useSessionContextState from "contexts/session/useSessionContextState";
import { act, type ReactNode } from "react";

const { createRoot } = jest.requireActual<{
  createRoot: (container: DocumentFragment | Element) => {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };
}>("react-dom/client");

const CUSTOM_WALLPAPER = "/Pictures/custom.webp";

jest.mock("contexts/fileSystem", () => ({
  useFileSystem: () => ({
    deletePath: jest.fn(),
    lstat: jest.fn(),
    readFile: jest.fn(),
    rootFs: undefined,
    writeFile: jest.fn(),
  }),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("Undercover appearance state", () => {
  it("shares one snapshot and restores the prior wallpaper fit", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let session: ReturnType<typeof useSessionContextState> | undefined;

    const StateReader = (): undefined => {
      session = useSessionContextState();

      return undefined;
    };

    act(() => root.render(<StateReader />));
    act(() => session?.setWallpaper(CUSTOM_WALLPAPER, "tile"));
    act(() => session?.enableUndercover());

    expect(session).toMatchObject({
      themeName: "undercover",
      undercoverAppearance: {
        themeName: "defaultTheme",
        wallpaperFit: "tile",
        wallpaperImage: CUSTOM_WALLPAPER,
      },
      wallpaperFit: "fill",
    });

    // A second control enabling an already-active profile must not replace the
    // shared pre-Undercover snapshot with the Undercover appearance.
    act(() => session?.enableUndercover());
    act(() => session?.disableUndercover());

    expect(session).toMatchObject({
      themeName: "defaultTheme",
      wallpaperFit: "tile",
      wallpaperImage: CUSTOM_WALLPAPER,
    });
    expect(session?.undercoverAppearance).toBeUndefined();

    act(() => root.unmount());
  });
});
