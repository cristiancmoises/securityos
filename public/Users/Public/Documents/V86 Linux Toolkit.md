# 🐧 V86 Linux Security Toolkit

The **V86** app boots a real x86 Linux in your browser. Here's how to make it a
usable security lab and route it through Tor.

## Boot a VM
Open an `.img` / `.iso` Linux disk image with the V86 app. Your changes are saved
as a state snapshot on close, so setup persists. **Networking is off by default**
— enable it in the **Tor Control** app (then reboot the VM).

## Add tools — install inside the VM (easiest)
1. Boot Linux, open **Tor Control** → **Tor** (or **Clearnet**), reboot the VM.
2. Install over the network:
   - Alpine: `apk update && apk add nmap tcpdump curl bind-tools openssl jq git`
   - Debian: `apt-get update && apt-get install -y nmap tcpdump curl dnsutils john`
3. Close the VM — tools persist in the saved snapshot.

> Package managers use TCP, so they work over Tor. **`ping`/raw UDP do NOT** —
> use `nmap -sT`. See `TOR.md`.

## Add tools — bake a custom image (reproducible)
Build offline with `alpine-make-vm-image`, `debootstrap`+chroot, or Buildroot
(enable `BR2_PACKAGE_NMAP`, …) to produce a bootable raw image with your toolset
preinstalled, then open it in V86. Keep images small.

## Suggested toolkit
`nmap` · `tcpdump` · `curl`/`wget` · `bind-tools` · `openssl` · `jq` · `git` ·
`tmux` · `vim` · `john` · `hydra` · `netcat` · `socat` · `python3`+`pip`.

## Verify Tor (inside the guest)
```
curl https://check.torproject.org/api/ip      →   "IsTor": true
```
For full anonymity, also open SecurityOS itself via the Tor Browser / `.onion`
(see `TOR.md`).

## Caveats
Emulation is slow and single-core; snapshots can grow large; only test systems
you're authorized to assess.
