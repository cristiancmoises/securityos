;;; SecurityOS — reproducible Guix System image for the v86 Linux VM.
;;;
;;; This declares a complete, bootable GNU/Linux system with GNU Guix, `fish` as
;;; the default login shell, and `fastfetch` shown on every interactive login,
;;; plus a security toolkit. It is the "full Guix + services" environment that the
;;; in-browser JS terminal cannot be (native binaries need a real kernel) — boot
;;; the resulting image in the SecurityOS V86 app.
;;;
;;; Build a raw disk image (on any machine with Guix) and open it in the V86 app:
;;;   guix system image --image-type=raw --image-size=6G \
;;;       deploy/vm-setup/guix-system-image.scm
;;; The store path it prints is your bootable .img. See docs/GUIX-SETUP.md.
;;;
;;; Reproducible: pin the Guix commit (`guix describe` / a channels.scm) and this
;;; same file always yields bit-identical software.

(use-modules (gnu)
             (gnu system)
             (gnu packages)
             (gnu services ssh)
             (gnu services networking))

(use-package-modules admin shells package-management ssh version-control
                     networking security-token gnupg python tmux vim
                     pre-commit linux)

(operating-system
  (host-name "securityos-vm")
  (timezone "UTC")
  (locale "en_US.utf8")
  (keyboard-layout (keyboard-layout "us"))

  ;; v86 emulates a legacy BIOS PC, so use GRUB on the MBR of the disk.
  (bootloader (bootloader-configuration
               (bootloader grub-bootloader)
               (targets '("/dev/sda"))
               (keyboard-layout keyboard-layout)))

  (file-systems (cons (file-system
                        (device (file-system-label "securios-root"))
                        (mount-point "/")
                        (type "ext4"))
                      %base-file-systems))

  ;; A non-root user whose LOGIN SHELL is fish.
  (users (cons (user-account
                (name "operator")
                (comment "SecurityOS operator")
                (group "users")
                (supplementary-groups '("wheel" "netdev" "tty" "input"))
                (shell (file-append fish "/bin/fish")))
               %base-user-accounts))

  ;; Software available system-wide: Guix itself (so `guix install/build/shell`
  ;; work inside the VM), fish + fastfetch, and a security/build toolkit.
  (packages (append
             (list guix                 ; transactional package manager + builder
                   fish fastfetch       ; default shell + login system info
                   openssh git curl wget jq tmux
                   vim gnupg python
                   cryptsetup           ; real LUKS disk encryption in the VM
                   nmap tcpdump socat)
             %base-packages))

  (services
   (append
    (list
     ;; Real SSH service (e.g. to reach the VM, or for Evelin/keys work).
     (service openssh-service-type
              (openssh-configuration
               (openssh openssh)
               (password-authentication? #f)
               (permit-root-login #f)))

     ;; DHCP so the VM gets networking from the v86 relay (route via Tor Control).
     (service dhcp-client-service-type)

     ;; System-wide fish config: fish sources /etc/fish/config.fish at login, so
     ;; every interactive shell prints fastfetch. Guarded so scripts/pipes skip it.
     (simple-service 'securityos-fish-login
                     etc-service-type
                     (list `("fish/config.fish"
                             ,(plain-file "config.fish"
                                          "# SecurityOS: system info on interactive login only.
if status is-interactive
    command -v fastfetch >/dev/null; and fastfetch
end
")))))
    %base-services)))
