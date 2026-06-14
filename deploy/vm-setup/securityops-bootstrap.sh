#!/usr/bin/env bash
# SecurityOS — Linux VM bootstrap.
#
# The in-browser JS Terminal cannot run native code or a real package manager.
# Your native tools (Evelin/Rust, Vaptvupt/C), GNU Guix, compilers and real disk
# encryption belong in the v86 Linux VM — a genuine Linux kernel in the browser.
#
# Run this INSIDE the VM after enabling networking via the Tor Control app (so it
# fetches over Tor). REVIEW it first; package/build steps are illustrative — adapt
# to your Guix channel (codeberg.org/berkeley/guix-config).
set -eu

echo "[*] SecurityOS VM bootstrap — verify Tor first:"
command -v curl >/dev/null 2>&1 && curl -fsS https://check.torproject.org/api/ip || true
echo

# 1) GNU Guix (transactional package manager + builder + service manager).
if ! command -v guix >/dev/null 2>&1; then
  echo "[*] Installing GNU Guix..."
  cd /tmp
  wget -q https://git.savannah.gnu.org/cgit/guix.git/plain/etc/guix-install.sh
  chmod +x guix-install.sh
  ./guix-install.sh        # interactive; review before running
fi
guix pull || true
# Use your own channel for reproducible builds:
#   git clone <codeberg.org/berkeley/guix-config> ~/.config/guix && guix pull

# 2) Shell + system info: fish as the default login shell, fastfetch on login.
guix install fish fastfetch || true

# Make fish the login shell for the current user (idempotent).
if command -v fish >/dev/null 2>&1; then
  FISH_PATH="$(command -v fish)"
  grep -qxF "$FISH_PATH" /etc/shells 2>/dev/null || echo "$FISH_PATH" | sudo tee -a /etc/shells >/dev/null 2>&1 || true
  sudo chsh -s "$FISH_PATH" "$(id -un)" 2>/dev/null || chsh -s "$FISH_PATH" 2>/dev/null || true

  # Run fastfetch on every interactive fish login (guarded so scripts/pipes skip it).
  mkdir -p "$HOME/.config/fish"
  if ! grep -q "fastfetch" "$HOME/.config/fish/config.fish" 2>/dev/null; then
    cat >> "$HOME/.config/fish/config.fish" <<'FISHCFG'
# SecurityOS: show system info on interactive login only.
if status is-interactive
    command -v fastfetch >/dev/null; and fastfetch
end
FISHCFG
  fi
fi

# 3) Security toolkit (compile/test/install with Guix). Adjust names per channel.
guix install \
  nmap tcpdump wget curl jq git tmux vim openssl gnupg \
  cryptsetup john hashcat hydra socat netcat python || true

# 4) Your projects — built from Forgejo. HTTP git is disabled on git.securityops.co,
#    so clone over SSH (add your key to the Forgejo account first).
mkdir -p ~/securityops && cd ~/securityops
for repo in evelin vaptvupt btp; do
  [ -d "$repo" ] || git clone "git@git.securityops.co:cristiancmoises/$repo.git" \
    || echo "  ! clone $repo failed — add an SSH key / check access"
done
( cd evelin   2>/dev/null && command -v cargo >/dev/null && cargo build --release ) || true
( cd vaptvupt 2>/dev/null && [ -e Makefile ] && make ) || true
( cd btp      2>/dev/null && command -v cargo >/dev/null && cargo build --release ) || true

cat <<'EOF'

[*] Done. Now you have a FULL Linux workstation in SecurityOS:
    - guix install/build/shell ...     (compile, test, install — reproducibly)
    - cryptsetup / gpg                 (real disk + file encryption)
    - evelin / vaptvupt                (your native tools, in ~/securityops/*/target|.)
    - nmap, tcpdump, john, hydra, ...  (security toolkit)
    Route it all through Tor with the Tor Control app.
EOF
