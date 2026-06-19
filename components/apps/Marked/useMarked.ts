import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import { basename } from "path";
import { useCallback, useEffect } from "react";
import { haltEvent, isYouTubeUrl, loadFiles } from "utils/functions";

type MarkedOptions = {
  headerIds?: boolean;
};

// `Window.DOMPurify` is declared centrally in utils/sanitize.ts.
declare global {
  interface Window {
    marked: {
      parse: (markdownString: string, options: MarkedOptions) => string;
    };
  }
}

const useMarked = (
  id: string,
  url: string,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  loading: boolean
): void => {
  const { readFile } = useFileSystem();
  const { prependFileToTitle } = useTitle(id);
  const { open, processes: { [id]: { libs = [] } = {} } = {} } = useProcesses();
  const loadFile = useCallback(async () => {
    let markdownFile: Buffer;

    try {
      markdownFile = await readFile(url);
    } catch {
      markdownFile = Buffer.from("");
    }

    const container = containerRef.current?.querySelector(
      "article"
    ) as HTMLElement;

    if (container instanceof HTMLElement) {
      container.innerHTML =
        window.DOMPurify?.sanitize(
          window.marked.parse(markdownFile.toString(), {
            headerIds: false,
          })
        ) ?? "";
      container.querySelectorAll("a").forEach((link) =>
        link.addEventListener("click", (event) => {
          haltEvent(event);

          if (isYouTubeUrl(link.href)) {
            open("VideoPlayer", { url: link.href });
          } else {
            window.open(link.href, "_blank", "noopener, noreferrer");
          }
        })
      );
      container.scrollTop = 0;
    }

    prependFileToTitle(basename(url));
  }, [containerRef, open, prependFileToTitle, readFile, url]);

  useEffect(() => {
    if (loading) {
      loadFiles(libs)
        .then(() => {
          if (window.marked) {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    }
  }, [libs, loading, setLoading]);

  useEffect(() => {
    if (!loading && url) loadFile().catch(() => {});
  }, [loadFile, loading, url]);
};

export default useMarked;
