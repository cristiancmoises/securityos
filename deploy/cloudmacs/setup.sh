#!/bin/sh
# Cloudmacs host setup for SecurityOS — run ONCE before `docker compose up` on a
# fresh host so the cloudmacs container has Spacemacs + the SecurityOS dotfile.
# Idempotent: safe to re-run. The cloudmacs service mounts these host dirs:
#   ~/.cloudmacs.d   -> /home/emacs/.emacs.d        (the Spacemacs checkout)
#   ~/.spacemacs.d   -> /home/emacs/.spacemacs.d     (the dotfile: init.el)
#   ~/whatsappel     -> /home/emacs/whatsappel (ro)  (the whatsappel package)
#   ~/cloudmacs-data -> /home/emacs/data             (org notes, files)
# Packages (the enabled layers + Telega) install from MELPA on first open.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"

# 1) Spacemacs checkout (skip if already present).
if [ ! -f "$HOME/.cloudmacs.d/init.el" ]; then
  echo "Cloning Spacemacs into ~/.cloudmacs.d ..."
  rm -rf "$HOME/.cloudmacs.d"
  git clone --depth 1 https://github.com/syl20bnr/spacemacs "$HOME/.cloudmacs.d"
else
  echo "Spacemacs already present in ~/.cloudmacs.d"
fi

# 2) The SecurityOS dotfile + ASCII startup banner.
mkdir -p "$HOME/.spacemacs.d" "$HOME/cloudmacs-data"
cp "$HERE/spacemacs-init.el" "$HOME/.spacemacs.d/init.el"
cp "$HERE/securityos-banner.txt" "$HOME/.spacemacs.d/securityos-banner.txt"
echo "Installed ~/.spacemacs.d/init.el + securityos-banner.txt"

# 3) whatsappel (optional — only mounted if it exists).
if [ ! -d "$HOME/whatsappel" ]; then
  echo "NOTE: ~/whatsappel not found — clone github.com/cristiancmoises/whatsappel"
  echo "      there (and run its wuzapi backend) for live WhatsApp in Emacs."
fi

echo "Done. Now run: docker compose up -d cloudmacs"
