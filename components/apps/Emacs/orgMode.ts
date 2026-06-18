/**
 * Org-mode text behaviours that operate on the single <textarea> source string.
 *
 * No rich rendering: everything here is plain string surgery so the textarea
 * stays the source of truth. Folding is simulated by appending a visible
 * ellipsis marker to a headline and stashing the hidden body separately (the
 * hook tracks the stash); the helpers here only locate structure.
 */

/** TODO keyword cycle used by C-c C-t. */
export const TODO_KEYWORDS = ["TODO", "DOING", "DONE"] as const;
export type TodoKeyword = (typeof TODO_KEYWORDS)[number];

const HEADLINE_RE = /^(\*+)\s+(.*)$/;
const TODO_RE = /^(\*+)\s+(TODO|DOING|DONE)\b\s*(.*)$/;

export type Headline = {
  /** Index of the first character of the headline line. */
  start: number;
  /** Index just past the headline's trailing newline (or text end). */
  lineEnd: number;
  /** Number of leading asterisks (depth). */
  level: number;
  /** Headline text after the stars (may include a TODO keyword). */
  title: string;
  /** TODO keyword if present, else undefined. */
  todo?: TodoKeyword;
};

/** Find the bounds of the line containing `point`. */
export const lineBounds = (
  text: string,
  point: number
): { start: number; end: number } => {
  const start = text.lastIndexOf("\n", point - 1) + 1;
  const nl = text.indexOf("\n", point);
  const end = nl === -1 ? text.length : nl;

  return { start, end };
};

/** Parse a single line as a headline, or return undefined if it isn't one. */
export const parseHeadline = (line: string): Pick<
  Headline,
  "level" | "title" | "todo"
> | undefined => {
  const todoMatch = TODO_RE.exec(line);

  if (todoMatch) {
    return {
      level: todoMatch[1].length,
      todo: todoMatch[2] as TodoKeyword,
      title: line.slice(todoMatch[1].length).trimStart(),
    };
  }

  const match = HEADLINE_RE.exec(line);

  if (match) {
    return { level: match[1].length, title: match[2] };
  }

  return undefined;
};

/** Return the headline at `point`, if point is on a headline line. */
export const headlineAt = (text: string, point: number): Headline | undefined => {
  const { start, end } = lineBounds(text, point);
  const line = text.slice(start, end);
  const parsed = parseHeadline(line);

  if (!parsed) return undefined;

  return {
    start,
    lineEnd: end < text.length ? end + 1 : end,
    ...parsed,
  };
};

/**
 * Find the body range that belongs to the headline starting at `headlineStart`:
 * everything until the next headline of the same-or-shallower level (or EOF).
 * Returns the [start, end] of the body (excluding the headline line itself).
 */
export const subtreeBody = (
  text: string,
  headline: Headline
): { start: number; end: number } => {
  const bodyStart = headline.lineEnd;
  let i = bodyStart;

  while (i < text.length) {
    const { start, end } = lineBounds(text, i);
    const parsed = parseHeadline(text.slice(start, end));

    if (parsed && parsed.level <= headline.level) {
      return { start: bodyStart, end: start };
    }
    i = end + 1;
  }

  return { start: bodyStart, end: text.length };
};

/**
 * Cycle the TODO keyword of a headline line. Returns the rewritten line.
 * none -> TODO -> DOING -> DONE -> none.
 */
export const cycleTodo = (line: string): string => {
  const match = HEADLINE_RE.exec(line);

  if (!match) return line;
  const stars = match[1];
  const rest = match[2];
  const todoMatch = /^(TODO|DOING|DONE)\b\s*(.*)$/.exec(rest);

  if (!todoMatch) {
    return `${stars} ${TODO_KEYWORDS[0]} ${rest}`.trimEnd();
  }

  const current = todoMatch[1] as TodoKeyword;
  const idx = TODO_KEYWORDS.indexOf(current);
  const next = TODO_KEYWORDS[idx + 1];
  const body = todoMatch[2];

  if (!next) {
    // Wrap around to "no keyword".
    return `${stars} ${body}`.trimEnd();
  }

  return `${stars} ${next} ${body}`.trimEnd();
};

/** Build a sibling headline line at the same level as `headline`. */
export const siblingHeadline = (level: number): string =>
  `${"*".repeat(level)} `;

export type AgendaItem = {
  todo: TodoKeyword;
  title: string;
  line: number;
};

/** Scan an Org buffer for TODO/DOING/DONE headlines (for org-agenda). */
export const scanAgenda = (text: string): AgendaItem[] => {
  const items: AgendaItem[] = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const parsed = parseHeadline(line);

    if (parsed?.todo) {
      items.push({ todo: parsed.todo, title: parsed.title, line: index + 1 });
    }
  });

  return items;
};

/** Render a read-only agenda buffer from scanned items. */
export const renderAgenda = (items: AgendaItem[], sourceName: string): string => {
  const header = `Org Agenda  (source: ${sourceName})\n${"=".repeat(48)}\n`;

  if (items.length === 0) {
    return `${header}\nNo TODO items found in this buffer.\n`;
  }

  const open = items.filter((i) => i.todo !== "DONE");
  const done = items.filter((i) => i.todo === "DONE");

  const fmt = (i: AgendaItem): string =>
    `  ${i.todo.padEnd(5)}  ${i.title}    (line ${i.line})`;

  const lines = [header];

  lines.push(`Tasks (${open.length}):`);
  lines.push(...open.map(fmt));
  if (done.length > 0) {
    lines.push("");
    lines.push(`Done (${done.length}):`);
    lines.push(...done.map(fmt));
  }
  lines.push("");
  lines.push("Read-only agenda. Edit the source .org buffer to change tasks.");

  return `${lines.join("\n")}\n`;
};
