/*
 * Vaptvupt WebAssembly wrapper for SecurityOS.
 *
 * Exposes the REAL Vaptvupt crypto engine (its own PBKDF2-SHA256 ->
 * AES-256-CTR + HMAC-SHA256 authenticated encryption, encrypt-then-MAC) for
 * in-browser file/folder encryption — no JavaScript stand-in. Symmetric AES-256
 * is quantum-resistant; the ML-KEM/X25519 hybrid (vv_pq_*) covers public-key
 * key exchange.
 *
 * Container layout (.zupt):
 *   MAGIC(8) | salt(32) | nonce(16) | iter(u32 LE) | zupt_encrypt_buffer pkg
 *
 * Salt + nonce are generated in JS (crypto.getRandomValues) and passed in, so we
 * never need OS entropy inside WASM. mlock is a no-op here (linear memory only).
 */
#include <emscripten/emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "zupt.h"
#include "zupt_keccak.h"
#include "zupt_mlkem.h"
#include "zupt_x25519.h"

/* mlock(2) isn't available under WASM; key material lives in linear memory. */
int zupt_mlock_keys(void *p, size_t n) {
  (void)p;
  (void)n;
  return 0;
}
void zupt_munlock_keys(void *p, size_t n) {
  (void)p;
  (void)n;
}

#define VV_MAGIC "ZUPTPQ1\n"
#define VV_MAGIC_LEN 8
#define VV_ITER 310000u
#define VV_HDR (VV_MAGIC_LEN + 32 + 16 + 4) /* 60 */

/* Encrypt `plain` with `pw`. salt(32)+nonce(16) supplied by the caller (JS CSPRNG).
 * Returns a malloc'd .zupt container; writes its length to *out_len. NULL on error.
 * Free the result with vv_free(). */
EMSCRIPTEN_KEEPALIVE
uint8_t *vv_pw_encrypt(const char *pw, const uint8_t *salt, const uint8_t *nonce,
                       const uint8_t *plain, size_t plen, size_t *out_len) {
  *out_len = 0;

  zupt_keyring_t kr;
  zupt_keyring_init(&kr);
  zupt_derive_keys(&kr, pw, salt, nonce, VV_ITER);

  size_t pkglen = 0;
  uint8_t *pkg = zupt_encrypt_buffer(&kr, plain, plen, 0, &pkglen);
  if (!pkg) return NULL;

  size_t total = VV_HDR + pkglen;
  uint8_t *out = (uint8_t *)malloc(total);
  if (!out) {
    free(pkg);
    return NULL;
  }

  uint32_t iter = VV_ITER;
  memcpy(out, VV_MAGIC, VV_MAGIC_LEN);
  memcpy(out + VV_MAGIC_LEN, salt, 32);
  memcpy(out + VV_MAGIC_LEN + 32, nonce, 16);
  memcpy(out + VV_MAGIC_LEN + 48, &iter, 4);
  memcpy(out + VV_HDR, pkg, pkglen);
  free(pkg);

  *out_len = total;
  return out;
}

/* Decrypt a .zupt container produced by vv_pw_encrypt. Authenticated: returns
 * NULL on a wrong password or any tamper. Free the result with vv_free(). */
EMSCRIPTEN_KEEPALIVE
uint8_t *vv_pw_decrypt(const char *pw, const uint8_t *cont, size_t clen,
                       size_t *out_len) {
  *out_len = 0;
  if (clen < VV_HDR + 48) return NULL;
  if (memcmp(cont, VV_MAGIC, VV_MAGIC_LEN) != 0) return NULL;

  uint8_t salt[32], nonce[16];
  uint32_t iter;
  memcpy(salt, cont + VV_MAGIC_LEN, 32);
  memcpy(nonce, cont + VV_MAGIC_LEN + 32, 16);
  memcpy(&iter, cont + VV_MAGIC_LEN + 48, 4);

  zupt_keyring_t kr;
  zupt_keyring_init(&kr);
  zupt_derive_keys(&kr, pw, salt, nonce, iter);

  size_t plen = 0;
  uint8_t *plain =
      zupt_decrypt_buffer(&kr, cont + VV_HDR, clen - VV_HDR, 0, &plen);
  if (!plain) return NULL;

  *out_len = plen;
  return plain;
}

/* Is this buffer a Vaptvupt .zupt container? */
EMSCRIPTEN_KEEPALIVE
int vv_is_zupt(const uint8_t *buf, size_t len) {
  return len >= VV_HDR + 48 && memcmp(buf, VV_MAGIC, VV_MAGIC_LEN) == 0;
}

/* ───────────────────────── Post-quantum public-key mode ─────────────────────
 * A real hybrid KEM: ML-KEM-768 (FIPS 203) + X25519 (RFC 7748), built straight
 * from Vaptvupt's portable primitives (zupt_mlkem.c / zupt_x25519.c / Keccak) —
 * NOT the vendored x86 .so. A keypair is:
 *   PUBLIC  = ml-kem pk(1184) || x25519 pk(32)   = 1216
 *   PRIVATE = ml-kem sk(2400) || x25519 sk(32)   = 2432
 * Encrypt-to-public-key container (.zupt):
 *   "ZUPTPQK1"(8) | ml-kem ct(1088) | x25519 eph_pk(32) | zupt_encrypt_buffer pkg
 * Session key = SHA3-512(ss_mlkem || ss_x25519) -> enc(32)+mac(32); the AES-256
 * symmetric layer is quantum-resistant, the KEM gives post-quantum key exchange.
 */
#define VV_PQ_MAGIC "ZUPTPQK1"
#define VV_PQ_MAGIC_LEN 8
#define VV_PK_LEN (MLKEM_PUBLICKEYBYTES + 32) /* 1216 */
#define VV_SK_LEN (MLKEM_SECRETKEYBYTES + 32) /* 2432 */
#define VV_PQ_HDR (VV_PQ_MAGIC_LEN + MLKEM_CIPHERTEXTBYTES + 32)

EMSCRIPTEN_KEEPALIVE int vv_pq_pubkey_len(void) { return VV_PK_LEN; }
EMSCRIPTEN_KEEPALIVE int vv_pq_privkey_len(void) { return VV_SK_LEN; }

/* Generate a hybrid keypair into caller-allocated pub_out(1216) + priv_out(2432). */
EMSCRIPTEN_KEEPALIVE
int vv_pq_keygen(uint8_t *pub_out, uint8_t *priv_out) {
  uint8_t pk_kem[MLKEM_PUBLICKEYBYTES], sk_kem[MLKEM_SECRETKEYBYTES];
  uint8_t sk_x[32], pk_x[32];

  if (zupt_mlkem768_keygen(pk_kem, sk_kem) != 0) return -1;
  zupt_random_bytes(sk_x, 32);
  zupt_x25519_base(pk_x, sk_x);

  memcpy(pub_out, pk_kem, MLKEM_PUBLICKEYBYTES);
  memcpy(pub_out + MLKEM_PUBLICKEYBYTES, pk_x, 32);
  memcpy(priv_out, sk_kem, MLKEM_SECRETKEYBYTES);
  memcpy(priv_out + MLKEM_SECRETKEYBYTES, sk_x, 32);

  zupt_secure_wipe(sk_kem, MLKEM_SECRETKEYBYTES);
  zupt_secure_wipe(sk_x, 32);
  return 0;
}

static void vv_pq_session_keyring(zupt_keyring_t *kr, const uint8_t ss_kem[32],
                                  const uint8_t ss_x[32]) {
  uint8_t kdf_in[64], shared[64];

  memcpy(kdf_in, ss_kem, 32);
  memcpy(kdf_in + 32, ss_x, 32);
  zupt_sha3_512(kdf_in, 64, shared);

  zupt_keyring_init(kr);
  kr->canary_head = ZUPT_CANARY;
  kr->canary_tail = ZUPT_CANARY;
  memcpy(kr->enc_key, shared, 32);
  memcpy(kr->mac_key, shared + 32, 32);
  kr->active = 1;

  zupt_secure_wipe(shared, 64);
  zupt_secure_wipe(kdf_in, 64);
}

/* Encrypt `plain` to a recipient PUBLIC key. Free result with vv_free(). */
EMSCRIPTEN_KEEPALIVE
uint8_t *vv_pq_encrypt(const uint8_t *pub, const uint8_t *plain, size_t plen,
                       size_t *out_len) {
  *out_len = 0;

  const uint8_t *pk_kem = pub;
  const uint8_t *pk_x = pub + MLKEM_PUBLICKEYBYTES;
  uint8_t ct[MLKEM_CIPHERTEXTBYTES], ss_kem[32];

  if (zupt_mlkem768_encaps(ct, ss_kem, pk_kem) != 0) return NULL;

  uint8_t eph_sk[32], eph_pk[32], ss_x[32];
  zupt_random_bytes(eph_sk, 32);
  zupt_x25519_base(eph_pk, eph_sk);
  zupt_x25519(ss_x, eph_sk, pk_x);

  zupt_keyring_t kr;
  vv_pq_session_keyring(&kr, ss_kem, ss_x);
  zupt_random_bytes(kr.base_nonce, 16);

  size_t pkglen = 0;
  uint8_t *pkg = zupt_encrypt_buffer(&kr, plain, plen, 0, &pkglen);
  zupt_secure_wipe(ss_kem, 32);
  zupt_secure_wipe(ss_x, 32);
  zupt_secure_wipe(eph_sk, 32);
  if (!pkg) return NULL;

  size_t total = VV_PQ_HDR + pkglen;
  uint8_t *out = (uint8_t *)malloc(total);
  if (!out) {
    free(pkg);
    return NULL;
  }

  memcpy(out, VV_PQ_MAGIC, VV_PQ_MAGIC_LEN);
  memcpy(out + VV_PQ_MAGIC_LEN, ct, MLKEM_CIPHERTEXTBYTES);
  memcpy(out + VV_PQ_MAGIC_LEN + MLKEM_CIPHERTEXTBYTES, eph_pk, 32);
  memcpy(out + VV_PQ_HDR, pkg, pkglen);
  free(pkg);

  *out_len = total;
  return out;
}

/* Decrypt a PQ container with the recipient PRIVATE key. Free with vv_free(). */
EMSCRIPTEN_KEEPALIVE
uint8_t *vv_pq_decrypt(const uint8_t *priv, const uint8_t *cont, size_t clen,
                       size_t *out_len) {
  *out_len = 0;
  if (clen < VV_PQ_HDR + 48) return NULL;
  if (memcmp(cont, VV_PQ_MAGIC, VV_PQ_MAGIC_LEN) != 0) return NULL;

  const uint8_t *sk_kem = priv;
  const uint8_t *sk_x = priv + MLKEM_SECRETKEYBYTES;
  const uint8_t *ct = cont + VV_PQ_MAGIC_LEN;
  const uint8_t *eph_pk = cont + VV_PQ_MAGIC_LEN + MLKEM_CIPHERTEXTBYTES;
  const uint8_t *pkg = cont + VV_PQ_HDR;

  uint8_t ss_kem[32], ss_x[32];
  zupt_mlkem768_decaps(ss_kem, ct, sk_kem); /* implicit rejection on bad ct */
  zupt_x25519(ss_x, sk_x, eph_pk);

  zupt_keyring_t kr;
  vv_pq_session_keyring(&kr, ss_kem, ss_x);

  size_t plen = 0;
  uint8_t *plain = zupt_decrypt_buffer(&kr, pkg, clen - VV_PQ_HDR, 0, &plen);
  zupt_secure_wipe(ss_kem, 32);
  zupt_secure_wipe(ss_x, 32);
  if (!plain) return NULL; /* wrong key / tamper -> HMAC fails */

  *out_len = plen;
  return plain;
}

/* Is this buffer a Vaptvupt PQ public-key container? */
EMSCRIPTEN_KEEPALIVE
int vv_is_pq(const uint8_t *buf, size_t len) {
  return len >= VV_PQ_HDR + 48 && memcmp(buf, VV_PQ_MAGIC, VV_PQ_MAGIC_LEN) == 0;
}

EMSCRIPTEN_KEEPALIVE void *vv_malloc(size_t n) { return malloc(n); }
EMSCRIPTEN_KEEPALIVE void vv_free(void *p) { free(p); }
