export const BOOT_CD_FD_HD = 0x213;
export const BOOT_FD_CD_HD = 0x231;

// Guest packets flow through a WebSocket relay (ws/wss) that bridges them onto
// a real network. SecurityOS defaults to the local Tor relay instead of the
// upstream public third-party relay. If the local bridge is absent, connection
// fails closed; clearnet remains an explicit choice in Tor Control. The selected
// relay persists as `emulatorRelayUrl`. See TorControl and docs/TOR.md.
export const RELAY_PRESETS = {
  // Upstream public CLEARNET relay — convenient, but traffic exits in the clear
  // through a third party. Not private. Only for non-sensitive use.
  clearnet: "wss://relay.widgetry.org/",
  // Routes the guest's traffic through Tor via a local WebSocket->SOCKS5 bridge.
  // Run your own (docs/TOR.md / deploy/tor-relay); never trust a public Tor relay.
  tor: "ws://127.0.0.1:8081/",
} as const;

export const config = {
  autostart: true,
  bios: { url: "/Program Files/Virtual x86/bios/seabios.bin" },
  log_level: 0,
  vga_bios: { url: "/Program Files/Virtual x86/bios/vgabios.bin" },
  wasm_path: "/Program Files/Virtual x86/v86.wasm",
};

export const saveExtension = ".bin.save";
