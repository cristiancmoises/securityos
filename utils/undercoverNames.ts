/**
 * Undercover (Windows 11 disguise) display-name overlay.
 *
 * Maps the REAL on-disk desktop/file/app names to generic, Windows 11-flavoured
 * labels — WITHOUT renaming anything on disk and WITHOUT using any Microsoft
 * product/trademark names (no Edge, Explorer, Microsoft Store, Cortana, Office,
 * OneDrive, etc.). These are purely cosmetic labels used only while Undercover
 * mode is active; toggling Undercover off restores the real names.
 *
 * Consumed (gated on `useSession().themeName === "undercover"`) by
 * `components/system/Files/FileEntry/index.tsx` where the visible name is computed.
 *
 * Keys are matched against the entry's display name (the file/shortcut basename
 * without its extension, e.g. a `Computer.url` shortcut is keyed as "Computer").
 */
const UNDERCOVER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  // Core "This PC" / library folders.
  Computer: "This PC",
  Documents: "Documents",
  Images: "Pictures",
  Music: "Music",
  Pictures: "Pictures",
  Videos: "Videos",

  // Apps — mapped to generic, non-Microsoft Win11-ish equivalents.
  Cloudmacs: "Notepad",
  Vim: "Notepad",
  "Tor Browser": "Web",
  "Screen Capture": "Snipping Tool",
  Matrix: "Chat",
  SecChat: "Chat",
  Terminal: "Terminal",
  "Security Tools": "Tools",
  Photos: "Photos",
  PDF: "Reader",
  VLC: "Media Player",
  Winamp: "Media Player",

  // Light-touch friendly labels for the loose desktop notes (files are NOT renamed).
  "README": "Read me",
  "dev": "Notes",
  "terms": "Notes",
};

/**
 * Returns the Windows 11-ish display label for a given real entry name, or the
 * original name when there is no mapping. Pure/stateless — gate the call site on
 * Undercover so the default theme always sees real names.
 */
export const getUndercoverName = (name: string): string =>
  UNDERCOVER_DISPLAY_NAMES[name] ?? name;

export default UNDERCOVER_DISPLAY_NAMES;
