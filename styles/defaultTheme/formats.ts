const formats = {
  dateModified: {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  } as Intl.DateTimeFormatOptions,
  // Emacs look: the WHOLE UI is monospace (JetBrains Mono, self-hosted). The
  // Undercover overrides these with a neutral system sans stack.
  systemFont:
    "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
  // Mode-line / display text — also monospace for the Emacs aesthetic.
  displayFont:
    "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
  // Monospace (SIL OFL, self-hosted) for terminals / code surfaces.
  monoFont:
    "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
};

export default formats;
