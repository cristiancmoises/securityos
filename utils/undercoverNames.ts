/**
 * Undercover enterprise-workspace display-name overlay.
 *
 * Maps the real on-disk desktop/file/app names to neutral productivity labels
 * without renaming anything. These are cosmetic labels used only while Undercover
 * mode is active; toggling Undercover off restores the real names.
 *
 * Consumed (gated on `useSession().themeName === "undercover"`) by
 * `components/system/Files/FileEntry/index.tsx` where the visible name is computed.
 *
 * Keys are matched against the entry's display name (the file/shortcut basename
 * without its extension, e.g. a `Computer.url` shortcut is keyed as "Computer").
 */
const UNDERCOVER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  // Neutral workspace, app, library, and note labels.
  Cloudmacs: "Text Editor",
  Computer: "Workspace",
  Documents: "Documents",
  Images: "Pictures",
  Matrix: "Messages",
  Music: "Music",
  PDF: "Document Reader",
  Photos: "Image Gallery",
  Pictures: "Pictures",
  README: "Read me",
  "Screen Capture": "Capture",
  SecChat: "Messages",
  "Security Tools": "Utilities",
  Terminal: "Console",
  "Tor Browser": "Web Browser",
  VLC: "Media",
  Videos: "Videos",
  Vim: "Text Editor",
  Winamp: "Media",
  dev: "Notes",
  terms: "Notes",
};

/**
 * Returns the neutral Undercover display label for a given real entry name, or the
 * original name when there is no mapping. Pure/stateless — gate the call site on
 * Undercover so the default theme always sees real names.
 */
export const getUndercoverName = (name: string): string =>
  UNDERCOVER_DISPLAY_NAMES[name] ?? name;

export default UNDERCOVER_DISPLAY_NAMES;
