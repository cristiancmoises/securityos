# GNU Guix + fish + fastfetch in SecurityOS

The in-browser **Terminal** is a sandboxed JavaScript shell — it emulates many
UNIX commands but **cannot run native binaries** (a real package manager, compiler,
or `fastfetch` needs a Linux kernel). The full Guix environment runs in the
**V86 Linux VM**: a genuine x86 Linux kernel running in your browser via WebAssembly.

Typing `guix`, `fish`, or `fastfetch` in the Terminal explains this and opens the
V86 app for you.

## What you get

A reproducible Guix System image (`deploy/vm-setup/guix-system-image.scm`) that boots with:

- **GNU Guix** — `guix install`, `guix build`, `guix shell`, `guix system reconfigure`
- **fish** as the **default login shell**
- **fastfetch** shown automatically on every interactive login
- A toolkit: `openssh git curl wget jq tmux vim gnupg python cryptsetup nmap tcpdump socat`

## 1. Build the image (on any machine with Guix)

```bash
guix system image --image-type=raw --image-size=6G \
    deploy/vm-setup/guix-system-image.scm
```

Guix prints a store path ending in `.img` — that's your bootable disk image.

> **Reproducibility:** record the Guix commit with `guix describe` (or pin a
> `channels.scm` and `guix pull -C channels.scm`). The same `.scm` + same commit
> always builds bit-identical software.

## 2. Boot it in SecurityOS

1. Open the **V86** app (or type `guix` in the Terminal — it opens V86).
2. Load the `.img` you built as the VM's disk image.
3. Log in as `operator`. fish starts as your shell and `fastfetch` prints the
   system summary.

## 3. Use Guix

```fish
guix install <package>          # transactional install (rollback-able)
guix shell <package> -- <cmd>   # ephemeral environment, nothing persisted
guix build <package>            # build/test from source
guix system reconfigure /etc/config.scm   # atomic, declarative system updates
```

## 4. Route Guix through Tor (privacy)

The VM defaults to the local, fail-closed Tor relay. Before `guix pull` /
`guix install`, start the local bridge and confirm **Tor Control** remains on
**Tor**. If the bridge is unavailable, the guest stays offline rather than
falling back to clearnet. Verify inside the guest:

```fish
curl https://check.torproject.org/api/ip   # IsTor: true
```

## 5. One-shot toolkit bootstrap (alternative)

If you boot a generic Linux image instead of the Guix System image, run
`deploy/vm-setup/securityops-bootstrap.sh` inside the guest — it installs Guix,
sets fish + fastfetch up the same way, installs the toolkit, and builds your
Forgejo projects (evelin / vaptvupt / btp).

## Why not run Guix in the JS terminal?

Guix is a native ELF program that needs `fork`/`exec`, a real filesystem, and a
build daemon. The Terminal is a pure-JavaScript REPL over an IndexedDB filesystem —
there is no kernel to exec against. This is a hard browser boundary, not a missing
feature; the VM is the correct place for native tools, and it keeps them isolated
from the host.
