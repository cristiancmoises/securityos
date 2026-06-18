import type { SandboxMessage } from "components/apps/DevStudio/types";

/**
 * The body of the sandbox Web Worker. It runs entirely off a `blob:` URL, which
 * is permitted by the OS's strict CSP (connect-src 'self') — no CDN, no network.
 *
 * It overrides `console.*`, installs a tiny test harness (`test`/`assert`/
 * `assertEqual`), reports uncaught errors with stack traces, then evaluates the
 * user's code and posts a final "done"/"summary" message back to the IDE.
 *
 * Stringified and wrapped in a Blob below — keep it self-contained (no imports).
 */
const WORKER_SOURCE = `
self.__passed = 0;
self.__failed = 0;
self.__pendingTests = [];

var format = function (value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return value.stack || (value.name + ": " + value.message);
  }
  try {
    return JSON.stringify(value, function (key, val) {
      if (typeof val === "function") return "[Function " + (val.name || "anonymous") + "]";
      if (typeof val === "bigint") return val.toString() + "n";
      if (typeof val === "undefined") return "undefined";
      return val;
    }, 2);
  } catch (e) {
    return String(value);
  }
};

var formatArgs = function (args) {
  return Array.prototype.map.call(args, format).join(" ");
};

var post = function (msg) { self.postMessage(msg); };

["log", "info", "warn", "error"].forEach(function (level) {
  console[level] = function () {
    post({ type: level, text: formatArgs(arguments) });
  };
});
console.debug = console.log;
console.trace = console.log;

// Minimal test harness injected into user scope.
self.test = function (name, fn) {
  self.__pendingTests.push({ name: name, fn: fn });
};
self.it = self.test;
self.assert = function (cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
};
self.assertEqual = function (actual, expected, msg) {
  var a = format(actual);
  var b = format(expected);
  if (a !== b) {
    throw new Error((msg || "assertEqual failed") + " — expected " + b + " but got " + a);
  }
};

var runTests = function () {
  if (self.__pendingTests.length === 0) return;
  post({ type: "info", text: "Running " + self.__pendingTests.length + " test(s)..." });
  self.__pendingTests.forEach(function (t) {
    try {
      var result = t.fn();
      if (result && typeof result.then === "function") {
        // Best-effort: surface async rejections, but count synchronously.
        result.catch(function (err) {
          post({ type: "fail", text: "✗ " + t.name + " — " + format(err) });
        });
      }
      self.__passed++;
      post({ type: "pass", text: "✓ " + t.name });
    } catch (err) {
      self.__failed++;
      post({ type: "fail", text: "✗ " + t.name + "\\n  " + format(err) });
    }
  });
  post({ type: "summary", passed: self.__passed, failed: self.__failed });
};

self.onerror = function (message, source, lineno, colno, error) {
  var text = error && error.stack ? error.stack : message;
  if (typeof lineno === "number") text += "\\n  at line " + lineno + ":" + colno;
  post({ type: "uncaught", text: text });
  return true;
};

self.addEventListener("unhandledrejection", function (event) {
  var reason = event.reason;
  post({ type: "uncaught", text: "Unhandled rejection: " + format(reason) });
});

self.onmessage = function (event) {
  var data = event.data || {};
  var code = data.code || "";
  var runTestsOnly = !!data.runTests;
  try {
    // Indirect eval keeps user code in the worker's global scope so it can see
    // the injected test/assert helpers.
    (0, eval)(code);
  } catch (err) {
    post({ type: "uncaught", text: err && err.stack ? err.stack : String(err) });
  }
  if (runTestsOnly || self.__pendingTests.length > 0) runTests();
  post({ type: "done" });
};
`;

export type RunHandlers = {
  onMessage: (message: SandboxMessage) => void;
  onError: (text: string) => void;
};

/**
 * Spins up a fresh sandbox worker and posts the code to it. Returns the Worker
 * (and a cleanup that revokes the blob URL) so callers can terminate it for a
 * clean Stop. A new worker is created per run so global state never leaks.
 */
export const createSandboxRunner = (
  handlers: RunHandlers
): { run: (code: string, runTests: boolean) => void; terminate: () => void } => {
  let worker: Worker | undefined;
  let blobUrl: string | undefined;

  const terminate = (): void => {
    try {
      worker?.terminate();
    } catch {
      // Ignore terminate failures
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = undefined;
    }
    worker = undefined;
  };

  const run = (code: string, runTests: boolean): void => {
    terminate();

    blobUrl = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: "text/javascript" })
    );
    worker = new Worker(blobUrl);

    worker.addEventListener("message", ({ data }) =>
      handlers.onMessage(data as SandboxMessage)
    );
    worker.addEventListener("error", (event) => {
      handlers.onError(event.message || "Worker error");
    });

    worker.postMessage({ code, runTests });
  };

  return { run, terminate };
};

/**
 * Transpile TypeScript/JSX to runnable JS using the bundled compiler. No CDN —
 * `typescript` is a project dependency and is imported dynamically.
 */
export const transpileTypeScript = async (
  code: string,
  jsx: boolean
): Promise<string> => {
  const ts = await import("typescript");

  return ts.transpileModule(code, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: jsx ? ts.JsxEmit.React : ts.JsxEmit.None,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
};
