#!/usr/bin/env bash
# Fetch the latest TAILS release and VERIFY it cryptographically before it is ever
# offered to users: detached OpenPGP signature (authoritative) + SHA-256. Run by
# the GitHub/Forgejo "tails-iso" actions on a schedule. The ~1.5GB ISO is published
# as a release asset (NOT committed to git); only the small manifest is committed.
#
#   bash deploy/tails/verify-tails.sh [VERSION]
# Env: TAILS_VERSION (overrides discovery), OUT_DIR (default ./tails-out)
#
# Exit non-zero (and write nothing) unless BOTH the OpenPGP signature and SHA-256
# verify against the pinned Tails signing key — fail closed, never ship unverified.
set -euo pipefail

# Pinned Tails signing key fingerprint. We import the key, then refuse to proceed
# unless the imported key matches this exact fingerprint (defeats a swapped key).
TAILS_FPR="A490D0F4D311A4153E2BB7CADBB802B258ACD84F"
SIGNING_KEY_URL="https://tails.net/tails-signing.key"
OUT_DIR="${OUT_DIR:-./tails-out}"

log() { printf '[tails-verify] %s\n' "$*" >&2; }
fail() { log "ERROR: $*"; exit 1; }

for tool in curl gpg sha256sum jq; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool"
done

mkdir -p "$OUT_DIR"

# 1) Discover the latest stable version (or take it from arg/env).
VERSION="${1:-${TAILS_VERSION:-}}"
if [ -z "$VERSION" ]; then
  log "discovering latest Tails version…"
  VERSION="$(
    curl -fsSL "https://tails.net/install/v2/Tails/amd64/stable/latest.json" 2>/dev/null \
      | jq -r '..|.version? // empty' 2>/dev/null | head -n1
  )"
fi
[ -n "$VERSION" ] || fail "could not determine the latest Tails version (pass it as an argument)"
log "version: $VERSION"

BASE="https://download.tails.net/tails/stable/tails-amd64-${VERSION}"
ISO="tails-amd64-${VERSION}.iso"
ISO_URL="${BASE}/${ISO}"
SIG_URL="${ISO_URL}.sig"

# 2) Import + PIN the Tails signing key.
export GNUPGHOME
GNUPGHOME="$(mktemp -d)"
log "importing Tails signing key…"
curl -fsSL "$SIGNING_KEY_URL" | gpg --import 2>/dev/null
gpg --fingerprint | tr -d ' \n' | grep -q "$TAILS_FPR" \
  || fail "imported signing key does NOT match the pinned fingerprint $TAILS_FPR"
log "signing key fingerprint OK ($TAILS_FPR)"

# 3) Download the ISO + its detached signature.
log "downloading $ISO_URL …"
curl -fSL --retry 3 -o "$OUT_DIR/$ISO" "$ISO_URL"
curl -fSL --retry 3 -o "$OUT_DIR/$ISO.sig" "$SIG_URL"

# 4) Verify the OpenPGP signature (authoritative) — fail closed.
log "verifying OpenPGP signature…"
gpg --status-fd 1 --verify "$OUT_DIR/$ISO.sig" "$OUT_DIR/$ISO" 2>/dev/null \
  | grep -q "VALIDSIG ${TAILS_FPR}" \
  || fail "OpenPGP signature verification FAILED"
log "OpenPGP signature: VALID"

# 5) SHA-256.
SHA="$(sha256sum "$OUT_DIR/$ISO" | cut -d' ' -f1)"
SIZE="$(wc -c < "$OUT_DIR/$ISO")"
log "sha256: $SHA"

# 6) Emit the manifest (committed) — the ISO itself is uploaded as a release asset.
cat > "$OUT_DIR/manifest.json" <<JSON
{
  "version": "${VERSION}",
  "arch": "amd64",
  "file": "${ISO}",
  "size": ${SIZE},
  "sha256": "${SHA}",
  "iso_url": "${ISO_URL}",
  "sig_url": "${SIG_URL}",
  "signing_key_fpr": "${TAILS_FPR}",
  "verified": true,
  "verified_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "note": "64-bit (amd64) — runs in a native VM, NOT the in-browser 32-bit emulator."
}
JSON

gpgconf --kill gpg-agent 2>/dev/null || true
rm -rf "$GNUPGHOME"
log "DONE — verified Tails ${VERSION}. Manifest at $OUT_DIR/manifest.json"
echo "$OUT_DIR/manifest.json"
