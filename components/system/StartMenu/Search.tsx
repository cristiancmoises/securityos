import { TEXT_EDITORS } from "components/system/Files/FileEntry/extensions";
import {
  getIconByFileExtension,
  getProcessByFileExtension,
} from "components/system/Files/FileEntry/functions";
import { useProcesses } from "contexts/process";
import processDirectory from "contexts/process/directory";
import { basename, extname } from "path";
import { useMemo, useRef, useState } from "react";
import { useSearch } from "utils/search";

// The Start Menu search box. The header used to render a STATIC, non-functional
// "Search…" placeholder (a span — no input, no handler), so the search button did
// nothing. This makes it real:
//   • APPS come from the authoritative process directory (matched by title), so any
//     installed app — including the new WhatsApp/Telegram/Session — is found and
//     launched instantly, independent of the file index (which ignores .url
//     shortcuts).
//   • FILES come from the lunr index (documents, etc.) via useSearch.
// Click a result, or press Enter to open the top hit.
type StartMenuSearchProps = {
  toggleStartMenu: (showMenu?: boolean) => void;
};

type Result = {
  icon: string;
  key: string;
  label: string;
  open: () => void;
};

const MAX_APPS = 6;
const MAX_FILES = 6;

const StartMenuSearch: FC<StartMenuSearchProps> = ({ toggleStartMenu }) => {
  const [term, setTerm] = useState("");
  const fileHits = useSearch(term);
  const { open } = useProcesses();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = (): void => {
    setTerm("");
    toggleStartMenu(false);
  };

  const appResults = useMemo<Result[]>(() => {
    const query = term.trim().toLowerCase();

    if (!query) return [];

    return Object.entries(processDirectory)
      .filter(
        ([pid, { title, icon }]) =>
          icon && (title || pid).toLowerCase().includes(query)
      )
      .slice(0, MAX_APPS)
      .map(([pid, { icon = "", title }]) => ({
        icon,
        key: `app:${pid}`,
        label: title || pid,
        open: () => {
          open(pid);
          close();
        },
      }));
    // close()/open are stable enough for this synchronous list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const fileResults = useMemo<Result[]>(() => {
    if (!term.trim()) return [];

    const seen = new Set<string>();
    const out: Result[] = [];

    fileHits.forEach(({ ref: path }) => {
      const ext = extname(path).toLowerCase();

      // Apps (.url shortcuts) are already covered by the directory search above.
      if (ext === ".url" || seen.has(path) || out.length >= MAX_FILES) return;
      seen.add(path);
      out.push({
        icon: getIconByFileExtension(ext),
        key: `file:${path}`,
        label: basename(path),
        open: () => {
          open(getProcessByFileExtension(ext) || TEXT_EDITORS[0], { url: path });
          close();
        },
      });
    });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHits, term]);

  const results = [...appResults, ...fileResults];

  return (
    <div className="search">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.49-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
      </svg>
      <input
        ref={inputRef}
        aria-label="Search apps and files"
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            if (results[0]) results[0].open();
          } else if (event.key === "Escape" && term) {
            event.stopPropagation();
            setTerm("");
          }
        }}
        placeholder="Search apps & files…"
        spellCheck={false}
        type="text"
        value={term}
      />
      {term ? (
        <ul className="search-results">
          {results.length > 0 ? (
            results.map((result) => (
              <li key={result.key}>
                <button onClick={result.open} type="button">
                  <img alt="" src={result.icon} />
                  <span>{result.label}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="empty">No matches</li>
          )}
        </ul>
      ) : undefined}
    </div>
  );
};

export default StartMenuSearch;
