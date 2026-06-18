import { completeCommand, LEADER, type LeaderBinding } from "components/apps/Emacs/commands";
import {
  cycleTodo,
  headlineAt,
  lineBounds,
  renderAgenda,
  scanAgenda,
  siblingHeadline,
  subtreeBody,
} from "components/apps/Emacs/orgMode";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import { basename, dirname, extname } from "path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TEXT_FILE_SAVE_PATH } from "utils/constants";

/**
 * A fully self-contained, first-party Emacs-style editor. No WASM, no external
 * libraries, no network — every keybinding, the kill-ring, the mark, undo,
 * incremental search, M-x and the C-x prefix map are implemented here in
 * TypeScript against a controlled <textarea>.
 */

/** Mirror of the textarea's editable state. */
type BufferState = {
  text: string;
  /** Cursor position (== selectionStart, the "point"). */
  point: number;
};

/** What the minibuffer is currently asking the user for (if anything). */
type Prompt =
  | { kind: "find-file"; label: string }
  | { kind: "save-as"; label: string }
  | { kind: "mx"; label: string }
  | { kind: "goto-line"; label: string }
  | { kind: "isearch"; label: string }
  | { kind: "query-replace-from"; label: string }
  | { kind: "query-replace-to"; label: string; from: string }
  | { kind: "eval-expression"; label: string };

export type MinibufferState = {
  /** Plain message shown in the echo area (e.g. "Wrote /path"). */
  message: string;
  /** Active interactive prompt, or undefined when just echoing. */
  prompt?: Prompt;
  /** Current text typed into the prompt's inline input. */
  input: string;
  /** M-x completion candidates shown beneath the prompt. */
  candidates?: string[];
};

/**
 * The "kind" of the active buffer. Text buffers render the <textarea>; the
 * panel kinds render the SIMULATED chat clients instead. This drives index.tsx.
 */
export type BufferKind = "text" | "telega" | "whatsappel";

/** State for the Spacemacs SPC which-key transient popup. */
export type WhichKeyState = {
  /** The chord typed so far, e.g. "SPC" or "SPC f". */
  title: string;
  /** Bindings available at this chord depth. */
  bindings: Record<string, LeaderBinding>;
};

export type ModeLine = {
  modified: boolean;
  bufferName: string;
  majorMode: string;
  line: number;
  column: number;
  /** "Top" | "Bot" | "All" | "NN%". */
  position: string;
  /** Evil-style state badge (cosmetic), e.g. "NORMAL". */
  state: string;
  /** Window number badge (Spacemacs shows this on the left). */
  windowNumber: number;
};

type UseEmacs = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  modeLine: ModeLine;
  minibuffer: MinibufferState;
  /** Which buffer view is active (text vs. simulated panel). */
  bufferKind: BufferKind;
  /** Active which-key transient popup, or undefined when none. */
  whichKey?: WhichKeyState;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSelect: () => void;
  onMinibufferKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onMinibufferChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  minibufferRef: React.RefObject<HTMLInputElement>;
};

/** Maximum number of entries kept on the kill-ring. */
const KILL_RING_MAX = 60;
/** Maximum number of undo snapshots retained. */
const UNDO_MAX = 200;

const SCRATCH_NAME = "*scratch*";
const SCRATCH_TEXT = `;; This buffer is for text that is not saved, and for Lisp evaluation.
;; To create a file, visit it with C-x C-f and enter text in its buffer.

`;

/** Derive an Emacs-style major-mode label from a filename. */
const majorModeFor = (name: string): string => {
  const ext = extname(name).toLowerCase();

  switch (ext) {
    case ".el":
    case ".lisp":
    case ".cl":
      return "Emacs-Lisp";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "JavaScript";
    case ".ts":
    case ".tsx":
      return "TypeScript";
    case ".jsx":
      return "JSX";
    case ".py":
      return "Python";
    case ".c":
    case ".h":
      return "C";
    case ".cpp":
    case ".cc":
    case ".hpp":
      return "C++";
    case ".rs":
      return "Rust";
    case ".go":
      return "Go";
    case ".sh":
    case ".bash":
      return "Shell-script";
    case ".json":
      return "JSON";
    case ".md":
    case ".markdown":
      return "Markdown";
    case ".html":
    case ".htm":
      return "HTML";
    case ".css":
      return "CSS";
    case ".org":
      return "Org";
    case ".txt":
    case "":
      return name === SCRATCH_NAME ? "Lisp Interaction" : "Text";
    default:
      return "Fundamental";
  }
};

/** Word boundary helpers (Emacs treats [A-Za-z0-9_] as word constituents). */
const isWordChar = (ch: string | undefined): boolean =>
  !!ch && /[\w$]/.test(ch);

const forwardWord = (text: string, from: number): number => {
  let i = from;

  while (i < text.length && !isWordChar(text[i])) i += 1;
  while (i < text.length && isWordChar(text[i])) i += 1;

  return i;
};

const backwardWord = (text: string, from: number): number => {
  let i = from;

  while (i > 0 && !isWordChar(text[i - 1])) i -= 1;
  while (i > 0 && isWordChar(text[i - 1])) i -= 1;

  return i;
};

const lineStart = (text: string, point: number): number => {
  const nl = text.lastIndexOf("\n", point - 1);

  return nl === -1 ? 0 : nl + 1;
};

const lineEnd = (text: string, point: number): number => {
  const nl = text.indexOf("\n", point);

  return nl === -1 ? text.length : nl;
};

/** Compute 1-based line and 0-based column for the mode-line. */
const lineColumn = (
  text: string,
  point: number
): { line: number; column: number } => {
  let line = 1;
  let lastNl = -1;

  for (let i = 0; i < point; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      lastNl = i;
    }
  }

  return { line, column: point - lastNl - 1 };
};

/** Move the point up/down one visual line, preserving the goal column. */
const verticalMove = (
  text: string,
  point: number,
  direction: 1 | -1
): number => {
  const start = lineStart(text, point);
  const column = point - start;

  if (direction === -1) {
    if (start === 0) return 0;
    const prevStart = lineStart(text, start - 1);
    const prevEnd = start - 1;

    return Math.min(prevStart + column, prevEnd);
  }

  const end = lineEnd(text, point);

  if (end === text.length) return text.length;
  const nextStart = end + 1;
  const nextEnd = lineEnd(text, nextStart);

  return Math.min(nextStart + column, nextEnd);
};

/** Move by a "page" — roughly the visible textarea height in lines. */
const pageRows = (el: HTMLTextAreaElement | null): number => {
  if (!el) return 20;
  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight) || 16;
  const rows = Math.floor(el.clientHeight / lineHeight) - 2;

  return Math.max(1, rows);
};

const useEmacs = ({ id }: ComponentProcessProps): UseEmacs => {
  const {
    closeWithTransition,
    processes: { [id]: process },
  } = useProcesses();
  const { url = "" } = process || {};
  const { exists, mkdirRecursive, readFile, updateFolder, writeFile } =
    useFileSystem();
  const { prependFileToTitle } = useTitle(id);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const minibufferRef = useRef<HTMLInputElement>(null);

  const [buffer, setBuffer] = useState<BufferState>({
    text: SCRATCH_TEXT,
    point: SCRATCH_TEXT.length,
  });
  const [path, setPath] = useState<string>("");
  const [bufferName, setBufferName] = useState<string>(SCRATCH_NAME);
  const [modified, setModified] = useState<boolean>(false);
  const [bufferKind, setBufferKind] = useState<BufferKind>("text");
  const [whichKey, setWhichKey] = useState<WhichKeyState | undefined>(undefined);
  const [minibuffer, setMinibuffer] = useState<MinibufferState>({
    message: "",
    input: "",
  });

  // Refs for state that the keydown handler reads synchronously.
  const mark = useRef<number | undefined>(undefined);
  const killRing = useRef<string[]>([]);
  const lastKill = useRef<{ at: number; appending: boolean }>({
    at: -1,
    appending: false,
  });
  const undoStack = useRef<BufferState[]>([]);
  const redoStack = useRef<BufferState[]>([]);
  const ctrlX = useRef<boolean>(false);
  const isearch = useRef<{ query: string; origin: number } | undefined>(
    undefined
  );
  const loaded = useRef(false);
  // Pending kill-ring index for M-y (yank-pop); -1 means "no yank yet".
  const yankIndex = useRef<number>(-1);
  const lastYank = useRef<{ start: number; end: number } | undefined>(undefined);
  // Org folding: headline-start -> the stashed (hidden) subtree body text.
  const orgFolds = useRef<Map<number, string>>(new Map());
  // C-c prefix (Org uses C-c C-t etc.).
  const ctrlC = useRef<boolean>(false);
  // The active SPC leader chord path (e.g. ["f"]); empty/undefined = inactive.
  const leaderPath = useRef<string[] | undefined>(undefined);

  /** Echo a plain message to the minibuffer, clearing any prompt. */
  const echo = useCallback((message: string): void => {
    setMinibuffer({ message, input: "" });
  }, []);

  /** Open an interactive prompt in the minibuffer. */
  const openPrompt = useCallback((prompt: Prompt, input = ""): void => {
    setMinibuffer({ message: "", prompt, input });
  }, []);

  /** Push the current buffer onto the undo stack (call before a mutation). */
  const pushUndo = useCallback((state: BufferState): void => {
    const stack = undoStack.current;
    const top = stack[stack.length - 1];

    if (top && top.text === state.text) return;
    stack.push(state);
    if (stack.length > UNDO_MAX) stack.shift();
    redoStack.current = [];
  }, []);

  /** Apply a buffer change and sync the textarea selection + dirty flag. */
  const applyBuffer = useCallback(
    (next: BufferState, markDirty = true): void => {
      setBuffer(next);
      if (markDirty) setModified(true);
      // Defer so React commits the value before we set the selection.
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;

        if (el) {
          el.selectionStart = next.point;
          el.selectionEnd = next.point;
        }
      });
    },
    []
  );

  /** Insert text at the point, replacing any active region. */
  const insertText = useCallback(
    (text: string, start: number, end: number): BufferState => {
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      const next = {
        text: buffer.text.slice(0, lo) + text + buffer.text.slice(hi),
        point: lo + text.length,
      };

      pushUndo(buffer);
      applyBuffer(next);

      return next;
    },
    [applyBuffer, buffer, pushUndo]
  );

  /** Add a string to the kill-ring (optionally appending to the last kill). */
  const kill = useCallback((text: string, append: boolean): void => {
    if (!text) return;
    const ring = killRing.current;

    if (append && ring.length > 0) {
      ring[ring.length - 1] += text;
    } else {
      ring.push(text);
      if (ring.length > KILL_RING_MAX) ring.shift();
    }
  }, []);

  /** Replace a span of buffer text and place point at `caret`. */
  const replaceSpan = useCallback(
    (lo: number, hi: number, replacement: string, caret?: number): BufferState => {
      const next: BufferState = {
        text: buffer.text.slice(0, lo) + replacement + buffer.text.slice(hi),
        point: caret ?? lo + replacement.length,
      };

      pushUndo(buffer);
      applyBuffer(next);

      return next;
    },
    [applyBuffer, buffer, pushUndo]
  );

  /** Replace every occurrence of `from` with `to` in the buffer. */
  const replaceAll = useCallback(
    (from: string, to: string): number => {
      if (!from) return 0;
      const parts = buffer.text.split(from);
      const count = parts.length - 1;

      if (count > 0) replaceSpan(0, buffer.text.length, parts.join(to), 0);

      return count;
    },
    [buffer.text, replaceSpan]
  );

  /** Comment-line comment prefix for the current major mode. */
  const commentPrefixFor = useCallback((): string => {
    const ext = extname(bufferName).toLowerCase();

    switch (ext) {
      case ".el":
      case ".lisp":
      case ".cl":
        return ";; ";
      case ".js":
      case ".mjs":
      case ".cjs":
      case ".ts":
      case ".tsx":
      case ".jsx":
      case ".c":
      case ".h":
      case ".cpp":
      case ".cc":
      case ".hpp":
      case ".rs":
      case ".go":
        return "// ";
      case ".py":
      case ".sh":
      case ".bash":
      case ".yml":
      case ".yaml":
        return "# ";
      case ".css":
        return "/* ";
      case ".html":
      case ".htm":
        return "<!-- ";
      case ".org":
        return "# ";
      default:
        return "# ";
    }
  }, [bufferName]);

  // ---- File operations -----------------------------------------------------

  const saveTo = useCallback(
    async (target: string): Promise<void> => {
      const dest = target.trim();

      if (!dest) {
        echo("No file name");

        return;
      }

      try {
        const folder = dirname(dest);

        if (folder && folder !== "." && !(await exists(folder))) {
          try {
            await mkdirRecursive(folder);
          } catch {
            // Ignore — writeFile may still succeed (or fail and echo below).
          }
        }
        await writeFile(dest, Buffer.from(buffer.text), true);
        updateFolder(dirname(dest), basename(dest));
        setPath(dest);
        setBufferName(basename(dest));
        setModified(false);
        prependFileToTitle(basename(dest));
        echo(`Wrote ${dest}`);
      } catch {
        echo(`Cannot write ${dest}`);
      }
    },
    [
      buffer.text,
      echo,
      exists,
      mkdirRecursive,
      prependFileToTitle,
      updateFolder,
      writeFile,
    ]
  );

  const findFile = useCallback(
    async (target: string): Promise<void> => {
      const src = target.trim();

      if (!src) {
        echo("No file name");

        return;
      }

      try {
        if (await exists(src)) {
          const data = await readFile(src);
          const text = data.toString();

          undoStack.current = [];
          redoStack.current = [];
          mark.current = undefined;
          orgFolds.current = new Map();
          setBufferKind("text");
          setBuffer({ text, point: 0 });
          setPath(src);
          setBufferName(basename(src));
          setModified(false);
          prependFileToTitle(basename(src));
          echo(`Visiting ${src}`);
        } else {
          undoStack.current = [];
          redoStack.current = [];
          mark.current = undefined;
          orgFolds.current = new Map();
          setBufferKind("text");
          setBuffer({ text: "", point: 0 });
          setPath(src);
          setBufferName(basename(src));
          setModified(false);
          prependFileToTitle(basename(src));
          echo(`(New file) ${src}`);
        }
        window.requestAnimationFrame(() => textareaRef.current?.focus());
      } catch {
        echo(`Cannot open ${src}`);
      }
    },
    [echo, exists, prependFileToTitle, readFile]
  );

  const saveBuffer = useCallback((): void => {
    if (path) {
      saveTo(path);
    } else {
      openPrompt(
        { kind: "save-as", label: "File to save in: " },
        DEFAULT_TEXT_FILE_SAVE_PATH
      );
      window.requestAnimationFrame(() => minibufferRef.current?.focus());
    }
  }, [openPrompt, path, saveTo]);

  // ---- Initial buffer load -------------------------------------------------

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    if (url) {
      findFile(url);
    } else {
      prependFileToTitle(SCRATCH_NAME);
      echo(
        "Welcome to GNU Emacs. C-x C-f to open, C-x C-s to save, C-x C-c to quit."
      );
    }
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- The big keydown dispatcher -----------------------------------------

  const undo = useCallback((): void => {
    const prev = undoStack.current.pop();

    if (!prev) {
      echo("No further undo information");

      return;
    }
    redoStack.current.push(buffer);
    setBuffer(prev);
    setModified(true);
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;

      if (el) {
        el.selectionStart = prev.point;
        el.selectionEnd = prev.point;
      }
    });
    echo("Undo!");
  }, [buffer, echo]);

  const moveTo = useCallback((point: number): void => {
    const el = textareaRef.current;

    if (!el) return;
    const clamped = Math.max(0, Math.min(point, el.value.length));

    el.selectionStart = clamped;
    el.selectionEnd = clamped;
    setBuffer((b) => ({ ...b, point: clamped }));
  }, []);

  /** Open one of the SIMULATED chat panels as the active buffer. */
  const openPanel = useCallback(
    (kind: "telega" | "whatsappel"): void => {
      setBufferKind(kind);
      setBufferName(kind === "telega" ? "*Telega*" : "*whatsappel*");
      setModified(false);
      prependFileToTitle(kind === "telega" ? "*Telega*" : "*whatsappel*");
      echo(
        kind === "telega"
          ? "Opened *Telega* (SIMULATED — offline, no Telegram connection)"
          : "Opened *whatsappel* (SIMULATED — offline, no WhatsApp connection)"
      );
    },
    [echo, prependFileToTitle]
  );

  /** Return from a panel buffer to the scratch text buffer. */
  const switchToScratch = useCallback((): void => {
    setBufferKind("text");
    orgFolds.current = new Map();
    undoStack.current = [];
    redoStack.current = [];
    mark.current = undefined;
    setBuffer({ text: SCRATCH_TEXT, point: SCRATCH_TEXT.length });
    setPath("");
    setBufferName(SCRATCH_NAME);
    setModified(false);
    prependFileToTitle(SCRATCH_NAME);
    echo(SCRATCH_NAME);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [echo, prependFileToTitle]);

  /** Build a read-only Org agenda from the current buffer into a new buffer. */
  const orgAgenda = useCallback((): void => {
    const items = scanAgenda(buffer.text);
    const report = renderAgenda(items, bufferName);

    setBufferKind("text");
    orgFolds.current = new Map();
    undoStack.current = [];
    redoStack.current = [];
    mark.current = undefined;
    setBuffer({ text: report, point: 0 });
    setPath("");
    setBufferName("*Org Agenda*");
    setModified(false);
    prependFileToTitle("*Org Agenda*");
    echo(`Org agenda: ${items.length} item(s)`);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [buffer.text, bufferName, echo, prependFileToTitle]);

  /**
   * Run a named M-x command.
   *  - "opened-prompt": the command replaced the minibuffer with its own prompt
   *    (the caller must NOT clobber it or steal focus back to the buffer).
   *  - "done": the command ran and the minibuffer should return to the buffer.
   *  - "unknown": no such command.
   */
  const runCommand = useCallback(
    (name: string): "opened-prompt" | "done" | "unknown" => {
      switch (name) {
        case "save-buffer":
          // save-buffer either writes (path known) or opens a save-as prompt.
          if (path) {
            saveTo(path);

            return "done";
          }
          saveBuffer();

          return "opened-prompt";
        case "find-file":
          openPrompt({ kind: "find-file", label: "Find file: " });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());

          return "opened-prompt";
        case "undo":
          undo();

          return "done";
        case "goto-line":
          openPrompt({ kind: "goto-line", label: "Goto line: " });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());

          return "opened-prompt";
        case "set-mark-command": {
          const p = textareaRef.current?.selectionStart ?? buffer.point;

          mark.current = p;
          echo("Mark set");

          return "done";
        }
        case "keyboard-quit":
          echo("Quit");

          return "done";
        case "yank": {
          const el = textareaRef.current;
          const at = el?.selectionStart ?? buffer.point;
          const end = el?.selectionEnd ?? buffer.point;
          const yanked = killRing.current[killRing.current.length - 1] ?? "";

          if (yanked) {
            const next = replaceSpan(
              Math.min(at, end),
              Math.max(at, end),
              yanked
            );

            yankIndex.current = killRing.current.length - 1;
            lastYank.current = { start: Math.min(at, end), end: next.point };
          } else {
            echo("Kill ring is empty");
          }

          return "done";
        }
        case "query-replace":
        case "replace-string":
          openPrompt({ kind: "query-replace-from", label: "Replace string: " });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());

          return "opened-prompt";
        case "comment-line":
        case "comment-dwim": {
          const el = textareaRef.current;
          const p = el?.selectionStart ?? buffer.point;
          const { start, end } = lineBounds(buffer.text, p);
          const line = buffer.text.slice(start, end);
          const prefix = commentPrefixFor();
          const trimmedPrefix = prefix.trimEnd();

          if (line.trimStart().startsWith(trimmedPrefix)) {
            const uncommented = line.replace(
              new RegExp(`^(\\s*)${trimmedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s?`),
              "$1"
            );

            replaceSpan(start, end, uncommented);
          } else {
            const indentMatch = /^\s*/.exec(line);
            const indent = indentMatch ? indentMatch[0] : "";

            replaceSpan(start, end, `${indent}${prefix}${line.slice(indent.length)}`);
          }

          return "done";
        }
        case "upcase-word":
        case "downcase-word":
        case "capitalize-word": {
          const el = textareaRef.current;
          const p = el?.selectionStart ?? buffer.point;
          const t = buffer.text;
          let i = p;

          while (i < t.length && !/[\w$]/.test(t[i])) i += 1;
          let j = i;

          while (j < t.length && /[\w$]/.test(t[j])) j += 1;
          if (j <= i) {
            echo("No word at point");

            return "done";
          }
          const word = t.slice(i, j);
          let result = word;

          if (name === "upcase-word") result = word.toUpperCase();
          else if (name === "downcase-word") result = word.toLowerCase();
          else result = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          replaceSpan(i, j, result, j);

          return "done";
        }
        case "recenter-top-bottom": {
          const el = textareaRef.current;

          if (el) {
            const style = window.getComputedStyle(el);
            const lineHeight = Number.parseFloat(style.lineHeight) || 16;
            const before = el.value.slice(0, el.selectionStart).split("\n").length;
            const target = (before - 1) * lineHeight - el.clientHeight / 2;

            el.scrollTop = Math.max(0, target);
          }
          echo("Recenter");

          return "done";
        }
        case "open-line": {
          const el = textareaRef.current;
          const p = el?.selectionStart ?? buffer.point;

          replaceSpan(p, p, "\n", p);

          return "done";
        }
        case "what-cursor-position": {
          const el = textareaRef.current;
          const p = el?.selectionStart ?? buffer.point;
          const ch = buffer.text[p];
          const total = buffer.text.length;
          const pct = total ? Math.round((p / total) * 100) : 0;

          if (ch === undefined) {
            echo(`point=${p + 1} of ${total} (EOB) column=${lineColumn(buffer.text, p).column}`);
          } else {
            const code = ch.codePointAt(0) ?? 0;

            echo(
              `Char: ${ch === "\n" ? "\\n" : ch} (#o${code.toString(8)} #d${code} #x${code.toString(16)}) point=${p + 1} of ${total} (${pct}%) column=${lineColumn(buffer.text, p).column}`
            );
          }

          return "done";
        }
        case "eval-expression":
          openPrompt({
            kind: "eval-expression",
            label: "Eval (echo only): ",
          });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());

          return "opened-prompt";
        case "org-agenda":
          orgAgenda();

          return "done";
        case "org-todo": {
          const el = textareaRef.current;
          const p = el?.selectionStart ?? buffer.point;
          const { start, end } = lineBounds(buffer.text, p);
          const line = buffer.text.slice(start, end);
          const next = cycleTodo(line);

          if (next === line) {
            echo("Not on an Org headline");
          } else {
            replaceSpan(start, end, next, start + next.length);
          }

          return "done";
        }
        case "magit-status":
          echo(
            "Magit (SIMULATED): On branch main · nothing to commit, working tree clean"
          );

          return "done";
        case "telega":
          openPanel("telega");

          return "done";
        case "whatsappel":
          openPanel("whatsappel");

          return "done";
        case "switch-to-buffer":
          switchToScratch();

          return "done";
        case "describe-bindings":
          echo(
            "C-x C-f find · C-x C-s save · M-x cmd · C-s search · M-w copy · C-w cut · C-y yank · M-y yank-pop · SPC leader"
          );

          return "done";
        default:
          return "unknown";
      }
    },
    [
      buffer.point,
      buffer.text,
      commentPrefixFor,
      echo,
      openPanel,
      openPrompt,
      orgAgenda,
      path,
      replaceSpan,
      saveBuffer,
      saveTo,
      switchToScratch,
      undo,
    ]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      const el = event.currentTarget;
      const text = el.value;
      const point = el.selectionStart;
      const selEnd = el.selectionEnd;
      const { ctrlKey, altKey, metaKey, shiftKey, key } = event;
      const ctrl = ctrlKey || metaKey;

      const handled = (): void => {
        event.preventDefault();
        event.stopPropagation();
      };

      // Consecutive kills at the same point append onto the same ring entry
      // (so repeated C-k builds up one kill, like real Emacs).
      const recordKill = (str: string): void => {
        const sameSpot = lastKill.current.at === point;

        kill(str, sameSpot && lastKill.current.appending);
        lastKill.current = { at: point, appending: true };
      };

      const notKillCommand = (): void => {
        lastKill.current = { at: -1, appending: false };
      };

      // Ignore bare modifier presses (Control/Alt/Shift/Meta on their own) so
      // they never trip the "undefined" echo or reset the C-x prefix.
      if (
        key === "Control" ||
        key === "Alt" ||
        key === "Shift" ||
        key === "Meta" ||
        key === "CapsLock"
      ) {
        return;
      }

      // ---- Spacemacs SPC leader (which-key) ----
      // Resolve one key inside the current leader chord.
      const stepLeader = (k: string): void => {
        const node = leaderPath.current ?? [];
        let map: Record<string, LeaderBinding> = LEADER;

        for (const seg of node) {
          const nested = map[seg]?.bindings;

          if (!nested) {
            leaderPath.current = undefined;
            setWhichKey(undefined);

            return;
          }
          map = nested;
        }

        const binding = map[k];

        if (!binding) {
          leaderPath.current = undefined;
          setWhichKey(undefined);
          echo(`SPC ${[...node, k].join(" ")} is undefined`);

          return;
        }
        if (binding.command) {
          leaderPath.current = undefined;
          setWhichKey(undefined);
          runCommand(binding.command);

          return;
        }
        // Descend into a sub-map and refresh the which-key popup.
        const nextPath = [...node, k];

        leaderPath.current = nextPath;
        setWhichKey({
          title: `SPC ${nextPath.join(" ")}`,
          bindings: binding.bindings ?? {},
        });
      };

      // If a leader chord is in progress, route the next printable key into it.
      if (leaderPath.current) {
        if (key === "Escape") {
          handled();
          leaderPath.current = undefined;
          setWhichKey(undefined);
          echo("Quit");

          return;
        }
        if (key.length === 1 && !ctrl && !altKey) {
          handled();
          stepLeader(key);

          return;
        }
      }

      const { start: curLineStart, end: curLineEnd } = lineBounds(text, point);
      const lineIsBlank = text.slice(curLineStart, curLineEnd).trim() === "";

      // SPC on a blank line, or M-m anywhere, opens the leader popup.
      if (
        (key === " " && !ctrl && !altKey && lineIsBlank) ||
        (altKey && key === "m")
      ) {
        handled();
        notKillCommand();
        leaderPath.current = [];
        setWhichKey({ title: "SPC", bindings: LEADER });

        return;
      }

      // ---- C-c prefix map (Org: C-c C-t cycles TODO) ----
      if (ctrlC.current) {
        ctrlC.current = false;
        notKillCommand();

        if (ctrl && (key === "t" || key === "T")) {
          handled();
          runCommand("org-todo");

          return;
        }
        if (ctrl && (key === "c" || key === "C")) {
          handled();
          echo("C-c C-c");

          return;
        }
        handled();
        echo(`C-c ${ctrl ? "C-" : ""}${key} is undefined`);

        return;
      }
      if (ctrl && key === "c") {
        handled();
        ctrlC.current = true;
        echo("C-c-");

        return;
      }

      // ---- Org TAB / S-TAB folding & M-RET ----
      const isOrg = extname(bufferName).toLowerCase() === ".org";

      if (isOrg && key === "Tab" && !ctrl && !altKey) {
        const headline = headlineAt(text, point);

        if (shiftKey) {
          // S-TAB: global cycle — unfold all if anything folded, else fold all.
          handled();
          notKillCommand();
          if (orgFolds.current.size > 0) {
            // Unfold everything by re-expanding stashed bodies from the bottom up.
            const entries = [...orgFolds.current.entries()].sort(
              (a, b) => b[0] - a[0]
            );
            let next = text;

            for (const [hlStart, body] of entries) {
              const { end } = lineBounds(next, hlStart);
              const insertAt = end < next.length ? end + 1 : end;

              next = next.slice(0, insertAt) + body + next.slice(insertAt);
            }
            orgFolds.current = new Map();
            replaceSpan(0, text.length, next, Math.min(point, next.length));
            echo("OVERVIEW -> SHOW ALL");
          } else {
            echo("Org: nothing folded (S-TAB)");
          }

          return;
        }
        if (headline) {
          handled();
          notKillCommand();
          if (orgFolds.current.has(headline.start)) {
            // Unfold this subtree: restore the stashed body after the headline.
            const body = orgFolds.current.get(headline.start) ?? "";

            orgFolds.current.delete(headline.start);
            const insertAt = headline.lineEnd;

            replaceSpan(insertAt, insertAt, body, headline.start);
            echo("FOLDED -> CHILDREN");
          } else {
            const bodyRange = subtreeBody(text, headline);
            const body = text.slice(bodyRange.start, bodyRange.end);

            if (body.trim() === "") {
              echo("Org: empty subtree");
            } else {
              orgFolds.current.set(headline.start, body);
              replaceSpan(bodyRange.start, bodyRange.end, "", headline.start);
              echo("CHILDREN -> FOLDED");
            }
          }

          return;
        }
        // Non-headline TAB in Org falls through to literal tab insertion below.
      }

      if (isOrg && altKey && key === "Enter") {
        handled();
        notKillCommand();
        const headline = headlineAt(text, point);
        const level = headline ? headline.level : 1;
        const eol = lineEnd(text, point);
        const insertion = `\n${siblingHeadline(level)}`;

        replaceSpan(eol, eol, insertion, eol + insertion.length);
        echo("Org: inserted headline");

        return;
      }

      // ---- C-x prefix map ----
      if (ctrlX.current) {
        ctrlX.current = false;
        notKillCommand();

        if (ctrl && (key === "s" || key === "S")) {
          handled();
          saveBuffer();

          return;
        }
        if (ctrl && (key === "f" || key === "F")) {
          handled();
          openPrompt({ kind: "find-file", label: "Find file: " });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());

          return;
        }
        if (ctrl && (key === "c" || key === "C")) {
          handled();
          closeWithTransition(id);

          return;
        }
        // Unknown C-x sequence.
        handled();
        echo(`C-x ${key} is undefined`);

        return;
      }

      // ---- C-g keyboard-quit ----
      if (ctrl && key === "g") {
        handled();
        ctrlX.current = false;
        ctrlC.current = false;
        leaderPath.current = undefined;
        setWhichKey(undefined);
        mark.current = undefined;
        isearch.current = undefined;
        setMinibuffer({ message: "Quit", input: "" });
        notKillCommand();

        return;
      }

      // ---- Start C-x prefix ----
      if (ctrl && key === "x") {
        handled();
        ctrlX.current = true;
        echo("C-x-");

        return;
      }

      // ---- M-x ----
      if (altKey && key === "x") {
        handled();
        notKillCommand();
        openPrompt({ kind: "mx", label: "M-x " });
        window.requestAnimationFrame(() => minibufferRef.current?.focus());

        return;
      }

      // ---- Incremental search (C-s) ----
      if (ctrl && key === "s") {
        handled();
        notKillCommand();
        if (isearch.current) {
          // Find next occurrence of the existing query.
          const { query } = isearch.current;

          if (query) {
            const next = text.indexOf(query, point + 1);
            const wrapped = next === -1 ? text.indexOf(query) : next;

            if (wrapped !== -1) {
              el.selectionStart = wrapped;
              el.selectionEnd = wrapped + query.length;
              setBuffer((b) => ({ ...b, point: wrapped + query.length }));
            } else {
              echo(`Failing I-search: ${query}`);
            }
          }
        } else {
          isearch.current = { query: "", origin: point };
          openPrompt({ kind: "isearch", label: "I-search: " });
          window.requestAnimationFrame(() => minibufferRef.current?.focus());
        }

        return;
      }

      // ---- Set mark (C-Space) ----
      if (ctrl && (key === " " || key === "@")) {
        handled();
        notKillCommand();
        mark.current = point;
        echo("Mark set");

        return;
      }

      // ---- Movement ----
      if (ctrl && key === "f") {
        handled();
        notKillCommand();
        moveTo(point + 1);

        return;
      }
      if (ctrl && key === "b") {
        handled();
        notKillCommand();
        moveTo(point - 1);

        return;
      }
      if (ctrl && key === "n") {
        handled();
        notKillCommand();
        moveTo(verticalMove(text, point, 1));

        return;
      }
      if (ctrl && key === "p") {
        handled();
        notKillCommand();
        moveTo(verticalMove(text, point, -1));

        return;
      }
      if (ctrl && key === "a") {
        handled();
        notKillCommand();
        moveTo(lineStart(text, point));

        return;
      }
      if (ctrl && key === "e") {
        handled();
        notKillCommand();
        moveTo(lineEnd(text, point));

        return;
      }
      if (ctrl && key === "v") {
        handled();
        notKillCommand();
        let p = point;

        for (let i = 0; i < pageRows(el); i += 1) p = verticalMove(text, p, 1);
        moveTo(p);

        return;
      }
      if (altKey && key === "v") {
        handled();
        notKillCommand();
        let p = point;

        for (let i = 0; i < pageRows(el); i += 1) p = verticalMove(text, p, -1);
        moveTo(p);

        return;
      }
      if (altKey && key === "f") {
        handled();
        notKillCommand();
        moveTo(forwardWord(text, point));

        return;
      }
      if (altKey && key === "b") {
        handled();
        notKillCommand();
        moveTo(backwardWord(text, point));

        return;
      }
      if (altKey && (key === "<" || (shiftKey && key === ","))) {
        handled();
        notKillCommand();
        moveTo(0);

        return;
      }
      if (altKey && (key === ">" || (shiftKey && key === "."))) {
        handled();
        notKillCommand();
        moveTo(text.length);

        return;
      }

      // ---- Editing ----
      if (ctrl && key === "d") {
        handled();
        notKillCommand();
        if (point < text.length) {
          insertText("", point, point + 1);
        }

        return;
      }
      if (ctrl && key === "k") {
        handled();
        const eol = lineEnd(text, point);
        // Kill to end of line; if already at EOL, kill the newline.
        const killEnd = eol === point ? Math.min(point + 1, text.length) : eol;
        const killed = text.slice(point, killEnd);

        recordKill(killed);
        insertText("", point, killEnd);

        return;
      }
      if (ctrl && key === "y") {
        handled();
        notKillCommand();
        const ring = killRing.current;
        const yanked = ring[ring.length - 1] ?? "";

        if (yanked) {
          const next = insertText(yanked, point, selEnd);

          // Record the yank span so a following M-y (yank-pop) can replace it.
          yankIndex.current = ring.length - 1;
          lastYank.current = { start: Math.min(point, selEnd), end: next.point };
        } else {
          echo("Kill ring is empty");
        }

        return;
      }
      // ---- M-y yank-pop: cycle the kill-ring, replacing the just-yanked text ----
      if (altKey && key === "y") {
        handled();
        notKillCommand();
        const ring = killRing.current;

        if (!lastYank.current || ring.length === 0) {
          echo("Previous command was not a yank");

          return;
        }
        yankIndex.current =
          (yankIndex.current - 1 + ring.length) % ring.length;
        const replacement = ring[yankIndex.current] ?? "";
        const { start, end } = lastYank.current;
        const next = replaceSpan(start, end, replacement);

        lastYank.current = { start, end: next.point };
        echo(`Yank-pop (${yankIndex.current + 1}/${ring.length})`);

        return;
      }
      // ---- C-l recenter ----
      if (ctrl && key === "l") {
        handled();
        notKillCommand();
        runCommand("recenter-top-bottom");

        return;
      }
      // ---- C-o open-line ----
      if (ctrl && key === "o") {
        handled();
        notKillCommand();
        insertText("\n", point, selEnd);
        moveTo(point);

        return;
      }
      // ---- M-; comment-line ----
      if (altKey && (key === ";" || key === ":")) {
        handled();
        notKillCommand();
        runCommand("comment-line");

        return;
      }
      // ---- M-u / M-l / M-c case commands ----
      if (altKey && key === "u") {
        handled();
        notKillCommand();
        runCommand("upcase-word");

        return;
      }
      if (altKey && key === "l") {
        handled();
        notKillCommand();
        runCommand("downcase-word");

        return;
      }
      if (altKey && key === "c") {
        handled();
        notKillCommand();
        runCommand("capitalize-word");

        return;
      }
      if (ctrl && key === "w") {
        handled();
        if (mark.current === undefined) {
          echo("The mark is not set now, so there is no region");

          return;
        }
        const lo = Math.min(mark.current, point);
        const hi = Math.max(mark.current, point);

        kill(text.slice(lo, hi), false);
        mark.current = undefined;
        insertText("", lo, hi);
        notKillCommand();

        return;
      }
      if (altKey && key === "w") {
        handled();
        notKillCommand();
        if (mark.current === undefined) {
          echo("The mark is not set now, so there is no region");

          return;
        }
        const lo = Math.min(mark.current, point);
        const hi = Math.max(mark.current, point);

        kill(text.slice(lo, hi), false);
        mark.current = undefined;
        echo("Region copied");

        return;
      }
      if (ctrl && (key === "/" || key === "_")) {
        handled();
        notKillCommand();
        undo();

        return;
      }
      if (ctrl && key === "j") {
        handled();
        notKillCommand();
        // newline (indentation kept minimal — match current line's leading ws).
        const ls = lineStart(text, point);
        const indentMatch = /^[ \t]*/.exec(text.slice(ls, point));
        const indent = indentMatch ? indentMatch[0] : "";

        insertText(`\n${indent}`, point, selEnd);

        return;
      }

      // ---- Plain Enter: newline ----
      if (key === "Enter" && !ctrl && !altKey) {
        handled();
        notKillCommand();
        insertText("\n", point, selEnd);

        return;
      }

      // ---- Tab inserts a literal tab (avoid focus loss) ----
      if (key === "Tab" && !ctrl && !altKey) {
        handled();
        notKillCommand();
        insertText("\t", point, selEnd);

        return;
      }

      // ---- Plain self-inserting characters & Backspace/Delete/arrows ----
      // Let the textarea handle these natively, but keep our buffer in sync via
      // onChange. Reset kill state for any non-kill command.
      if (!ctrl && !altKey) {
        notKillCommand();
        // Arrows just move; sync point via onSelect afterwards.

        return;
      }

      // Unhandled C-/M- combos: swallow to avoid browser shortcuts leaking in.
      if (ctrl || altKey) {
        // Allow copy/paste/select-all/cut to pass through for usability.
        if (
          ctrl &&
          (key === "c" || key === "v" || key === "a" || key === "z")
        ) {
          return;
        }
        // Let modified navigation/editing keys behave natively (C-Home, etc.);
        // onSelect/onChange keep our buffer state in sync afterwards.
        if (key.length !== 1) return;
        handled();
        echo(`${ctrl ? "C-" : ""}${altKey ? "M-" : ""}${key} is undefined`);
      }
    },
    [
      bufferName,
      closeWithTransition,
      echo,
      id,
      insertText,
      kill,
      moveTo,
      openPrompt,
      replaceSpan,
      runCommand,
      saveBuffer,
      undo,
    ]
  );

  // ---- Native textarea change (self-insert, paste, backspace) -------------

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const el = event.currentTarget;

      // Snapshot for undo only when the change is "large" (paste/cut) or a
      // word boundary; otherwise coalesce keystrokes for snappy typing.
      const prevText = buffer.text;
      const nextText = el.value;
      const diff = Math.abs(nextText.length - prevText.length);
      const boundary =
        diff > 1 ||
        /\s/.test(nextText[el.selectionStart - 1] ?? "") ||
        nextText.length < prevText.length;

      if (boundary) pushUndo({ text: prevText, point: buffer.point });
      setBuffer({ text: nextText, point: el.selectionStart });
      setModified(true);
    },
    [buffer.point, buffer.text, pushUndo]
  );

  const onSelect = useCallback((): void => {
    const el = textareaRef.current;

    if (el) setBuffer((b) => ({ ...b, point: el.selectionStart }));
  }, []);

  // ---- Minibuffer interaction ---------------------------------------------

  const onMinibufferChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const input = event.currentTarget.value;

      setMinibuffer((m) => ({
        ...m,
        input,
        // Live M-x completion candidates as the user types.
        candidates:
          m.prompt?.kind === "mx" ? completeCommand(input) : undefined,
      }));

      // Live incremental search as the user types.
      if (isearch.current) {
        const el = textareaRef.current;

        if (el && input) {
          const found = el.value.indexOf(input, isearch.current.origin);
          const wrapped = found === -1 ? el.value.indexOf(input) : found;

          if (wrapped !== -1) {
            el.selectionStart = wrapped;
            el.selectionEnd = wrapped + input.length;
            setBuffer((b) => ({ ...b, point: wrapped + input.length }));
          }
        }
        isearch.current = { ...isearch.current, query: input };
      }
    },
    []
  );

  const closeMinibuffer = useCallback((msg = ""): void => {
    isearch.current = undefined;
    setMinibuffer({ message: msg, input: "" });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const onMinibufferKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      const { key, ctrlKey, metaKey } = event;
      const ctrl = ctrlKey || metaKey;
      const current = minibuffer.prompt;
      const input = minibuffer.input;

      // C-g / Esc cancel any prompt.
      if (key === "Escape" || (ctrl && key === "g")) {
        event.preventDefault();
        if (isearch.current) {
          const { origin } = isearch.current;

          moveTo(origin);
        }
        closeMinibuffer(isearch.current ? "" : "Quit");

        return;
      }

      // C-s during isearch -> next match.
      if (isearch.current && ctrl && key === "s") {
        event.preventDefault();
        const el = textareaRef.current;
        const query = isearch.current.query;

        if (el && query) {
          const from = el.selectionEnd;
          const found = el.value.indexOf(query, from);
          const wrapped = found === -1 ? el.value.indexOf(query) : found;

          if (wrapped !== -1) {
            el.selectionStart = wrapped;
            el.selectionEnd = wrapped + query.length;
            setBuffer((b) => ({ ...b, point: wrapped + query.length }));
          }
        }

        return;
      }

      // TAB completes the M-x command name to the best candidate.
      if (key === "Tab" && current?.kind === "mx") {
        event.preventDefault();
        const candidates = completeCommand(input, 50);

        if (candidates.length === 0) {
          setMinibuffer((m) => ({ ...m, message: "[No match]" }));
        } else if (candidates.length === 1) {
          setMinibuffer((m) => ({
            ...m,
            input: candidates[0],
            candidates,
          }));
        } else {
          // Complete to the longest common prefix shared by all candidates.
          let prefix = candidates[0];

          for (const c of candidates) {
            while (!c.toLowerCase().startsWith(prefix.toLowerCase())) {
              prefix = prefix.slice(0, -1);
            }
          }
          setMinibuffer((m) => ({
            ...m,
            input: prefix.length > input.length ? prefix : input,
            candidates,
          }));
        }

        return;
      }

      if (key !== "Enter") return;
      event.preventDefault();

      if (!current) {
        closeMinibuffer();

        return;
      }

      switch (current.kind) {
        case "find-file":
          findFile(input);
          setMinibuffer({ message: "", input: "" });
          break;
        case "save-as":
          saveTo(input);
          setMinibuffer({ message: "", input: "" });
          window.requestAnimationFrame(() => textareaRef.current?.focus());
          break;
        case "query-replace-from": {
          if (!input) {
            closeMinibuffer("Empty search string");
            break;
          }
          openPrompt(
            { kind: "query-replace-to", label: `Replace "${input}" with: `, from: input }
          );
          window.requestAnimationFrame(() => minibufferRef.current?.focus());
          break;
        }
        case "query-replace-to": {
          const n = replaceAll(current.from, input);

          closeMinibuffer(
            n > 0 ? `Replaced ${n} occurrence${n === 1 ? "" : "s"}` : "No matches"
          );
          break;
        }
        case "eval-expression":
          // SAFETY: we DO NOT evaluate untrusted input. We only echo it back,
          // exactly as typed, to keep the offline engine sandboxed.
          closeMinibuffer(input ? `${input}  ;; (not evaluated)` : "");
          break;
        case "mx": {
          const result = runCommand(input.trim());

          if (result === "unknown") {
            echo(`No command named "${input.trim()}"`);
            window.requestAnimationFrame(() => textareaRef.current?.focus());
          } else if (result === "done") {
            // The command already echoed/acted; return focus to the buffer.
            // (echo() inside the command set the message; just clear the prompt.)
            setMinibuffer((m) =>
              m.prompt?.kind === "mx" ? { ...m, prompt: undefined } : m
            );
            window.requestAnimationFrame(() => textareaRef.current?.focus());
          }
          // result === "opened-prompt": leave the new prompt + its focus alone.
          break;
        }
        case "goto-line": {
          const n = Number.parseInt(input, 10);

          if (Number.isFinite(n) && n >= 1) {
            const el = textareaRef.current;

            if (el) {
              let pos = 0;
              let lineNo = 1;

              while (lineNo < n) {
                const nl = el.value.indexOf("\n", pos);

                if (nl === -1) {
                  pos = el.value.length;
                  break;
                }
                pos = nl + 1;
                lineNo += 1;
              }
              moveTo(pos);
            }
            closeMinibuffer();
          } else {
            echo("Invalid line number");
            closeMinibuffer();
          }
          break;
        }
        case "isearch":
          closeMinibuffer();
          break;
        default:
          closeMinibuffer();
      }
    },
    [
      closeMinibuffer,
      echo,
      findFile,
      minibuffer.input,
      minibuffer.prompt,
      moveTo,
      openPrompt,
      replaceAll,
      runCommand,
      saveTo,
    ]
  );

  // ---- Derived mode-line ---------------------------------------------------

  const modeLine = useMemo<ModeLine>(() => {
    const { line, column } = lineColumn(buffer.text, buffer.point);
    const total = buffer.text.length;
    let position = "All";

    if (total > 0) {
      const atTop = buffer.point === 0;
      const atBot = buffer.point >= total;

      if (atTop && atBot) {
        position = "All";
      } else if (atTop) {
        position = "Top";
      } else if (atBot) {
        position = "Bot";
      } else {
        position = `${Math.round((buffer.point / total) * 100)}%`;
      }
    }

    const majorMode =
      bufferKind === "telega"
        ? "Telega"
        : bufferKind === "whatsappel"
          ? "Whatsappel"
          : majorModeFor(bufferName);

    return {
      modified,
      bufferName,
      majorMode,
      line,
      column,
      position,
      // Cosmetic evil-style state badge (no real modal editing is implemented).
      state: bufferKind === "text" ? "NORMAL" : "EMACS",
      windowNumber: 1,
    };
  }, [buffer.point, buffer.text, bufferKind, bufferName, modified]);

  return {
    textareaRef,
    value: buffer.text,
    modeLine,
    minibuffer,
    bufferKind,
    whichKey,
    onKeyDown,
    onChange,
    onSelect,
    onMinibufferKeyDown,
    onMinibufferChange,
    minibufferRef,
  };
};

export default useEmacs;
