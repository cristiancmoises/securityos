# SecurityOS Cloudmacs image.
#
# The upstream image installs gotty to /root/go/bin, which is not on PATH and
# cannot be traversed by the unprivileged emacs user. Copy it to a shared PATH
# directory so the inherited entrypoint can start reliably.
# Upstream: https://github.com/karlicoss/cloudmacs (see ./LICENSE). Pin the
# reviewed linux/amd64 base digest so a later mutable `latest` cannot silently
# change a release build.

FROM karlicoss/cloudmacs@sha256:a248a9c751bca0fa4f27e3fbe9db61de891562d9e7ce60609d3d650334163528
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
# Upgrade the pinned Alpine base first so its runtime libraries receive the
# current security fixes instead of retaining the snapshot's older packages.
RUN apk upgrade --no-cache \
 && apk add --no-cache git ca-certificates gnupg ripgrep

# ENTRYPOINT (asEnvUser) and CMD (gotty … emacsclient --tty) are inherited.
