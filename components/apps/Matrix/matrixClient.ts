// SecurityOS Matrix — client-only factory around matrix-js-sdk (Rust crypto / E2EE).
//
// EVERYTHING is routed through the SAME-ORIGIN Tor proxy: baseUrl="/api/matrix",
// so the SDK requests "/api/matrix/_matrix/client/...", which pages/api/matrix/
// [...path].ts forwards to matrix.securityops.co over Tor (SOCKS5h, DNS at Tor).
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

export const MATRIX_BASE_URL = "/api/matrix";
export const HOMESERVER_LABEL = "matrix.securityops.co";

export type CreatedSession = {
  accessToken: string;
  client: MatrixClient;
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

  const bootstrap = sdk.createClient({ baseUrl: MATRIX_BASE_URL });
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
    baseUrl: MATRIX_BASE_URL,
    deviceId,
    store: new sdk.MemoryStore(),
    userId,
  });

  // Rust crypto (Olm/Megolm via WASM). In-memory store → no keys on disk.
  await client.initRustCrypto({ useIndexedDB: false });

  // Still send to / receive from devices we have not verified — without this the
  // client would refuse to encrypt to unverified devices and silently drop them.
  const crypto = client.getCrypto();

  if (crypto) crypto.globalBlacklistUnverifiedDevices = false;

  return { accessToken, client, deviceId, userId };
};

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

const base64ToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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
  // Integrity: the ciphertext SHA-256 must match the hash in the event.
  if (info.hashes?.sha256) {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", ciphertext)
    );

    if (!bytesEqual(digest, base64ToBytes(info.hashes.sha256))) {
      throw new Error("Attachment hash mismatch (tampered or corrupt).");
    }
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
