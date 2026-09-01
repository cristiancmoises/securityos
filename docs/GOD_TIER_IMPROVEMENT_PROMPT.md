# SecurityOS GOD-Tier Evolution Prompt

Act as SecurityOS's principal security engineer, browser-platform architect,
privacy UX lead, accessibility reviewer, release manager, and incident-safe
operator. Work directly in the existing repository and finish the release; do
not stop at recommendations or mockups.

## Non-negotiable operating rules

1. Inspect the repository, `AGENTS.md`, framework-local documentation, current
   tests, dirty worktree, live service behavior, Docker topology, and deployment
   runbook before editing. Preserve unrelated user work.
2. Never put tokens, passwords, private keys, cookies, VPS credentials, or secret
   headers in source, Git URLs, command arguments, logs, artifacts, or docs. Use
   hidden credential prompts only and recommend rotating any credential exposed
   in chat.
3. Keep the proxy SSRF guard, DNS/IP validation, redirect revalidation, response
   limits, opaque iframe origin, destination allowlists, Tor SOCKS5h DNS, stream
   isolation, and fail-closed behavior. Never claim a direct request is anonymous
   and never silently fall back from Tor to clearnet.
4. Optimize for practical navigation without making impossible promises. A
   proxied iframe cannot reproduce every browser primitive. When a site requires
   a top-level origin, persistent storage, DRM, extensions, WebAuthn, WebRTC, or
   anti-embedding behavior, show a clear, deliberate native-window action and its
   privacy consequences.
5. Use original SecurityOS names, colors, icons, and artwork. Undercover may use
   familiar enterprise-desktop interaction patterns, but must contain no
   Microsoft/Windows names, logos, trademarks, copied icons, wallpaper, sounds,
   or proprietary assets.

## Product work

### Zupt

- Rename every user-facing `Vaptvupt`/`VaptVupt` web-app label and shortcut to
  **Zupt**, including the process title, desktop, Start menu, docs, help text,
  context menus, and accessibility labels.
- Preserve compatibility for persisted sessions or external launch links that
  still refer to the historical process identifier; do not strand saved state.
- Keep the existing isolated Tor and explicit clearnet modes, bounded RAM-only
  CSRF cookie bridge, uploads, downloads, compression, encryption, recovery, and
  circuit rotation working.

### Undercover

- Refine Undercover into a polished, neutral enterprise desktop: centered
  launcher, layered translucent panel, compact taskbar, coherent window chrome,
  restrained blue/graphite palette, clear focus states, and familiar spacing.
- Retain SecurityOS identity and original assets everywhere. Do not display the
  name or branding of any proprietary operating system.
- Switching Undercover on and off must be reversible in one click without
  changing files, application state, or network behavior.

### IRC and GODS EYE

- Give both apps the same clearly labeled **Tor / Clearnet** segmented switch
  pattern used by Zupt.
- Tor is the initial mode and must fail closed through SecurityOS's HTTP proxy.
  Give each Tor reload a fresh 128-bit stream-isolation token. Treat IRC
  Socket.IO and GODS EYE/Cesium behavior as best-effort until end-to-end tests
  prove each capability; never document an unverified full client.
- Clearnet mode must be visibly marked direct/not anonymous. IRC and GODS EYE use
  native service-origin iframes for compatibility, so their direct HTTP,
  Socket.IO, modules, and workers do not traverse `/api/ws`. Retain a clearly
  labeled native top-level fallback.
- Keep IRC's Tor-mode Socket.IO tunnel narrowly limited to the exact HTTPS origin
  and canonical Engine.IO path. Do not expose a generic WebSocket relay.

### Application catalog

- Remove **WhatsApp**, **Telegram**, **Session**, and **CryptPad** from the desktop,
  Start menu, process directory, handbook, bookmarks, search index, dedicated
  proxy reachability, assets, and all user-facing launch paths.
  Do not delete unrelated session-state infrastructure whose name happens to be
  `session`.
- Add a **Wiki** app for `https://wiki.securityops.co`. It must support Tor and
  clearnet modes with truthful route badges, loading/error guidance, reload, and
  an appropriate top-level fallback.
- Audit every registered application and shortcut icon. Every reference must
  resolve at its supported 16/32/48/96/144-pixel variants or use a deliberate
  static asset. Give Zupt, Wiki, IRC, GODS EYE, both browsers, Matrix, Keywave,
  and Undercover distinctive, legible, original SecurityOS icons. No generic
  placeholder or broken icon is acceptable.

### Clearnet Browser

- Start at `https://securityops.co/` and use that exact SecurityOps origin for
  address-bar searches. Remove third-party search as the default.
- Start with all JavaScript allowed. Preserve the visible script control so users
  can choose first-party-only or no-script modes.
- Provide robust tabs, back/forward history, reload/stop, address synchronization,
  editable bookmarks, keyboard submission, popup/new-tab capture, download/form
  compatibility, clear loading/error UI, and a native-window fallback.
- Route only through explicit direct egress and keep the **DIRECT · NOT
  ANONYMOUS** status permanently visible.

### Tor Browser

- Improve tabs, history synchronization, circuit rotation, onion/clearnet address
  parsing, popup handling, form/download behavior, loading/error UI, bookmarks,
  keyboard navigation, and accessible labels.
- Keep JavaScript off by default, with first-party-only and all-script choices.
  Changing script policy must never change Tor routing.
- Route `.onion` and public sites through SOCKS5h with per-tab isolation and no
  direct fallback. Make external native-window actions explain that anonymity is
  preserved only when the outer browser/environment is itself Tor-routed.

## Documentation and compatibility

- Update the repository README, in-OS desktop README/handbook, changelog, Tor
  threat model, application tables, screenshots/copy where applicable, and
  deployment runbook so they describe the shipped behavior exactly.
- Remove stale active references to WhatsApp, Telegram, Session, CryptPad, and the
  Vaptvupt app name. Preserve historical changelog entries only when clearly
  historical.
- Document iframe/browser limitations, direct-mode exposure, Tor failure modes,
  circuit rotation, Wiki/IRC/GODS EYE routing, rollback, and icon requirements.

## Acceptance gates

1. Verify every configured live origin and test both HTTP and real Engine.IO
   WebSocket paths where applicable. Test Tor and direct routes independently.
2. Add or update focused tests for browser defaults/search construction,
   mode-switch routing, allowlists, removed app identifiers, compatibility aliases,
   bookmarks, icon existence, proxy flags, and fail-closed behavior.
3. Run frozen dependency installation, full JavaScript and production audits,
   Rust audit/tests/formatting, Jest, TypeScript, stylelint, Prettier, production
   Next build, Docker build, local smoke, and adversarial proxy checks. Report any
   pre-existing lint baseline separately; never hide failures.
4. Inspect the final diff for secrets and unrelated changes. Commit reviewable
   changes and verify every configured remote's `main` equals the final local
   commit after pushing.

## Deployment gate

Build an immutable `linux/amd64` runtime image locally. Verify its ID and archive
hash, then connect through the approved Evelin client. Treat the dirty production
checkout as immutable evidence. Capture a timestamped root-only rollback state and
tag the exact old web image before touching production.

Replace only the Compose-owned `securityos` web container with `--no-deps`,
`--no-build`, and `--pull never`. Never recreate Tor or Cloudmacs, or mutate
reverse-proxy attachments, networks, volumes, or bind mounts. Automatically
restore the old web image if identity, topology, local HTTP, Tor exit, public
HTTPS, Matrix, Zupt, Wiki, IRC, GODS EYE, browser, or WebSocket validation fails.
Keep both candidate and rollback tags throughout the observation window.

Cloudmacs source remains in the repository as an optional, profile-gated local
deployment, but the IONOS production state must have no Cloudmacs container, no
dedicated Cloudmacs network, and no reverse-proxy attachment to such a network.
The default production image must also omit its catalog entry, shortcuts, editor
association, icon assets, and loopback CSP allowances. Prove those absences before
and after every cutover. Every operation must use the ordered production stack:
preserved base, reviewed immutable per-release web override, then the root-only
IONOS exclusion override last. The exclusion is not auto-loaded; omitting it can
recreate Cloudmacs. Retain dormant Cloudmacs host directories as unmounted
user/rollback data; destructive deletion or re-enabling Cloudmacs requires
separate authorization.

The work is complete only when the clean repository, all real remotes, the
verified artifact, and the live public deployment agree on the reviewed release.
