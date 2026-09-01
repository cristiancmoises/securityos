# What's New in SecurityOS 2.24

## Zupt and a cleaner app catalog

- The Vaptvupt web application is now named **Zupt**. Its Tor/Clearnet workflow,
  key generation, compression, extraction, verification, uploads, and downloads
  remain available. The local Vaptvupt engine and `.zupt` format keep their
  original identity.
- **WhatsApp**, **Telegram**, **Session**, and **CryptPad** have been completely
  removed from the desktop, Start menu, app registry, and supported launch paths.
- The new **Wiki** app opens `wiki.securityops.co`.

## One visible Tor/Clearnet choice

**Zupt**, **GODS EYE**, **IRC**, and **Wiki** now use the same route control:

- **Tor** is the default and fails closed if Tor is unavailable.
- **Clearnet** is direct and clearly marked **not anonymous**.
- Proxy modes keep separate isolation tokens, and there is no silent fallback.
  **New circuit** rotates the Tor token explicitly.

IRC and GODS EYE remain best-effort in the Tor sandbox. Their Clearnet modes use
native service-origin iframes for full The Lounge/Socket.IO and Cesium
compatibility; those direct connections do not pass through `/api/ws`.

## Better browsing

- **Clearnet Browser** starts at `https://securityops.co/`, sends free-text searches
  to that origin, and enables all scripts by default for full-site compatibility.
- Both browsers now have reliable stop, reload, and home controls; clearer loading,
  route, and script indicators; corrected tab history; and safer navigation races.
- Sandboxed browser sessions now use short-lived, signed network capabilities bound
  to the selected app, Tor/direct route, isolation session, and script policy.
- Clearnet Browser offers an explicit native-window compatibility button. It is a
  direct connection and refuses `.onion` targets. Tor Browser remains fail-closed,
  starts with scripts disabled, and never falls back to clearnet.

## Undercover and icons

Undercover now presents a polished, familiar enterprise workspace using neutral
SecurityOS language and original code-native visuals. It does not show a
proprietary operating-system name, logo, trademark, or artwork. Zupt, IRC,
GODS EYE, and Wiki also have distinct multi-size icon families.

## Security status

The release was checked against current JavaScript and Rust advisory databases:
no known vulnerabilities were reported in the audited package graphs. Browser
proxies remain SSRF-guarded, Tor routes fail closed, and direct routes stay visible.

For the complete technical record, open `CHANGELOG.md` in the project repository.
