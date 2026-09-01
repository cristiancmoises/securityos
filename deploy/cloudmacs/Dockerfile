# SecurityOS Cloudmacs image.
#
# The upstream image installs gotty to /root/go/bin, which is not on PATH and
# cannot be traversed by the unprivileged emacs user. Copy it to a shared PATH
# directory so the inherited entrypoint can start reliably.
# Upstream: https://github.com/karlicoss/cloudmacs (see ./LICENSE).

FROM karlicoss/cloudmacs:latest
USER root
RUN cp /root/go/bin/gotty /usr/local/bin/gotty \
 && chmod 0755 /usr/local/bin/gotty \
 && gotty --version
# git + ca-certificates: REQUIRED so Spacemacs can install GitHub-recipe packages.
#   Spacemacs' built-in spacemacs-editing-visual layer installs `term-cursor` via a
#   github recipe (h0d/term-cursor.el) which quelpa clones with `git`. Without git
#   that ONE package fails ("error during installing of term-cursor") while the
#   ~215 MELPA tarball packages install fine — exactly the symptom we hit.
# gnupg: lets ELPA verify signed package archives instead of warning/failing.
# ripgrep: Spacemacs' preferred search tool (dotspacemacs-search-tools "rg" …).
RUN apk add --no-cache git ca-certificates gnupg ripgrep

# ENTRYPOINT (asEnvUser) and CMD (gotty … emacsclient --tty) are inherited.
