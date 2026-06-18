/**
 * Data-driven M-x command table and Spacemacs SPC leader bindings.
 *
 * This module holds only *static data* — names, descriptions, and the leader
 * key map. The actual behaviour for each command lives in useEmacs.ts (the
 * runCommand dispatcher). Keeping the table here lets the minibuffer offer
 * M-x completion candidates and lets WhichKey render the leader popup without
 * bloating the hook.
 */

/** A single interactive (M-x) command, used for completion candidates. */
export type CommandEntry = {
  /** Canonical command name, e.g. "query-replace". */
  name: string;
  /** One-line description shown in the echo area during completion. */
  doc: string;
};

/**
 * Every command runCommand() understands. Order here is the completion order.
 * Keep this in sync with the switch in useEmacs.ts#runCommand.
 */
export const COMMANDS: readonly CommandEntry[] = [
  { name: "save-buffer", doc: "Save the current buffer to its file" },
  { name: "find-file", doc: "Visit a file in the current window" },
  { name: "undo", doc: "Undo the last change" },
  { name: "goto-line", doc: "Move point to a given line number" },
  { name: "set-mark-command", doc: "Set the mark at point" },
  { name: "keyboard-quit", doc: "Signal a quit (C-g)" },
  { name: "yank", doc: "Insert the latest kill-ring entry" },
  { name: "yank-pop", doc: "Replace just-yanked text with an earlier kill" },
  { name: "query-replace", doc: "Replace string interactively (sim: replace all)" },
  { name: "replace-string", doc: "Replace all occurrences of a string" },
  { name: "comment-line", doc: "Comment or uncomment the current line" },
  { name: "comment-dwim", doc: "Comment or uncomment the current line" },
  { name: "upcase-word", doc: "Convert the word at point to upper case" },
  { name: "downcase-word", doc: "Convert the word at point to lower case" },
  { name: "capitalize-word", doc: "Capitalize the word at point" },
  { name: "recenter-top-bottom", doc: "Scroll point to the window center" },
  { name: "open-line", doc: "Insert a newline after point" },
  { name: "what-cursor-position", doc: "Describe the character after point" },
  { name: "eval-expression", doc: "Echo a Lisp expression (no evaluation)" },
  { name: "org-agenda", doc: "Build a TODO agenda from the current Org buffer" },
  { name: "org-todo", doc: "Cycle the TODO state of the current headline" },
  { name: "magit-status", doc: "Magit status (simulated, read-only)" },
  { name: "telega", doc: "Open Telega (simulated Telegram client)" },
  { name: "whatsappel", doc: "Open whatsappel (simulated WhatsApp client)" },
  { name: "switch-to-buffer", doc: "Switch to the *scratch* buffer" },
  { name: "describe-bindings", doc: "Echo a summary of key bindings" },
] as const;

/** Return up to `limit` command names that contain `query` (case-insensitive). */
export const completeCommand = (query: string, limit = 8): string[] => {
  const q = query.trim().toLowerCase();

  if (!q) return COMMANDS.slice(0, limit).map((c) => c.name);

  const starts: string[] = [];
  const contains: string[] = [];

  for (const { name } of COMMANDS) {
    const lower = name.toLowerCase();

    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) contains.push(name);
  }

  return [...starts, ...contains].slice(0, limit);
};

/** Look up a command's doc string (for the echo area). */
export const commandDoc = (name: string): string | undefined =>
  COMMANDS.find((c) => c.name === name)?.doc;

/**
 * A leaf or sub-map in the Spacemacs SPC leader. Leaves carry a `command`
 * (resolved through runCommand); branches carry a nested `bindings` map keyed
 * by the next key in the chord.
 */
export type LeaderBinding = {
  /** Display label (e.g. "find-file", "+files"). */
  label: string;
  /** Command to run when this is a leaf. */
  command?: string;
  /** Nested chord map when this is a prefix (e.g. SPC f -> ...). */
  bindings?: Record<string, LeaderBinding>;
};

/**
 * The SPC leader map, modelled on Spacemacs. Each top-level key is the first
 * key pressed after SPC; "+name" labels denote prefixes (sub-maps).
 */
export const LEADER: Record<string, LeaderBinding> = {
  f: {
    label: "+files",
    bindings: {
      f: { label: "find-file", command: "find-file" },
      s: { label: "save-buffer", command: "save-buffer" },
    },
  },
  b: {
    label: "+buffers",
    bindings: {
      b: { label: "switch-to-buffer", command: "switch-to-buffer" },
    },
  },
  g: {
    label: "+git",
    bindings: {
      s: { label: "magit-status", command: "magit-status" },
    },
  },
  a: {
    label: "+applications",
    bindings: {
      t: { label: "telega", command: "telega" },
      w: { label: "whatsappel", command: "whatsappel" },
    },
  },
  o: {
    label: "+org",
    bindings: {
      a: { label: "org-agenda", command: "org-agenda" },
    },
  },
  w: {
    label: "+windows",
    bindings: {
      "/": { label: "split-window-right", command: "recenter-top-bottom" },
    },
  },
};

/** Flatten a leader sub-map into "key -> label" rows for the which-key popup. */
export const leaderRows = (
  map: Record<string, LeaderBinding>
): Array<{ key: string; label: string; isPrefix: boolean }> =>
  Object.entries(map).map(([key, binding]) => ({
    key,
    label: binding.label,
    isPrefix: !!binding.bindings,
  }));
