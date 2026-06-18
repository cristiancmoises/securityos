import { loader } from "@monaco-editor/react";
import Explorer from "components/apps/DevStudio/Explorer";
import {
  isCompiledExtension,
  languageFromExtension,
  runnableFromExtension,
} from "components/apps/DevStudio/language";
import StyledDevStudio from "components/apps/DevStudio/StyledDevStudio";
import {
  createSandboxRunner,
  transpileTypeScript,
} from "components/apps/DevStudio/sandbox";
import type {
  OpenFile,
  OutputKind,
  OutputLine,
  SandboxMessage,
} from "components/apps/DevStudio/types";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api";
import { basename, dirname, extname, join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { HOME } from "utils/constants";
import { lockGlobal, unlockGlobal } from "utils/globals";

const MONACO_CONFIG = { paths: { vs: "/Program Files/MonacoEditor/vs" } };
const THEME = "vs-dark";
const DEFAULT_ROOT = `${HOME}/Documents`;

const DevStudio: FC<ComponentProcessProps> = ({ id }) => {
  const { exists, mkdirRecursive, readFile, updateFolder, writeFile } =
    useFileSystem();
  const { open } = useProcesses();
  const { prependFileToTitle } = useTitle(id);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor>();
  const monacoRef = useRef<typeof Monaco>();
  const runnerRef = useRef<ReturnType<typeof createSandboxRunner>>();
  const outputIdRef = useRef(0);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const [, forceRender] = useState(0);
  const filesRef = useRef<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string>();
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [root, setRoot] = useState(DEFAULT_ROOT);
  const [refreshToken, setRefreshToken] = useState(0);
  const [ready, setReady] = useState(false);

  const refreshTabs = useCallback(() => forceRender((value) => value + 1), []);
  const refreshTree = useCallback(
    () => setRefreshToken((token) => token + 1),
    []
  );

  const appendOutput = useCallback((kind: OutputKind, text: string) => {
    setOutput((lines) => [
      ...lines,
      { id: (outputIdRef.current += 1), kind, text },
    ]);
  }, []);

  const activeFile = filesRef.current.find((file) => file.path === activePath);
  const activeExtension = activePath ? extname(activePath).toLowerCase() : "";
  const runnable = runnableFromExtension(activeExtension);

  // Ensure a sensible default workspace root exists.
  useEffect(() => {
    exists(DEFAULT_ROOT).then((rootExists) => {
      if (rootExists) setRoot(DEFAULT_ROOT);
      else setRoot(HOME);
    });
  }, [exists]);

  // Load Monaco from the self-hosted copy (no CDN); reuse the OS's vs bundle.
  useEffect(() => {
    let disposed = false;

    if (!monacoRef.current && editorContainerRef.current) {
      unlockGlobal("define");
      loader.config(MONACO_CONFIG);
      loader.init().then((monacoInstance) => {
        lockGlobal("define");
        if (disposed || !editorContainerRef.current) return;

        monacoRef.current = monacoInstance;
        editorRef.current = monacoInstance.editor.create(
          editorContainerRef.current,
          {
            automaticLayout: true,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontSize: 13,
            minimap: { enabled: true },
            theme: THEME,
          }
        );
        setReady(true);
      });
    }

    return () => {
      disposed = true;
    };
  }, []);

  // Dispose everything on unmount.
  useEffect(
    () => () => {
      runnerRef.current?.terminate();
      filesRef.current.forEach((file) => file.model.dispose());
      editorRef.current?.dispose();
      lockGlobal("define");
    },
    []
  );

  const setEditorModel = useCallback((file?: OpenFile) => {
    const editor = editorRef.current;

    if (!editor) return;

    // Save view state of the currently shown model before switching.
    const previousModel = editor.getModel();

    if (previousModel) {
      const previous = filesRef.current.find(
        (open) => open.model === previousModel
      );

      if (previous) previous.viewState = editor.saveViewState();
    }

    if (file) {
      editor.setModel(file.model);
      if (file.viewState) editor.restoreViewState(file.viewState);
      editor.focus();
    } else {
      // No tab left — detach so the disposed model is never shown.
      editor.setModel(null);
    }
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      if (!monacoRef.current) return;

      const existing = filesRef.current.find((file) => file.path === path);

      if (existing) {
        setActivePath(path);
        setEditorModel(existing);
        prependFileToTitle(basename(path));
        return;
      }

      let contents = "";

      try {
        contents = (await readFile(path)).toString();
      } catch {
        appendOutput("error", `Could not read ${path}`);
        return;
      }

      const model = monacoRef.current.editor.createModel(
        contents,
        languageFromExtension(extname(path))
      );
      const file: OpenFile = { dirty: false, model, path };

      model.onDidChangeContent(() => {
        if (!file.dirty) {
          file.dirty = true;
          refreshTabs();
        }
      });

      filesRef.current = [...filesRef.current, file];
      setActivePath(path);
      setEditorModel(file);
      prependFileToTitle(basename(path));
      refreshTabs();
    },
    [appendOutput, prependFileToTitle, readFile, refreshTabs, setEditorModel]
  );

  const closeTab = useCallback(
    (path: string) => {
      const index = filesRef.current.findIndex((file) => file.path === path);

      if (index === -1) return;

      const [closed] = filesRef.current.splice(index, 1);

      filesRef.current = [...filesRef.current];

      if (path === activePath) {
        const next =
          filesRef.current[index] || filesRef.current[index - 1] || undefined;

        setActivePath(next?.path);
        setEditorModel(next);
        if (next) prependFileToTitle(basename(next.path));
      }

      closed.model.dispose();
      refreshTabs();
    },
    [activePath, prependFileToTitle, refreshTabs, setEditorModel]
  );

  const selectTab = useCallback(
    (path: string) => {
      const file = filesRef.current.find((open) => open.path === path);

      if (!file) return;

      setActivePath(path);
      setEditorModel(file);
      prependFileToTitle(basename(path));
    },
    [prependFileToTitle, setEditorModel]
  );

  const saveActive = useCallback(async () => {
    const file = filesRef.current.find((open) => open.path === activePath);

    if (!file) return;

    if (await writeFile(file.path, file.model.getValue(), true)) {
      file.dirty = false;
      updateFolder(dirname(file.path), basename(file.path));
      prependFileToTitle(basename(file.path));
      appendOutput("system", `Saved ${file.path}`);
      refreshTabs();
    }
  }, [
    activePath,
    appendOutput,
    prependFileToTitle,
    refreshTabs,
    updateFolder,
    writeFile,
  ]);

  const newFile = useCallback(async () => {
    // eslint-disable-next-line no-alert
    const name = window.prompt("New file name", "untitled.js");

    if (!name) return;

    const path = join(root, name);

    if (await exists(path)) {
      appendOutput("error", `${path} already exists`);
      return;
    }

    await mkdirRecursive(root);
    if (await writeFile(path, "", true)) {
      updateFolder(root, name);
      refreshTree();
      openFile(path);
    }
  }, [
    appendOutput,
    exists,
    mkdirRecursive,
    openFile,
    refreshTree,
    root,
    updateFolder,
    writeFile,
  ]);

  const newFolder = useCallback(async () => {
    // eslint-disable-next-line no-alert
    const name = window.prompt("New folder name", "folder");

    if (!name) return;

    const path = join(root, name);

    if (await exists(path)) {
      appendOutput("error", `${path} already exists`);
      return;
    }

    await mkdirRecursive(path);
    updateFolder(root, name);
    refreshTree();
  }, [appendOutput, exists, mkdirRecursive, refreshTree, root, updateFolder]);

  const handleSandboxMessage = useCallback(
    (message: SandboxMessage) => {
      switch (message.type) {
        case "log":
        case "info":
        case "warn":
        case "error":
          appendOutput(message.type, message.text);
          break;
        case "uncaught":
          appendOutput("error", message.text);
          break;
        case "pass":
          appendOutput("pass", message.text);
          break;
        case "fail":
          appendOutput("fail", message.text);
          break;
        case "summary":
          appendOutput(
            message.failed > 0 ? "fail" : "pass",
            `Tests: ${message.passed} passed, ${message.failed} failed`
          );
          break;
        case "done":
          appendOutput("system", "— done —");
          setRunning(false);
          break;
        default:
          break;
      }
    },
    [appendOutput]
  );

  const stop = useCallback(() => {
    runnerRef.current?.terminate();
    runnerRef.current = undefined;
    if (running) appendOutput("system", "Stopped.");
    setRunning(false);
  }, [appendOutput, running]);

  const run = useCallback(
    async (runTests: boolean) => {
      const file = filesRef.current.find((open) => open.path === activePath);

      if (!file) return;

      const ext = extname(file.path).toLowerCase();
      const kind = runnableFromExtension(ext);

      if (kind === "none") {
        if (isCompiledExtension(ext)) {
          appendOutput(
            "system",
            "Compiled languages: build & run in the Linux VM (V86) or Terminal."
          );
        } else {
          appendOutput("error", `Cannot run ${ext || "this file"} in-browser.`);
        }
        return;
      }

      setOutput([]);
      setRunning(true);
      appendOutput(
        "info",
        `${runTests ? "Running tests for" : "Running"} ${basename(file.path)}...`
      );

      let code = file.model.getValue();

      if (kind === "typescript") {
        try {
          code = await transpileTypeScript(
            code,
            ext === ".tsx" || ext === ".jsx"
          );
        } catch (error) {
          appendOutput("error", `TypeScript error: ${String(error)}`);
          setRunning(false);
          return;
        }
      }

      runnerRef.current?.terminate();
      runnerRef.current = createSandboxRunner({
        onError: (text) => {
          appendOutput("error", text);
          setRunning(false);
        },
        onMessage: handleSandboxMessage,
      });
      runnerRef.current.run(code, runTests);
    },
    [activePath, appendOutput, handleSandboxMessage]
  );

  // Keybindings: Ctrl+S save, Ctrl+Enter / F5 run.
  const runRef = useRef(run);
  const saveRef = useRef(saveActive);

  runRef.current = run;
  saveRef.current = saveActive;

  useEffect(() => {
    if (!ready || !editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      saveRef.current()
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      runRef.current(false)
    );
    editor.addCommand(monaco.KeyCode.F5, () => runRef.current(false));
  }, [ready]);

  // Auto-scroll the console to the bottom on new output.
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  const langLabel =
    runnable === "none"
      ? isCompiledExtension(activeExtension)
        ? "compiled (VM)"
        : activeExtension || "—"
      : runnable;

  return (
    <StyledDevStudio>
      <Explorer
        activePath={activePath}
        refreshToken={refreshToken}
        root={root}
        onNewFile={newFile}
        onNewFolder={newFolder}
        onOpenFile={openFile}
        onRefresh={refreshTree}
      />
      <section className="main">
        <div className="tabs">
          {filesRef.current.map((file) => (
            <div
              key={file.path}
              className={`tab${file.path === activePath ? " active" : ""}`}
              title={file.path}
              onClick={() => selectTab(file.path)}
            >
              <span className="name">{basename(file.path)}</span>
              {file.dirty && <span className="dot">●</span>}
              <button
                className="close"
                title="Close"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(file.path);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div ref={editorContainerRef} className="editor">
          {filesRef.current.length === 0 && (
            <div className="placeholder">
              <strong>DevStudio</strong>
              <span>Open a file from the explorer to start editing.</span>
              <span>Run with Ctrl+Enter or F5 · Save with Ctrl+S</span>
            </div>
          )}
        </div>
      </section>
      <section className="output">
        <div className="toolbar">
          {running ? (
            <button className="stop" type="button" onClick={stop}>
              ■ Stop
            </button>
          ) : (
            <button
              className="run"
              disabled={runnable === "none"}
              type="button"
              onClick={() => run(false)}
            >
              ▶ Run
            </button>
          )}
          <button
            disabled={running || runnable === "none"}
            title="Run tests — define test()/assert() in your file"
            type="button"
            onClick={() => run(true)}
          >
            ✓ Run Tests
          </button>
          <button
            title="Save (Ctrl+S)"
            type="button"
            disabled={!activeFile}
            onClick={saveActive}
          >
            💾 Save
          </button>
          <button
            title="Clear output"
            type="button"
            onClick={() => setOutput([])}
          >
            ⌫ Clear
          </button>
          <span className="spacer" />
          {isCompiledExtension(activeExtension) && (
            <>
              <button
                className="hint"
                title="Build & run in the Linux VM"
                type="button"
                onClick={() => open("V86")}
              >
                Open Linux VM
              </button>
              <button
                className="hint"
                title="Build & run in the Terminal"
                type="button"
                onClick={() => open("Terminal", { url: root })}
              >
                Open Terminal
              </button>
            </>
          )}
          <span className="lang">{langLabel}</span>
        </div>
        <div ref={consoleRef} className="console">
          {output.length === 0 ? (
            <div className="line system">
              Output console — run a JS/TS file to see logs, errors and test
              results here. For step-debugging, open your browser devtools.
            </div>
          ) : (
            output.map((line) => (
              <div key={line.id} className={`line ${line.kind}`}>
                {line.text}
              </div>
            ))
          )}
        </div>
      </section>
    </StyledDevStudio>
  );
};

export default DevStudio;
