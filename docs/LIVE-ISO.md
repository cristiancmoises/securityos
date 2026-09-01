# Running a live security ISO in SecurityOS

SecurityOS includes a real x86 PC emulator (the **Virtual x86** app, powered by
v86, compiled to WebAssembly). You can boot a **live Linux ISO** in it — amnesic
by default (nothing is written back unless you explicitly save state).

Type `tails` (or `liveos`) in the Terminal to open it with these instructions.

## ⚠️ About TAILS specifically

**The real `TAILS.iso` will not boot here.** Since Tails 3.0 (2017), Tails ships
**64-bit (amd64) only**, and **v86 emulates a 32-bit (i686) CPU** — there is no
64-bit/long-mode support in any browser emulator fast enough for a desktop ISO.
This is an architecture limit, not a setting.

You have two good options instead:

1. **A 32-bit amnesic / Tor live ISO inside SecurityOS.** Any _i686_ live ISO
   boots in the Virtual x86 app and is amnesic. Route its network through Tor with
   the **Tor Control** app for TAILS-style anonymous, no-trace browsing.
2. **Real TAILS in a native VM (outside the browser).** Download `tails.iso` and
   boot it in QEMU/VirtualBox on your machine — that's the only way to run the
   genuine 64-bit Tails.

## How to boot a 32-bit live ISO here

1. Get a **32-bit (i686)** live `.iso` into your files (e.g. download it via the
   Browser, or copy it in through the File Explorer).
2. Open the `.iso` with the **Virtual x86** app (right-click → Open with, or just
   open it). It boots from the virtual CD (`boot_order` = CD first).
3. The VM gets up to ~1.5 GB RAM and 32 MB VGA — enough for a lightweight live
   desktop. Nothing persists across reboots unless you save state on close.
4. For anonymous networking, open **Tor Control** and select **Tor** before
   booting, so the guest's traffic exits over Tor.

## Why amnesic

The Virtual x86 guest has no disk unless you give it one, and SecurityOS itself
wipes session storage with CSPRNG randomness on shutdown. A live ISO booted from
the virtual CD leaves no trace once the VM is closed.
