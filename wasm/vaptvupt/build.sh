#!/usr/bin/env bash
# Build the real Vaptvupt crypto engine to WebAssembly for SecurityOS.
#
# Compiles Vaptvupt's own authenticated-encryption core (PBKDF2-SHA256 ->
# AES-256-CTR + HMAC-SHA256, encrypt-then-MAC) — NOT a JS stand-in — into a
# single, self-contained, CSP-safe (no eval) module. Output is committed to
# public/Program Files/Vaptvupt/vaptvupt.js and loaded by utils/vaptvuptCrypto.ts.
#
# Prereqs: Docker. Vaptvupt source checked out at $VV (default ~/vaptvupt).
# Run:  bash wasm/vaptvupt/build.sh   (then it copies the artifact into public/)
set -eu

VV="${VV:-$HOME/vaptvupt}"            # Vaptvupt source tree
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/out"
mkdir -p "$OUT"

# Crypto-only subset (portable C): no SIMD/SHANI (x86-gated off), no threads/disk/
# mlock (stubbed in vv_wasm.c). DYNAMIC_EXECUTION=0 => no eval/new Function (CSP).
docker run --rm -v "$VV:/vv:ro" -v "$HERE:/work" emscripten/emsdk \
  emcc -O3 -I /vv/include \
    /work/vv_wasm.c \
    /vv/src/zupt_crypto.c /vv/src/zupt_aes256.c /vv/src/zupt_sha256.c /vv/src/zupt_keccak.c \
    /vv/src/zupt_mlkem.c /vv/src/zupt_x25519.c \
    -s WASM=1 -s SINGLE_FILE=1 -s MODULARIZE=1 -s EXPORT_NAME=VaptvuptModule \
    -s DYNAMIC_EXECUTION=0 -s ALLOW_MEMORY_GROWTH=1 -s ENVIRONMENT=web,worker,node \
    -s 'EXPORTED_FUNCTIONS=["_vv_pw_encrypt","_vv_pw_decrypt","_vv_is_zupt","_vv_pq_keygen","_vv_pq_encrypt","_vv_pq_decrypt","_vv_is_pq","_vv_pq_pubkey_len","_vv_pq_privkey_len","_vv_malloc","_vv_free","_malloc","_free"]' \
    -s 'EXPORTED_RUNTIME_METHODS=["HEAPU8","UTF8ToString","stringToUTF8","lengthBytesUTF8","getValue","setValue"]' \
    -o /work/out/vaptvupt.js

install -D -m 0644 "$OUT/vaptvupt.js" "$REPO/public/Program Files/Vaptvupt/vaptvupt.js"
echo "Built + installed public/Program Files/Vaptvupt/vaptvupt.js ($(wc -c < "$OUT/vaptvupt.js") bytes)"
