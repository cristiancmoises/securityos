# SecurityOS Cloudmacs image.
#
# Builds on the official karlicoss/cloudmacs image and fixes the one thing that
# breaks its non-root (asEnvUser / su-exec) startup path: `gotty` is installed to
# /root/go/bin, which is NOT on PATH and lives under /root (not traversable by the
# unprivileged `emacs` user), so the container's `su-exec emacs gotty …` dies with
# "gotty: No such file or directory" and crash-loops. We copy gotty onto a
# world-accessible PATH directory so it runs as the emacs user.
#
# (The full from-source build — Emacs + Gotty + su-exec + asEnvUser — lives in the
# upstream repo; this thin layer keeps the deploy fast and reliable. Upstream:
# https://github.com/karlicoss/cloudmacs — see ./LICENSE.)
FROM karlicoss/cloudmacs:latest

USER root
RUN cp /root/go/bin/gotty /usr/local/bin/gotty \
 && chmod 0755 /usr/local/bin/gotty \
 && gotty --version

# ENTRYPOINT (asEnvUser) and CMD (gotty … emacsclient --tty) are inherited.
