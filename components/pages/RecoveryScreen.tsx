import { useCallback, useState } from "react";

// Shown by the top-level ErrorBoundary when the desktop fails to start AND the
// one-shot auto-reload didn't fix it (i.e. a PERSISTENT error — almost always
// corrupted saved state in localStorage / IndexedDB). Instead of reloading
// forever (the old behavior → an endless "blinking" boot), we stop and offer a
// recovery path. Styles are INLINE on purpose: this screen must render even when
// theming / styled-components / app chunks are the thing that's broken.

const wipeIndexedDb = async (): Promise<void> => {
  try {
    const idb = window.indexedDB;

    if (!idb) return;

    // Modern browsers can enumerate databases; otherwise fall back to the names
    // SecurityOS/daedalOS/BrowserFS are known to use.
    const names =
      typeof idb.databases === "function"
        ? (await idb.databases())
            .map((database) => database.name)
            .filter(Boolean)
        : ["browserfs", "keyval-store", "IDBFS", "FileSystem"];

    await Promise.all(
      (names as string[]).map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = idb.deleteDatabase(name);

            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          })
      )
    );
  } catch {
    // Best effort — never throw from the recovery screen.
  }
};

const RecoveryScreen: FC = () => {
  const [busy, setBusy] = useState(false);

  const tryAgain = useCallback(() => {
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    await wipeIndexedDb();
    window.location.reload();
  }, []);

  return (
    <div
      style={{
        alignItems: "center",
        background: "#0b0e14",
        color: "#e6e6e6",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        height: "100vh",
        justifyContent: "center",
        left: 0,
        padding: "24px",
        position: "fixed",
        textAlign: "center",
        top: 0,
        width: "100vw",
        zIndex: 2147483647,
      }}
    >
      <div style={{ fontSize: "44px", marginBottom: "8px" }}>🛡️</div>
      <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
        SecurityOS couldn&apos;t finish loading
      </h1>
      <p
        style={{
          color: "#9aa4b2",
          fontSize: "13.5px",
          lineHeight: 1.5,
          margin: "0 0 20px",
          maxWidth: "440px",
        }}
      >
        Something kept the desktop from starting. This is almost always caused
        by corrupted saved data from a previous version. Try reloading first —
        if it keeps happening, reset to clear saved data (your files in the
        cloud apps are unaffected; local desktop layout/state is cleared).
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          disabled={busy}
          onClick={tryAgain}
          style={{
            background: "#1f6feb",
            border: 0,
            borderRadius: "8px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13.5px",
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
            padding: "10px 18px",
          }}
          type="button"
        >
          Try again
        </button>
        <button
          disabled={busy}
          onClick={reset}
          style={{
            background: "transparent",
            border: "1px solid #3d4450",
            borderRadius: "8px",
            color: "#e6e6e6",
            cursor: "pointer",
            fontSize: "13.5px",
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
            padding: "10px 18px",
          }}
          type="button"
        >
          {busy ? "Resetting…" : "Reset SecurityOS"}
        </button>
      </div>
    </div>
  );
};

export default RecoveryScreen;
