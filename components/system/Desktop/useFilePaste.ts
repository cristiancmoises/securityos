import { useFileSystem } from "contexts/fileSystem";
import { useEffect } from "react";

// Paste files/images from the OS clipboard straight into the webOS. Ctrl/Cmd+V
// anywhere on the desktop (outside a text field) writes the pasted files — and
// pasted/screenshot images — to the given directory (the Desktop). Lets users
// bring in any file or image without drag-and-drop.
const EXT_BY_TYPE: Record<string, string> = {
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const useFilePaste = (directory: string): void => {
  const { createPath, updateFolder } = useFileSystem();

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent): Promise<void> => {
      const { clipboardData } = event;

      if (!clipboardData) return;

      // Don't hijack paste while the user is editing text somewhere.
      const target = event.target as HTMLElement | null;

      if (target?.closest?.("input, textarea, [contenteditable], select")) {
        return;
      }

      let files: File[] = [...clipboardData.files];

      if (files.length === 0) {
        files = [...clipboardData.items]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));
      }

      if (files.length === 0) return;

      event.preventDefault();

      await files.reduce(async (chain, file, index) => {
        await chain;

        const name =
          file.name ||
          `Pasted ${Date.now()}-${index}.${EXT_BY_TYPE[file.type] || "png"}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const created = await createPath(name, directory, buffer);

        updateFolder(directory, created || name);
      }, Promise.resolve());
    };

    window.addEventListener("paste", onPaste);

    return () => window.removeEventListener("paste", onPaste);
  }, [createPath, directory, updateFolder]);
};

export default useFilePaste;
