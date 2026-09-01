# SecurityOS God-Tier Improvement Prompt

Act as the principal security engineer, privacy UX designer, and senior Next.js
maintainer for SecurityOS. First inspect the codebase, deployment files, tests and
the existing threat model. Preserve user changes and never put secrets, access
tokens, private keys or VPS credentials in source, git remotes, logs, documentation
or shell history.

Deliver a production-ready improvement in small, reviewable commits:

1. Make Tor Browser a genuine tabbed navigation experience for `.onion` and
   clearnet destinations while preserving SOCKS5h DNS resolution, per-tab stream
   isolation, fail-closed Tor behavior, SSRF validation/IP pinning, sandboxed
   rendering, an explicit JavaScript safety control, and no destination logging.
2. Add a separate Clearnet Browser with equally complete tabs, history, reload,
   bookmarks and JavaScript controls. Make its direct egress conspicuous; it must
   never be presented as anonymous. Preload only the approved SecurityOps public
   websites as bookmarks.
3. Add a GODS EYE dashboard app for `https://eye.securityops.co`, isolated from the
   OS origin and with a graceful unavailable/error state.
4. Configure the amnesic IRC client for `irc.securityops.com.br`. Validate that the
   actual endpoint is secure IRC-over-WebSocket before shipping; if it is raw IRC or
   TLS IRC instead, implement a narrowly allowlisted server-side bridge rather than
   exposing an open relay. Never retain nicknames, passwords, messages or channels.
5. Remove WhatsApp and Telegram from the desktop without silently deleting unrelated
   app capabilities. Update all in-OS and repository documentation to match reality.
6. Add tests for routing mode selection, bookmark defaults, host allowlists, and
   browser safety regressions. Run type-checking, linting, unit tests and a production
   build; report failures precisely rather than masking them.
7. Document the architecture, privacy boundaries, operational configuration, rollback
   plan and deployment verification. Use secret managers, SSH agent keys or CI
   secrets for authentication; do not accept plaintext credentials in commands.

Before deployment, inspect the target host and preserve a timestamped rollback
artifact. Deploy atomically where possible, run health checks, verify Tor and direct
browser routes independently, then confirm the release version. Push only to remotes
that already have safe credential helpers or SSH configuration; otherwise stop and
request a secure authentication method.
