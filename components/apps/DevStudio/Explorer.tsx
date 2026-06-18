import type { TreeNode } from "components/apps/DevStudio/types";
import { useFileSystem } from "contexts/fileSystem";
import { join } from "path";
import { useCallback, useEffect, useState } from "react";

type ExplorerProps = {
  activePath?: string;
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
  refreshToken: number;
  root: string;
};

const sortEntries = (nodes: TreeNode[]): TreeNode[] =>
  [...nodes].sort((a, b) => {
    if (a.directory !== b.directory) return a.directory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const Explorer: FC<ExplorerProps> = ({
  activePath,
  onNewFile,
  onNewFolder,
  onOpenFile,
  onRefresh,
  refreshToken,
  root,
}) => {
  const { readdir, stat } = useFileSystem();
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, TreeNode[]>>({});
  const readChildren = useCallback(
    async (dir: string): Promise<TreeNode[]> => {
      try {
        const entries = await readdir(dir);
        const children = await Promise.all(
          entries.map(async (name): Promise<TreeNode> => {
            const path = join(dir, name);
            let directory = false;

            try {
              directory = (await stat(path)).isDirectory();
            } catch {
              // Treat unreadable entries as files
            }

            return { directory, name, path };
          })
        );

        return sortEntries(children);
      } catch {
        return [];
      }
    },
    [readdir, stat]
  );

  useEffect(() => {
    readChildren(root).then(setNodes);
    setExpanded({});
  }, [readChildren, refreshToken, root]);

  const toggleDir = useCallback(
    async (path: string) => {
      if (expanded[path]) {
        setExpanded((current) => {
          const next = { ...current };

          delete next[path];

          return next;
        });
      } else {
        const children = await readChildren(path);

        setExpanded((current) => ({ ...current, [path]: children }));
      }
    },
    [expanded, readChildren]
  );

  const renderNodes = useCallback(
    (list: TreeNode[], depth: number): JSX.Element => (
      <ul>
        {list.map((node) => (
          <li key={node.path}>
            <div
              className={`node${node.path === activePath ? " active" : ""}`}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
              title={node.name}
              onClick={() =>
                node.directory ? toggleDir(node.path) : onOpenFile(node.path)
              }
            >
              <span className="twist">
                {node.directory ? (expanded[node.path] ? "▾" : "▸") : ""}
              </span>
              <span className="label">
                {node.directory ? "📁" : "📄"} {node.name}
              </span>
            </div>
            {node.directory &&
              expanded[node.path] &&
              renderNodes(expanded[node.path], depth + 1)}
          </li>
        ))}
      </ul>
    ),
    [activePath, expanded, onOpenFile, toggleDir]
  );

  return (
    <nav className="explorer">
      <div className="explorer-header">
        <span>Explorer</span>
        <span className="actions">
          <button title="New File" type="button" onClick={onNewFile}>
            +
          </button>
          <button title="New Folder" type="button" onClick={onNewFolder}>
            ⊞
          </button>
          <button title="Refresh" type="button" onClick={onRefresh}>
            ⟳
          </button>
        </span>
      </div>
      <div className="explorer-root" title={root}>
        {root}
      </div>
      <div className="tree">{renderNodes(nodes, 0)}</div>
    </nav>
  );
};

export default Explorer;
