import type { RunnableLanguage } from "components/apps/DevStudio/types";

/**
 * Map a file extension to a Monaco language id. This is intentionally broad so
 * syntax highlighting works for common files; Monaco itself only needs the id
 * string. Extensions are matched lowercase, with the leading dot.
 */
const EXTENSION_LANGUAGE: Record<string, string> = {
  ".bash": "shell",
  ".bat": "bat",
  ".c": "c",
  ".cc": "cpp",
  ".cjs": "javascript",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".cxx": "cpp",
  ".go": "go",
  ".h": "c",
  ".hpp": "cpp",
  ".htm": "html",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascript",
  ".kt": "kotlin",
  ".less": "less",
  ".lua": "lua",
  ".md": "markdown",
  ".markdown": "markdown",
  ".mjs": "javascript",
  ".php": "php",
  ".pl": "perl",
  ".ps1": "powershell",
  ".py": "python",
  ".pyw": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".sh": "shell",
  ".sql": "sql",
  ".svg": "xml",
  ".swift": "swift",
  ".toml": "ini",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".txt": "plaintext",
  ".vue": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

/** Extensions we can run/transpile inside the browser sandbox. */
const RUNNABLE: Record<string, RunnableLanguage> = {
  ".cjs": "javascript",
  ".js": "javascript",
  ".jsx": "typescript",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
};

/** Compiled languages we redirect to the Linux VM / Terminal. */
const COMPILED = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".cxx",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".kt",
  ".rs",
  ".swift",
]);

export const languageFromExtension = (ext: string): string =>
  EXTENSION_LANGUAGE[ext.toLowerCase()] || "plaintext";

export const runnableFromExtension = (ext: string): RunnableLanguage =>
  RUNNABLE[ext.toLowerCase()] || "none";

export const isCompiledExtension = (ext: string): boolean =>
  COMPILED.has(ext.toLowerCase());
