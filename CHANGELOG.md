# Changelog

All notable changes to **SecurityOS** (the privacy/security‑first web desktop, a
fork of [daedalOS](https://github.com/DustinBrett/daedalOS)). Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [2026-06-14]

### Browsers — tabbed browsing
- **Tabs in both the Clearnet Browser and the Tor Browser.** Tab strip with a
  `＋` new‑tab button and per‑tab close; tabs stay mounted so scroll/state is
  preserved on switch. Per‑tab history (back/forward), address bar and bookmarks
  act on the active tab. Tab labels show the page **title** (reported by the
  in‑page shim) with a clean hostname fallback.
- **Open in current vs. new tab**, like a normal browser: plain click → current
  tab; **Ctrl/⌘‑click or middle‑click → new tab**; pop‑ups (`window.open`) → new
  tab. Done via the in‑page proxy shim posting a validated `__sosNewTab` message
  (each browser only accepts its own `/api/proxy` URLs). In the Tor Browser's
  default no‑JS *Safest* mode the sandbox forbids scripts, so links open in the
  current tab and new tabs come from `＋`.

### Clearnet Browser
- **First‑party SecurityOps sites load DIRECT** (real origin, cookies, login,
  WebSockets); only third‑party sites go through the rewriting privacy proxy.
  Fixes *"Couldn't load securityops.co through the privacy proxy."*
- **Default search = Security Search** (`securityops.co/web?s=`).
- **Ad/tracker blocking** via a curated EasyList/EasyPrivacy host list
  (`utils/adblock.ts`) — requests to ad hosts are neutralized at the network
  level and leftover containers hidden.
- **LibreJS‑style JS filtering** on by default — first‑party + trivial/free‑
  licensed scripts run; third‑party/nonfree JS is stripped. Toggleable per page.

### Tor Browser
- Start page + address‑bar search point at the verified live darknet search
  hidden service; bookmarks are the operator's `.onion` services.
- JavaScript **disabled by default** ("Safest"); the proxy strips scripts and
  sets `script-src 'none'`, and the iframe drops `allow-scripts`.

### Privacy proxy & security hardening
- **Mode‑aware CSP**: strict same‑origin CSP in no‑JS (anonymity) mode; minimal
  CSP in JS mode so ordinary sites render (fixes "refused to connect" on embeds
  and lazy‑loaded images).
- **Accurate error pages**: a down `.onion` now reads *"this .onion looks
  offline (Tor is working)"* instead of blaming Tor; only a genuine SOCKS‑hop
  failure reports *"Tor is unreachable."*
- **On‑page search forms work**: GET forms are rewritten to carry the target +
  mode flags as hidden inputs (a GET submit no longer drops the proxied URL).
- **SSRF / anonymity (security audit fixes):** the SSRF guard and Tor routing
  are gated on the live SOCKS agent (a broken `TOR_PROXY` can no longer skip the
  guard or silently connect direct — it **fails closed**); the SSRF‑validated IP
  is **pinned** through to the socket (no DNS rebinding); a **cumulative byte
  budget** spans redirect hops; the URL rewriter covers unquoted attributes and
  `background/cite/manifest/usemap/longdesc`; origin is pinnable via
  `SECURITYOS_ORIGIN`.
- **Tor healthcheck** verifies real bootstrap (`status/bootstrap-phase`), not
  just an open SOCKS port.

### Deploy
- **One command:** `docker compose up -d` (web + Tor, hardened & amnesic) → open
  `http://localhost:8088`. The full stack with the memory‑safe Rust proxy
  sidecar remains at `deploy/docker-compose.yml`.

## Earlier
- Full English UI, Tor active by default, SecurityOS branding, in‑OS Browser /
  Tor Browser, SecChat, SecTube, Vaptvupt (WASM) file encryption, SecTools,
  v86 Linux VM, security‑headers hardening, and the Tor‑routed deployment.
- Initial fork from daedalOS.
