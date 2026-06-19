import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import { useCallback, useEffect } from "react";
import { useTheme } from "styled-components";
import { TRANSITIONS_IN_MILLISECONDS } from "utils/constants";
import { loadFiles, pxToNum } from "utils/functions";

declare global {
  interface Window {
    CCModule: {
      OnResize?: () => void;
      arguments: string[];
      canvas: HTMLCanvasElement;
      postRun: (() => void)[];
      print: () => void;
      setCanvasSize?: (width: number, height: number) => void;
      setStatus: () => void;
    };
  }
}

const useClassiCube = (
  id: string,
  _url: string,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
): void => {
  const { processes: { [id]: process } = {} } = useProcesses();
  const {
    windowStates: { [id]: windowState },
  } = useSession();
  const { size } = windowState || {};
  const { libs } = process || {};
  const {
    sizes: { titleBar },
  } = useTheme();
  const getCanvas = useCallback(
    () =>
      (containerRef.current as HTMLElement)?.querySelector(
        "canvas"
      ) as HTMLCanvasElement,
    [containerRef]
  );

  useEffect(() => {
    // CCModule is created asynchronously in the load effect below. A restored
    // window size can fire this effect before it exists, and reading a property
    // of an undefined window.CCModule throws (optional-chaining the method does
    // not help). Mirror Quake3 and bail until the module is present, avoiding a
    // crash that can bubble to the top boundary and trigger a desktop reload loop.
    if (!window.CCModule) return;

    if (size) {
      window.CCModule.setCanvasSize?.(
        pxToNum(size.width),
        pxToNum(size.height) - titleBar.height
      );
      window.CCModule.OnResize?.();
    }
  }, [getCanvas, size, titleBar.height]);

  useEffect(() => {
    if (window.CCModule) return;

    setTimeout(() => {
      const canvas = getCanvas();

      window.CCModule = {
        arguments: ["Singleplayer"],
        canvas,
        postRun: [
          () => setLoading(false),
          () => {
            const { width, height } = canvas.getBoundingClientRect() || {};

            canvas.width = width;
            canvas.height = height;
          },
        ],
        print: console.info,
        setStatus: console.info,
      };

      loadFiles(libs);
    }, TRANSITIONS_IN_MILLISECONDS.WINDOW);
  }, [getCanvas, libs, setLoading]);
};

export default useClassiCube;
