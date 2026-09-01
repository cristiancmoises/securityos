import StyledTool from "components/apps/SecTools/StyledTool";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useFileSystem } from "contexts/fileSystem";
import { basename, dirname, join } from "path";
import { useCallback, useState } from "react";

type Tab = "decryptKey" | "encryptKey" | "keygen" | "password";

type Stats = { failed: number; ok: number; skipped: number };

// Vaptvupt — the real Vaptvupt engine (WASM, utils/vaptvuptCrypto) integrated with
// the SecurityOS filesystem. Password mode (PBKDF2 → AES-256 + HMAC) AND a true
// post-quantum public-key mode (ML-KEM-768 + X25519 hybrid: generate a keypair,
// encrypt to a public key, decrypt with the private key). Output is the Vaptvupt
// ".zupt" format. Whole-disk crypto (LUKS) still belongs in the Linux VM.
const TABS: { id: Tab; label: string }[] = [
  { id: "password", label: "Password" },
  { id: "keygen", label: "Generate Keys" },
  { id: "encryptKey", label: "Encrypt (public key)" },
  { id: "decryptKey", label: "Decrypt (private key)" },
];

const VaptvuptGui: FC<ComponentProcessProps> = () => {
  const { createPath, deletePath, exists, lstat, readFile, readdir } =
    useFileSystem();
  const [tab, setTab] = useState<Tab>("password");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // Password tab
  const [path, setPath] = useState("/Users/Public/Documents");
  const [password, setPassword] = useState("");
  const [removeSource, setRemoveSource] = useState(true);

  // Keygen tab
  const [keyName, setKeyName] = useState("securityos");
  const [keyDir, setKeyDir] = useState("/Users/Public/Documents");

  // Public/private-key tabs
  const [pqPath, setPqPath] = useState("/Users/Public/Documents");
  const [keyPath, setKeyPath] = useState("");

  const resolve = (p: string): string =>
    p.startsWith("/") ? p : join("/Users/Public", p);

  // Walk a file or folder (recursively), calling perFile on each regular file.
  const walk = useCallback(
    async (
      fullPath: string,
      perFile: (filePath: string) => Promise<void>
    ): Promise<void> => {
      if ((await lstat(fullPath)).isDirectory()) {
        const entries = await readdir(fullPath);

        await entries.reduce(async (chain, entry) => {
          await chain;

          const entryPath = join(fullPath, entry);

          if ((await lstat(entryPath)).isDirectory()) {
            await walk(entryPath, perFile);
          } else {
            await perFile(entryPath);
          }
        }, Promise.resolve());
      } else {
        await perFile(fullPath);
      }
    },
    [lstat, readdir]
  );

  // Password encrypt/decrypt (recursive). Shared by the Password tab.
  const runPassword = useCallback(
    async (mode: "decrypt" | "encrypt"): Promise<void> => {
      if (busy) return;

      const lines: string[] = [];
      const append = (line: string): void => {
        lines.push(line);
        setLog([...lines]);
      };

      if (!password) {
        setLog(["Enter a password."]);
        return;
      }

      const fullPath = resolve(path);

      if (!(await exists(fullPath))) {
        setLog([`Not found: ${fullPath}`]);
        return;
      }

      setBusy(true);
      setLog([
        `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${fullPath} …`,
      ]);

      const { decryptData, encryptData, ENCRYPTED_EXTENSION } = await import(
        "utils/vaptvuptCrypto"
      );
      const stats: Stats = { failed: 0, ok: 0, skipped: 0 };
      const isEnc = (p: string): boolean => p.endsWith(ENCRYPTED_EXTENSION);

      const perFile = async (filePath: string): Promise<void> => {
        if (mode === "encrypt" && isEnc(filePath)) {
          stats.skipped += 1;
          return;
        }
        if (mode === "decrypt" && !isEnc(filePath)) {
          stats.skipped += 1;
          return;
        }

        try {
          const data = await readFile(filePath);
          const dest =
            mode === "encrypt"
              ? `${filePath}${ENCRYPTED_EXTENSION}`
              : filePath.slice(0, -ENCRYPTED_EXTENSION.length);
          const payload =
            mode === "encrypt"
              ? await encryptData(data, password)
              : await decryptData(data, password);
          const name = await createPath(basename(dest), dirname(dest), payload);

          if (!name) {
            stats.failed += 1;
            append(`  FAILED to write: ${dest}`);
            return;
          }

          stats.ok += 1;
          append(`  ${mode}ed → ${join(dirname(dest), name)}`);

          if (mode === "encrypt" && removeSource) {
            try {
              await deletePath(filePath);
            } catch {
              // keep source if delete fails
            }
          }
        } catch (error) {
          stats.failed += 1;
          append(`  FAILED (${(error as Error).message}): ${filePath}`);
        }
      };

      try {
        await walk(fullPath, perFile);
        append(
          `Done — ${stats.ok} ok, ${stats.skipped} skipped, ${stats.failed} failed.`
        );
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      createPath,
      deletePath,
      exists,
      password,
      path,
      readFile,
      removeSource,
      walk,
    ]
  );

  const runKeygen = useCallback(async (): Promise<void> => {
    if (busy) return;

    const append = (line: string): void => setLog((cur) => [...cur, line]);

    if (!keyName) {
      setLog(["Enter a key name."]);
      return;
    }

    setBusy(true);
    setLog(["Generating ML-KEM-768 + X25519 keypair …"]);

    try {
      const {
        generateKeypair,
        keyFingerprint,
        PRIVATE_KEY_EXTENSION,
        PUBLIC_KEY_EXTENSION,
      } = await import("utils/vaptvuptCrypto");
      const dir = resolve(keyDir);
      const { privateKey, publicKey } = await generateKeypair();
      const pubName = await createPath(
        `${keyName}${PUBLIC_KEY_EXTENSION}`,
        dir,
        publicKey
      );
      const privName = await createPath(
        `${keyName}${PRIVATE_KEY_EXTENSION}`,
        dir,
        privateKey
      );

      append(
        `  public key  → ${join(dir, pubName)}  [${await keyFingerprint(
          publicKey
        )}]`
      );
      append(
        `  PRIVATE key → ${join(dir, privName)}  [${await keyFingerprint(
          privateKey
        )}]`
      );
      append(
        "Keep the .vvkey private key secret + backed up — it cannot be recovered."
      );
    } catch (error) {
      append(`FAILED: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, createPath, keyDir, keyName]);

  // Public-key encrypt / private-key decrypt (recursive).
  const runKeyMode = useCallback(
    async (mode: "decrypt" | "encrypt"): Promise<void> => {
      if (busy) return;

      const lines: string[] = [];
      const append = (line: string): void => {
        lines.push(line);
        setLog([...lines]);
      };

      const fullPath = resolve(pqPath);
      const keyFull = resolve(keyPath);

      if (!keyPath || !(await exists(keyFull))) {
        setLog([`Key file not found: ${keyFull || "(none)"}`]);
        return;
      }
      if (!(await exists(fullPath))) {
        setLog([`Not found: ${fullPath}`]);
        return;
      }

      setBusy(true);
      setLog([
        `${
          mode === "encrypt"
            ? "Encrypting to public key"
            : "Decrypting with private key"
        } ${fullPath} …`,
      ]);

      const {
        decryptWithPrivateKey,
        encryptToPublicKey,
        ENCRYPTED_EXTENSION,
        isPqEncrypted,
      } = await import("utils/vaptvuptCrypto");
      const keyFile = await readFile(keyFull);
      const stats: Stats = { failed: 0, ok: 0, skipped: 0 };

      const perFile = async (filePath: string): Promise<void> => {
        const isZupt = filePath.endsWith(ENCRYPTED_EXTENSION);

        if (mode === "encrypt" && isZupt) {
          stats.skipped += 1;
          return;
        }

        try {
          const data = await readFile(filePath);

          if (mode === "decrypt" && !isPqEncrypted(data)) {
            stats.skipped += 1;
            return;
          }

          const dest =
            mode === "encrypt"
              ? `${filePath}${ENCRYPTED_EXTENSION}`
              : filePath.slice(0, -ENCRYPTED_EXTENSION.length);
          const payload =
            mode === "encrypt"
              ? await encryptToPublicKey(data, keyFile)
              : await decryptWithPrivateKey(data, keyFile);
          const name = await createPath(basename(dest), dirname(dest), payload);

          if (!name) {
            stats.failed += 1;
            append(`  FAILED to write: ${dest}`);
            return;
          }

          stats.ok += 1;
          append(`  ${mode}ed → ${join(dirname(dest), name)}`);
        } catch (error) {
          stats.failed += 1;
          append(`  FAILED (${(error as Error).message}): ${filePath}`);
        }
      };

      try {
        await walk(fullPath, perFile);
        append(
          `Done — ${stats.ok} ok, ${stats.skipped} skipped, ${stats.failed} failed.`
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, createPath, exists, keyPath, pqPath, readFile, walk]
  );

  return (
    <StyledTool>
      <h2>🔐 Vaptvupt — Encryption</h2>
      <div className="tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`tab${tab === id ? " active" : ""}`}
            disabled={busy}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "password" && (
        <>
          <p className="desc">
            Encrypt &amp; decrypt files/folders with a password →{" "}
            <code>.zupt</code> (PBKDF2 → AES-256 + HMAC, quantum-resistant).
            Authenticated.
          </p>
          <div>
            <label htmlFor="vv-path">Path (file or folder)</label>
            <input
              id="vv-path"
              disabled={busy}
              onChange={(e) => setPath(e.target.value)}
              type="text"
              value={path}
            />
          </div>
          <div>
            <label htmlFor="vv-pw">Password</label>
            <input
              id="vv-pw"
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="strong passphrase"
              type="password"
              value={password}
            />
          </div>
          <label className="check" htmlFor="vv-shred">
            <input
              checked={removeSource}
              disabled={busy}
              id="vv-shred"
              onChange={(e) => setRemoveSource(e.target.checked)}
              type="checkbox"
            />
            Remove plaintext originals after encrypting
          </label>
          <div className="btn-row">
            <button
              disabled={busy}
              onClick={() => runPassword("encrypt")}
              type="button"
            >
              Encrypt
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => runPassword("decrypt")}
              type="button"
            >
              Decrypt
            </button>
          </div>
        </>
      )}

      {tab === "keygen" && (
        <>
          <p className="desc">
            Generate a post-quantum keypair (<b>ML-KEM-768 + X25519</b>). Share
            the <code>.vvpub</code> public key; keep the <code>.vvkey</code>{" "}
            private key secret.
          </p>
          <div>
            <label htmlFor="vv-kname">Key name</label>
            <input
              id="vv-kname"
              disabled={busy}
              onChange={(e) => setKeyName(e.target.value)}
              type="text"
              value={keyName}
            />
          </div>
          <div>
            <label htmlFor="vv-kdir">Save to folder</label>
            <input
              id="vv-kdir"
              disabled={busy}
              onChange={(e) => setKeyDir(e.target.value)}
              type="text"
              value={keyDir}
            />
          </div>
          <div className="btn-row">
            <button disabled={busy} onClick={runKeygen} type="button">
              Generate keypair
            </button>
          </div>
        </>
      )}

      {(tab === "encryptKey" || tab === "decryptKey") && (
        <>
          <p className="desc">
            {tab === "encryptKey" ? (
              <>
                Post-quantum encrypt to a recipient&apos;s public key (
                <code>.vvpub</code>) → <code>.zupt</code>. Only their private
                key can open it.
              </>
            ) : (
              <>
                Decrypt a post-quantum <code>.zupt</code> with your private key
                (<code>.vvkey</code>).
              </>
            )}
          </p>
          <div>
            <label htmlFor="vv-pqpath">Path (file or folder)</label>
            <input
              id="vv-pqpath"
              disabled={busy}
              onChange={(e) => setPqPath(e.target.value)}
              type="text"
              value={pqPath}
            />
          </div>
          <div>
            <label htmlFor="vv-keypath">
              {tab === "encryptKey"
                ? "Public key (.vvpub)"
                : "Private key (.vvkey)"}
            </label>
            <input
              id="vv-keypath"
              disabled={busy}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder={
                tab === "encryptKey"
                  ? "/Users/Public/Documents/securityos.vvpub"
                  : "/Users/Public/Documents/securityos.vvkey"
              }
              type="text"
              value={keyPath}
            />
          </div>
          <div className="btn-row">
            <button
              disabled={busy}
              onClick={() =>
                runKeyMode(tab === "encryptKey" ? "encrypt" : "decrypt")
              }
              type="button"
            >
              {tab === "encryptKey" ? "Encrypt" : "Decrypt"}
            </button>
          </div>
        </>
      )}

      {log.length > 0 && <pre className="output">{log.join("\n")}</pre>}
      <p className="muted">
        Real Vaptvupt engine (WASM). Whole-disk encryption (cryptsetup/LUKS)
        runs in the Linux VM — see the Terminal <code>vaptvupt</code> command.
      </p>
    </StyledTool>
  );
};

export default VaptvuptGui;
