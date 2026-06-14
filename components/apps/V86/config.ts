export const BOOT_CD_FD_HD = 0x213;
export const BOOT_FD_CD_HD = 0x231;

// SecurityOS: the v86 guest's network is OPT-IN. Guest packets flow through a
// WebSocket relay (ws/wss) that bridges them onto a real network. The upstream
// default auto-connected EVERY VM to a third-party relay on boot, exposing the
// user's IP and traffic. We leave networking OFF by default; the user picks a
// relay (clearnet or Tor) in the Tor Control app, which persists it to the
// session as `emulatorRelayUrl`. See components/apps/TorControl and docs/TOR.md.
export const RELAY_PRESETS = {
  // Routes the guest's traffic through Tor via a local WebSocket->SOCKS5 bridge.
  // Run your own (docs/TOR.md / deploy/tor-relay); never trust a public Tor relay.
  tor: "ws://127.0.0.1:8081/",
  // Upstream public CLEARNET relay — convenient, but traffic exits in the clear
  // through a third party. Not private. Only for non-sensitive use.
  clearnet: "wss://relay.widgetry.org/",
} as const;

export const config = {
  autostart: true,
  bios: { url: "/Program Files/Virtual x86/bios/seabios.bin" },
  log_level: 0,
  vga_bios: { url: "/Program Files/Virtual x86/bios/vgabios.bin" },
  wasm_path: "/Program Files/Virtual x86/v86.wasm",
};

export const saveExtension = ".bin.save";
