// Vaptvupt encryption for the SecurityOS virtual filesystem — the REAL Vaptvupt
// engine compiled to WebAssembly (utils/.. -> /Program Files/Vaptvupt/vaptvupt.js),
// not a JavaScript stand-in. It runs Vaptvupt's own authenticated encryption
// (PBKDF2-SHA256 -> AES-256-CTR + HMAC-SHA256, encrypt-then-MAC). Symmetric AES-256
// is quantum-resistant; the engine also carries the ML-KEM/X25519 hybrid for
// public-key exchange. Encrypted files use the Vaptvupt ".zupt" extension/format.
//
// Drop-in API-compatible with the old AES helper so callers (the Vaptvupt GUI,
// the Terminal `vaptvupt`/`encrypt`/`decrypt` commands, and the file-manager
// Encrypt/Decrypt context menu) just import from here.

type VaptvuptModule = {
  HEAPU8: Uint8Array;
  _vv_pw_encrypt: (
    pw: number,
    salt: number,
    nonce: number,
    plain: number,
    plen: number,
    outLen: number
  ) => number;
  _vv_pw_decrypt: (
    pw: number,
    cont: number,
    clen: number,
    outLen: number
  ) => number;
  _vv_pq_keygen: (pubOut: number, privOut: number) => number;
  _vv_pq_encrypt: (
    pub: number,
    plain: number,
    plen: number,
    outLen: number
  ) => number;
  _vv_pq_decrypt: (
    priv: number,
    cont: number,
    clen: number,
    outLen: number
  ) => number;
  _vv_pq_pubkey_len: () => number;
  _vv_pq_privkey_len: () => number;
  _vv_malloc: (n: number) => number;
  _vv_free: (p: number) => void;
  getValue: (ptr: number, type: string) => number;
  lengthBytesUTF8: (s: string) => number;
  stringToUTF8: (s: string, ptr: number, max: number) => void;
};

const SCRIPT_SRC = "/Program Files/Vaptvupt/vaptvupt.js";
const MAGIC = "ZUPTPQ1\n";
const HEADER_LENGTH = 8 + 32 + 16 + 4; // magic + salt + nonce + iter
const MIN_LENGTH = HEADER_LENGTH + 48; // + smallest authenticated package

// Vaptvupt's encrypted-file extension/format. (The tool is "Vaptvupt"; ".zupt" is
// only the file format — never use "zupt" as the tool name.)
export const ENCRYPTED_EXTENSION = ".zupt";

// Post-quantum keypair files (ML-KEM-768 + X25519 hybrid).
export const PUBLIC_KEY_EXTENSION = ".vvpub";
export const PRIVATE_KEY_EXTENSION = ".vvkey";
const PUB_MAGIC = "VVPUBKY1";
const PRV_MAGIC = "VVPRVKY1";
const PQ_MAGIC = "ZUPTPQK1";

let modulePromise: Promise<VaptvuptModule> | undefined;

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const w = window as unknown as { VaptvuptModule?: () => Promise<unknown> };

    if (w.VaptvuptModule) {
      resolve();
      return;
    }

    const onError = (): void =>
      reject(new Error("Failed to load the Vaptvupt engine"));
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CSS.escape(SCRIPT_SRC)}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");

    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  });

const getModule = (): Promise<VaptvuptModule> => {
  if (!modulePromise) {
    modulePromise = (async () => {
      await loadScript();

      const factory = (
        window as unknown as { VaptvuptModule: () => Promise<VaptvuptModule> }
      ).VaptvuptModule;

      return factory();
    })();
  }

  return modulePromise;
};

// Cheap, dependency-free check (no WASM load needed): does the buffer carry the
// Vaptvupt .zupt magic and a plausible minimum length?
export const isEncrypted = (data: Buffer): boolean =>
  data.length >= MIN_LENGTH && data.subarray(0, 8).toString("latin1") === MAGIC;

export const encryptData = async (
  data: Buffer,
  password: string
): Promise<Buffer> => {
  const vv = await getModule();
  const salt = new Uint8Array(32);
  const nonce = new Uint8Array(16);

  crypto.getRandomValues(salt);
  crypto.getRandomValues(nonce);

  const pwBytes = vv.lengthBytesUTF8(password) + 1;
  const pwPtr = vv._vv_malloc(pwBytes);
  const saltPtr = vv._vv_malloc(32);
  const noncePtr = vv._vv_malloc(16);
  const plainPtr = vv._vv_malloc(data.length || 1);
  const lenPtr = vv._vv_malloc(4);

  vv.stringToUTF8(password, pwPtr, pwBytes);
  vv.HEAPU8.set(salt, saltPtr);
  vv.HEAPU8.set(nonce, noncePtr);
  vv.HEAPU8.set(data, plainPtr);

  const outPtr = vv._vv_pw_encrypt(
    pwPtr,
    saltPtr,
    noncePtr,
    plainPtr,
    data.length,
    lenPtr
  );

  try {
    if (!outPtr) throw new Error("Vaptvupt encryption failed");

    const outLen = vv.getValue(lenPtr, "i32");

    return Buffer.from(vv.HEAPU8.subarray(outPtr, outPtr + outLen));
  } finally {
    vv._vv_free(pwPtr);
    vv._vv_free(saltPtr);
    vv._vv_free(noncePtr);
    vv._vv_free(plainPtr);
    vv._vv_free(lenPtr);
    if (outPtr) vv._vv_free(outPtr);
  }
};

export const decryptData = async (
  data: Buffer,
  password: string
): Promise<Buffer> => {
  if (!isEncrypted(data)) {
    throw new Error("Not a Vaptvupt .zupt file.");
  }

  const vv = await getModule();
  const pwBytes = vv.lengthBytesUTF8(password) + 1;
  const pwPtr = vv._vv_malloc(pwBytes);
  const dataPtr = vv._vv_malloc(data.length || 1);
  const lenPtr = vv._vv_malloc(4);

  vv.stringToUTF8(password, pwPtr, pwBytes);
  vv.HEAPU8.set(data, dataPtr);

  const outPtr = vv._vv_pw_decrypt(pwPtr, dataPtr, data.length, lenPtr);

  try {
    // Authenticated: a wrong password or any tamper yields NULL.
    if (!outPtr) {
      throw new Error("Wrong password, or not a valid Vaptvupt .zupt file.");
    }

    const outLen = vv.getValue(lenPtr, "i32");

    return Buffer.from(vv.HEAPU8.subarray(outPtr, outPtr + outLen));
  } finally {
    vv._vv_free(pwPtr);
    vv._vv_free(dataPtr);
    vv._vv_free(lenPtr);
    if (outPtr) vv._vv_free(outPtr);
  }
};

// ── Post-quantum public-key mode (ML-KEM-768 + X25519 hybrid) ──

// Is this buffer a post-quantum (public-key) Vaptvupt container?
export const isPqEncrypted = (data: Buffer): boolean =>
  data.length >= 1128 && data.subarray(0, 8).toString("latin1") === PQ_MAGIC;

// Generate a hybrid post-quantum keypair. The returned buffers are the on-disk
// key files (magic-tagged) to save as .vvpub / .vvkey.
export const generateKeypair = async (): Promise<{
  publicKey: Buffer;
  privateKey: Buffer;
}> => {
  const vv = await getModule();
  const pkLen = vv._vv_pq_pubkey_len();
  const skLen = vv._vv_pq_privkey_len();
  const pubPtr = vv._vv_malloc(pkLen);
  const privPtr = vv._vv_malloc(skLen);

  try {
    if (vv._vv_pq_keygen(pubPtr, privPtr) !== 0) {
      throw new Error("Vaptvupt key generation failed");
    }

    const pub = Buffer.from(vv.HEAPU8.subarray(pubPtr, pubPtr + pkLen));
    const priv = Buffer.from(vv.HEAPU8.subarray(privPtr, privPtr + skLen));

    return {
      privateKey: Buffer.concat([Buffer.from(PRV_MAGIC, "latin1"), priv]),
      publicKey: Buffer.concat([Buffer.from(PUB_MAGIC, "latin1"), pub]),
    };
  } finally {
    vv._vv_free(pubPtr);
    vv._vv_free(privPtr);
  }
};

// Short hex fingerprint of a key file (for display).
export const keyFingerprint = async (keyFile: Buffer): Promise<string> => {
  const digestInput = new Uint8Array(keyFile.byteLength);

  digestInput.set(keyFile);

  const digest = await crypto.subtle.digest("SHA-256", digestInput);

  return [...new Uint8Array(digest).subarray(0, 8)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const encryptToPublicKey = async (
  data: Buffer,
  publicKeyFile: Buffer
): Promise<Buffer> => {
  const vv = await getModule();
  const pkLen = vv._vv_pq_pubkey_len();

  if (
    publicKeyFile.length !== 8 + pkLen ||
    publicKeyFile.subarray(0, 8).toString("latin1") !== PUB_MAGIC
  ) {
    throw new Error("Not a Vaptvupt public key (.vvpub).");
  }

  const pubPtr = vv._vv_malloc(pkLen);
  const dataPtr = vv._vv_malloc(data.length || 1);
  const lenPtr = vv._vv_malloc(4);

  vv.HEAPU8.set(publicKeyFile.subarray(8), pubPtr);
  vv.HEAPU8.set(data, dataPtr);

  const outPtr = vv._vv_pq_encrypt(pubPtr, dataPtr, data.length, lenPtr);

  try {
    if (!outPtr) throw new Error("Vaptvupt post-quantum encryption failed");

    const outLen = vv.getValue(lenPtr, "i32");

    return Buffer.from(vv.HEAPU8.subarray(outPtr, outPtr + outLen));
  } finally {
    vv._vv_free(pubPtr);
    vv._vv_free(dataPtr);
    vv._vv_free(lenPtr);
    if (outPtr) vv._vv_free(outPtr);
  }
};

export const decryptWithPrivateKey = async (
  data: Buffer,
  privateKeyFile: Buffer
): Promise<Buffer> => {
  const vv = await getModule();
  const skLen = vv._vv_pq_privkey_len();

  if (
    privateKeyFile.length !== 8 + skLen ||
    privateKeyFile.subarray(0, 8).toString("latin1") !== PRV_MAGIC
  ) {
    throw new Error("Not a Vaptvupt private key (.vvkey).");
  }
  if (!isPqEncrypted(data)) {
    throw new Error("Not a Vaptvupt post-quantum file.");
  }

  const privPtr = vv._vv_malloc(skLen);
  const dataPtr = vv._vv_malloc(data.length || 1);
  const lenPtr = vv._vv_malloc(4);

  vv.HEAPU8.set(privateKeyFile.subarray(8), privPtr);
  vv.HEAPU8.set(data, dataPtr);

  const outPtr = vv._vv_pq_decrypt(privPtr, dataPtr, data.length, lenPtr);

  try {
    if (!outPtr) {
      throw new Error("Wrong private key, or not a valid Vaptvupt PQ file.");
    }

    const outLen = vv.getValue(lenPtr, "i32");

    return Buffer.from(vv.HEAPU8.subarray(outPtr, outPtr + outLen));
  } finally {
    vv._vv_free(privPtr);
    vv._vv_free(dataPtr);
    vv._vv_free(lenPtr);
    if (outPtr) vv._vv_free(outPtr);
  }
};
