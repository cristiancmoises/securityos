import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api";

export type OpenFile = {
  /** Absolute virtual-FS path of the file. */
  path: string;
  /** Monaco model backing the tab. */
  model: Monaco.editor.ITextModel;
  /** View state (cursor/scroll) so tabs restore where you left them. */
  viewState?: Monaco.editor.ICodeEditorViewState | null;
  /** True when the buffer differs from what's on disk. */
  dirty: boolean;
};

export type TreeNode = {
  name: string;
  path: string;
  directory: boolean;
  /** Loaded lazily when a directory is expanded. */
  children?: TreeNode[];
  expanded?: boolean;
};

export type OutputKind =
  | "log"
  | "info"
  | "warn"
  | "error"
  | "system"
  | "pass"
  | "fail"
  | "result";

export type OutputLine = {
  id: number;
  kind: OutputKind;
  text: string;
};

/** Languages we can actually execute in the in-browser sandbox. */
export type RunnableLanguage = "javascript" | "typescript" | "none";

/** Message protocol between the run sandbox worker and the IDE. */
export type SandboxMessage =
  | { type: "log" | "info" | "warn" | "error"; text: string }
  | { type: "uncaught"; text: string }
  | { type: "pass" | "fail"; text: string }
  | { type: "summary"; passed: number; failed: number }
  | { type: "done" };

declare global {
  interface Window {
    monaco: typeof Monaco;
  }
}
