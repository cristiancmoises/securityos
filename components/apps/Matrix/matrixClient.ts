// SecurityOS Matrix — client-only factory around matrix-js-sdk (Rust crypto / E2EE).
//
// EVERYTHING is routed through the SAME-ORIGIN Tor proxy: baseUrl="/api/matrix",
// so the SDK requests "/api/matrix/_matrix/client/...", which pages/api/matrix/
// [...path].ts forwards to matrix.securityops.com.br over Tor (SOCKS5h, DNS at
// Tor).
// The browser NEVER talks to the homeserver directly.
//
// matrix-js-sdk is imported LAZILY (await import) and only from inside async
// functions — never at module top level — so no SDK code is evaluated during SSR
// or at OS boot; it loads as a code-split chunk the first time you sign in.
//
// Amnesic by design: the sync store is an in-memory MemoryStore and Rust crypto
// uses an in-memory store (useIndexedDB:false) — no tokens, no room history, and
// no device keys are written to disk. Trade-off: each sign-in is a fresh device,
// so NEW incoming messages in encrypted rooms decrypt, but history sent before
// this device existed may be undecryptable (no key backup in amnesic mode).

import type { MatrixClient } from "matrix-js-sdk";

// matrix-js-sdk validates/uses baseUrl with `new URL(...)`, which throws
// "Failed to construct URL" on a RELATIVE path. So we build an ABSOLUTE,
// same-origin URL at call time: e.g. https://os.securityops.co/api/matrix. It
// still points at our own /api/matrix Tor proxy (same origin) — only now the SDK
// can parse it.
export const MATRIX_API_PATH = "/api/matrix";
export const matrixBaseUrl = (): string =>
  `${
    typeof window === "undefined" ? "" : window.location.origin
  }${MATRIX_API_PATH}`;
export const HOMESERVER_LABEL = "https://matrix.securityops.com.br";

// PRE-WARM THE TOR CIRCUIT. The single biggest cause of "Matrix is stuck before
// login" is that the FIRST request over Tor lands on a COLD circuit: building a
// fresh Tor circuit to the .onion/homeserver takes ~15–40s, and since the app
// makes no request until the user clicks "Sign in", the login POST is always
// that slow first request — so it looks frozen. We fix this by firing a cheap
// GET /_matrix/client/versions the moment the app opens; by the time the user has
// typed their credentials the circuit is already built, so login is ~1.5s.
// Fire-and-forget, never throws — a failed warm-up just means login pays the cold
// cost itself (same as before).
// Bound the warm-up so the login screen's circuit state always SETTLES. Without a
// timeout, a cold circuit's probe can hang on the proxy's long retry budget for
// minutes, leaving the UI stuck on "Establishing Tor circuit…" with no feedback —
// exactly the "I only see Tor connecting and nothing happens" symptom. After this
// the state resolves to "cold" (slow but usable) and the user gets a clear hint.
const PREWARM_TIMEOUT_MS = 25_000;
// Bound Rust-crypto (E2EE) initialisation so a stalled WASM load can't hang sign-in
// on "Connecting over Tor…". On timeout we connect without E2EE rather than freeze.
const CRYPTO_INIT_TIMEOUT_MS = 20_000;

export const prewarmCircuit = async (
  signal?: AbortSignal
): Promise<boolean> => {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();

  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), PREWARM_TIMEOUT_MS);

  try {
    const response = await fetch(`${matrixBaseUrl()}/_matrix/client/versions`, {
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
};

// Whether the server-side Tor SOCKS proxy is actually reachable (real TCP connect),
// via /api/tor-status. The Matrix login screen uses this to turn a silent, stuck
// "connecting" state into an actionable message: if Tor is configured but DOWN, the
// homeserver can never be reached over Tor, so we tell the user to start Tor instead
// of spinning forever. `configured:false` (e.g. local dev / static export) returns
// undefined → no Tor warning is shown.
export type TorReachability = "down" | "up";

export const probeTorReachability = async (
  signal?: AbortSignal
): Promise<TorReachability | undefined> => {
  try {
    const response = await fetch("/api/tor-status", {
      cache: "no-store",
      signal,
    });

    if (!response.ok) return undefined;

    const status = (await response.json()) as {
      configured?: boolean;
      tor?: boolean;
    };

    if (!status.configured) return undefined;

    return status.tor ? "up" : "down";
  } catch {
    return undefined;
  }
};

// Distinguish a real AUTH failure (wrong username/password, deactivated account)
// from a CONNECTION/Tor failure, so the login screen can say "Invalid username or
// password" instead of a scary "Connection error" when the credentials are wrong.
export const isAuthError = (error: unknown): boolean => {
  const err = error as { errcode?: string; httpStatus?: number };

  return (
    err?.errcode === "M_FORBIDDEN" ||
    err?.errcode === "M_USER_DEACTIVATED" ||
    err?.httpStatus === 401 ||
    err?.httpStatus === 403
  );
};

export type CreatedSession = {
  accessToken: string;
  client: MatrixClient;
  cryptoReady: boolean;
  deviceId: string;
  userId: string;
};

// Log in (over Tor) and return a crypto-enabled, NOT-yet-started client.
// A throwaway bootstrap client obtains credentials; the real client is created
// with those credentials + Rust crypto, then the caller calls startClient().
export const createMatrixSession = async (
  username: string,
  password: string
): Promise<CreatedSession> => {
  const sdk = await import("matrix-js-sdk");
  const baseUrl = matrixBaseUrl();

  const bootstrap = sdk.createClient({ baseUrl });
  const login = await bootstrap.loginRequest({
    identifier: { type: "m.id.user", user: username },
    initial_device_display_name: "SecurityOS (Tor)",
    password,
    type: "m.login.password",
  });

  const accessToken = login.access_token;
  const userId = login.user_id;
  const deviceId = login.device_id ?? "";

  const client = sdk.createClient({
    accessToken,
    baseUrl,
    deviceId,
    store: new sdk.MemoryStore(),
    userId,
  });

  // Rust crypto (Olm/Megolm via WASM). In-memory store → no keys on disk.
  // NON-FATAL: if E2EE fails to initialise (e.g. the WASM is blocked), still
  // connect so the user isn't locked out entirely — unencrypted rooms work and
  // encrypted ones show as locked. Without this, one crypto hiccup = "can't
  // connect at all".
  let cryptoReady = false;

  try {
    // BOUND the crypto init. initRustCrypto loads the Rust crypto WASM; if that load
    // ever stalls (blocked/slow over a constrained context) the bare `await` would
    // HANG sign-in forever on "Connecting over Tor…" — the reported stuck-before-
    // login symptom. Race it against a timeout and, on failure/timeout, connect
    // WITHOUT E2EE (unencrypted rooms work; encrypted rooms show as locked) instead
    // of freezing.
    await Promise.race([
      client.initRustCrypto({ useIndexedDB: false }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error("crypto-init-timeout")),
          CRYPTO_INIT_TIMEOUT_MS
        );
      }),
    ]);

    // Still send to / receive from devices we have not verified — without this
    // the client would refuse to encrypt to unverified devices and drop them.
    const crypto = client.getCrypto();

    if (crypto) crypto.globalBlacklistUnverifiedDevices = false;
    cryptoReady = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "SecurityOS Matrix: E2EE init failed or timed out — connecting without it",
      error
    );
  }

  return { accessToken, client, cryptoReady, deviceId, userId };
};

// Upload media via a PLAIN fetch (NOT client.uploadContent). The SDK's uploadContent
// uses an XMLHttpRequest with a HARD-CODED 30s IDLE timeout that resets only on
// upload-progress events. Through our proxy the body flushes near-instantly to the
// SAME-ORIGIN /api/matrix endpoint (firing the last progress event immediately),
// after which the request waits on the SLOW buffered Tor leg to the homeserver — so
// a perfectly healthy upload over a cold circuit hits the 30s timer and aborts with
// "Timeout". fetch has no such idle timer, so this is reliable over Tor. The proxy
// forwards Authorization + Content-Type and the upload returns the mxc content URI.
export const uploadMedia = async (
  accessToken: string,
  body: Blob | File,
  contentType: string,
  filename?: string
): Promise<string> => {
  const query = filename ? `?filename=${encodeURIComponent(filename)}` : "";
  const response = await fetch(
    `${matrixBaseUrl()}/_matrix/media/v3/upload${query}`,
    {
      body,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType || "application/octet-stream",
      },
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Upload failed (${response.status}) — the file may be too large or Tor is slow.`
    );
  }

  const json = (await response.json()) as { content_uri?: string };

  if (!json.content_uri) throw new Error("Upload returned no content URI.");

  return json.content_uri;
};

// crypto.subtle (WebCrypto Subtle) is only defined in a SECURE CONTEXT — HTTPS or
// http://localhost. Served over a plain http://<LAN-IP> origin, window.isSecureContext
// is false and crypto.subtle is undefined, so the encrypted-attachment AES-CTR/SHA-256
// below can't run at all. TEXT E2EE is unaffected (the Rust crypto WASM uses only
// crypto.getRandomValues, which works in insecure contexts) — only attachments need
// Subtle. We surface a clear, actionable error instead of the cryptic native
// "Cannot read properties of undefined (reading 'digest')".
export const isSecureCryptoContext = (): boolean =>
  typeof globalThis.crypto?.subtle !== "undefined";

const SECURE_CONTEXT_ERROR =
  "Encrypted attachments need a secure context — open SecurityOS over HTTPS or http://localhost (text messages still work).";

// --- Encrypted-attachment decryption (AES-CTR-256), per the Matrix spec --------
// matrix-js-sdk no longer re-exports a decryptAttachment helper, so we implement
// the documented scheme with WebCrypto: JWK key (base64url "k"), 16-byte IV that
// is the initial AES-CTR counter block (64-bit counter), SHA-256 over ciphertext.

type EncryptedFileInfo = {
  hashes?: { sha256?: string };
  iv: string;
  key: { k: string };
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }

  return bytes;
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;

  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];

  return diff === 0;
};

export const decryptAttachment = async (
  ciphertext: ArrayBuffer,
  info: EncryptedFileInfo
): Promise<ArrayBuffer> => {
  if (!isSecureCryptoContext()) throw new Error(SECURE_CONTEXT_ERROR);
  // Integrity: AES-CTR is unauthenticated and fully malleable, so the ciphertext
  // SHA-256 carried in the (Megolm-authenticated) event is the ONLY thing binding
  // the bytes we downloaded to what the sender encrypted. The Matrix spec marks it
  // REQUIRED — treat a missing/empty hash as a HARD failure so a hostile or
  // compromised homeserver can't strip it and serve tampered/substituted ciphertext
  // that we'd otherwise decrypt and render unchecked.
  const expectedHash = info.hashes?.sha256;

  if (!expectedHash) {
    throw new Error(
      "Encrypted attachment is missing its required SHA-256 hash."
    );
  }

  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", ciphertext)
  );

  if (!bytesEqual(digest, base64ToBytes(expectedHash))) {
    throw new Error("Attachment hash mismatch (tampered or corrupt).");
  }

  const keyBytes = base64ToBytes(info.key.k);
  const counter = base64ToBytes(info.iv);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    false,
    ["decrypt"]
  );

  return crypto.subtle.decrypt(
    { counter, length: 64, name: "AES-CTR" },
    cryptoKey,
    ciphertext
  );
};

export type EncryptedFileOut = {
  hashes: { sha256: string };
  iv: string;
  key: {
    alg: string;
    ext: boolean;
    k: string;
    key_ops: string[];
    kty: string;
  };
  v: string;
};

// Encrypt an attachment for an E2EE room (AES-CTR-256). Returns the ciphertext
// to upload and the `file` block to put in the m.image/m.file event (the caller
// fills in `url` after uploadContent). Mirrors decryptAttachment exactly.
export const encryptAttachment = async (
  plaintext: ArrayBuffer
): Promise<{ data: ArrayBuffer; file: Omit<EncryptedFileOut, "url"> }> => {
  if (!isSecureCryptoContext()) throw new Error(SECURE_CONTEXT_ERROR);
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const counter = new Uint8Array(16);

  counter.set(crypto.getRandomValues(new Uint8Array(8)), 0);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    true,
    ["encrypt"]
  );
  const data = await crypto.subtle.encrypt(
    { counter, length: 64, name: "AES-CTR" },
    cryptoKey,
    plaintext
  );
  const sha256 = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const unpadded = (value: string): string => value.replace(/=+$/, "");
  const base64Url = (bytes: Uint8Array): string =>
    unpadded(bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_"));

  return {
    data,
    file: {
      hashes: { sha256: unpadded(bytesToBase64(sha256)) },
      iv: unpadded(bytesToBase64(counter)),
      key: {
        alg: "A256CTR",
        ext: true,
        k: base64Url(keyBytes),
        key_ops: ["encrypt", "decrypt"],
        kty: "oct",
      },
      v: "v2",
    },
  };
};
