import { loadFiles } from "utils/functions";

export type DOMPurifyConfig = {
  ALLOWED_ATTR?: string[];
  ALLOWED_TAGS?: string[];
  ALLOW_DATA_ATTR?: boolean;
  FORBID_ATTR?: string[];
  FORBID_TAGS?: string[];
  USE_PROFILES?: {
    html?: boolean;
    mathMl?: boolean;
    svg?: boolean;
    svgFilters?: boolean;
  };
};

declare global {
  interface Window {
    DOMPurify?: {
      sanitize: (dirty: string, config?: DOMPurifyConfig) => string;
    };
  }
}

// Vendored DOMPurify build already shipped for the Marked (Markdown) app.
const PURIFY_LIB = "/Program Files/Marked/purify.min.js";

// Strict profile for rendering UNTRUSTED, embedder-origin HTML (e.g. generating a
// thumbnail/preview of a user's .whtml file). DOMPurify already strips <script>,
// event handlers and javascript:/data: URLs by default; we additionally drop the
// active-content tags so nothing can fetch, frame, submit or navigate.
export const STRICT_HTML_PROFILE: DOMPurifyConfig = {
  ALLOW_DATA_ATTR: false,
  FORBID_ATTR: ["srcdoc", "ping", "formaction"],
  FORBID_TAGS: [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "base",
    "link",
    "meta",
    "frame",
    "frameset",
  ],
};

/**
 * Sanitizes an untrusted HTML string, loading the vendored DOMPurify on demand.
 * Fails CLOSED — if the sanitizer cannot be loaded, returns "" rather than risk
 * injecting unsanitized markup.
 */
export const sanitizeHtmlString = async (
  html: string,
  config: DOMPurifyConfig = STRICT_HTML_PROFILE
): Promise<string> => {
  if (typeof window === "undefined" || !html) return "";

  if (!window.DOMPurify) {
    try {
      await loadFiles([PURIFY_LIB]);
    } catch {
      // Sanitizer failed to load — fall through and fail closed below.
    }
  }

  return window.DOMPurify?.sanitize(html, config) ?? "";
};
