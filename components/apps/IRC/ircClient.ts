// SecurityOS IRC — protocol helpers for a first-party IRC client.
//
// A browser cannot open a raw TCP socket, so we speak the IRC protocol over a
// WebSocket, tunneled through the SAME-ORIGIN /api/ws relay (server.js) to an
// IRC network's WebSocket gateway, over Tor. For Libera.Chat that gateway is the
// official KiwiIRC webircgateway at wss://web.libera.chat/webirc/websocket/,
// which pipes standard IRC lines both ways (verified: it answers with the real
// solanum IRCd, CAP LS, ident/host notices — all over Tor).
//
// Amnesic by design: nothing is persisted. The nick, buffers, message history and
// any NickServ password live only in memory for the life of the window.

// Known networks the client may connect to. The server-side /api/ws allowlist
// (WS_ALLOW in server.js) independently enforces these hosts, so a tampered client
// still can't turn the tunnel into an open WebSocket relay — this list is the
// UX/validation half of that same allowlist.
export type IrcNetwork = {
  id: string;
  label: string;
  host: string;
  gateway: string;
};

export const IRC_NETWORKS: IrcNetwork[] = [
  {
    gateway: "wss://web.libera.chat/webirc/websocket/",
    host: "irc.libera.chat",
    id: "libera",
    label: "Libera.Chat",
  },
];

export const DEFAULT_NETWORK_ID = "libera";
export const DEFAULT_CHANNELS = "#libera";

export const findNetwork = (id: string): IrcNetwork =>
  IRC_NETWORKS.find((n) => n.id === id) || IRC_NETWORKS[0];

// The IRCv3 capabilities we ask for when the server advertises them. We deliberately
// do NOT request echo-message (we render our own sent lines locally instead) so a
// server that supports it can't double-render our messages. server-time gives us
// authoritative timestamps; multi-prefix gives full @+ status in NAMES.
export const WANTED_CAPS = [
  "message-tags",
  "server-time",
  "multi-prefix",
  "away-notify",
  "account-notify",
  "extended-join",
  "chghost",
];

export type IrcMessage = {
  command: string;
  nick: string; // sender nick parsed from the prefix (empty for server/self)
  params: string[];
  prefix: string;
  tags: Record<string, string>;
  time?: number; // from the server-time @time tag, if present (ms epoch)
};

const unescapeTag = (value: string): string =>
  value
    .replace(/\\:/g, ";")
    .replace(/\\s/g, " ")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");

// Parse a single IRC line (optionally with IRCv3 @tags and a :prefix) into parts.
// Robust to the trailing ":" parameter (which may contain spaces) and to missing
// sections. Never throws — a malformed line yields an empty-ish message.
export const parseMessage = (line: string): IrcMessage => {
  let rest = line.trim();
  const tags: Record<string, string> = {};

  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    const tagStr = sp === -1 ? rest.slice(1) : rest.slice(1, sp);

    rest = sp === -1 ? "" : rest.slice(sp + 1).trimStart();
    tagStr.split(";").forEach((pair) => {
      if (!pair) return;
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const val = eq === -1 ? "" : unescapeTag(pair.slice(eq + 1));

      tags[key] = val;
    });
  }

  let prefix = "";

  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");

    prefix = sp === -1 ? rest.slice(1) : rest.slice(1, sp);
    rest = sp === -1 ? "" : rest.slice(sp + 1).trimStart();
  }

  const params: string[] = [];

  while (rest.length > 0) {
    if (rest.startsWith(":")) {
      params.push(rest.slice(1));
      break;
    }
    const sp = rest.indexOf(" ");

    if (sp === -1) {
      params.push(rest);
      break;
    }
    params.push(rest.slice(0, sp));
    rest = rest.slice(sp + 1).trimStart();
  }

  const command = (params.shift() || "").toUpperCase();
  const nick = prefix.split("!")[0].split("@")[0];
  const timeTag = tags["time"];
  const time = timeTag ? Date.parse(timeTag) || undefined : undefined;

  return { command, nick, params, prefix, tags, time };
};

// IRC nick rules (RFC 1459 + common modern practice): a letter or special char
// first, then letters/digits/specials/hyphen. Capped conservatively — Libera's
// NICKLEN is 16, but other networks differ, so validate loosely and let the server
// be the final authority (we surface its 432/433 errors).
const NICK_RE = /^[A-Za-z[\]\\`_^{|}][A-Za-z0-9[\]\\`_^{|}-]{0,29}$/;

export const isValidNick = (nick: string): boolean => NICK_RE.test(nick.trim());

const CHANNEL_PREFIXES = "#&+!";

// Normalize a user-typed channel: prepend "#" if it has no channel sigil, trim,
// and reject anything with a space/comma/control (illegal in a channel name).
export const normalizeChannel = (raw: string): string => {
  const name = raw.trim();

  if (!name) return "";
  const prefixed = CHANNEL_PREFIXES.includes(name[0]) ? name : `#${name}`;

  return prefixed;
};

// eslint-disable-next-line no-control-regex
const BAD_CHANNEL_CHARS = /[\s,\x07\x00]/;

export const isValidChannel = (raw: string): boolean => {
  const name = normalizeChannel(raw);

  return (
    name.length >= 2 &&
    name.length <= 50 &&
    CHANNEL_PREFIXES.includes(name[0]) &&
    !BAD_CHANNEL_CHARS.test(name)
  );
};

// Parse the "channels" field ("#a, #b  #c") into a de-duplicated, validated list.
export const parseChannels = (raw: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  raw
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .forEach((c) => {
      if (!isValidChannel(c)) return;
      const norm = normalizeChannel(c);
      const key = norm.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        out.push(norm);
      }
    });

  return out;
};

const CHANNEL_PREFIX_SET = new Set(CHANNEL_PREFIXES.split(""));

export const isChannel = (target: string): boolean =>
  Boolean(target) && CHANNEL_PREFIX_SET.has(target[0]);

// SASL PLAIN mechanism payload: base64 of authzid\0authcid\0passwd. We use the same
// account for authzid + authcid. Needed to authenticate to NickServ during CAP
// negotiation — the reliable way to use a registered account (and often required to
// use channels from a Tor exit).
export const saslPlain = (account: string, password: string): string => {
  const raw = `\0${account}\0${password}`;
  // btoa is Latin-1 only; encode UTF-8 first so non-ASCII passwords survive.
  const utf8 = unescape(encodeURIComponent(raw));

  return btoa(utf8);
};

// Build the same-origin /api/ws tunnel URL for an IRC gateway. Tor by default (no
// &direct=1) so IRC rides the same Tor circuit as everything else in the OS.
export const tunnelUrl = (gateway: string): string => {
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${scheme}//${window.location.host}/api/ws?url=${encodeURIComponent(
    gateway
  )}`;
};

// Strip mIRC color/formatting control codes (\x03 color, \x02 bold, etc.) so the UI
// renders clean text. Keeps normal printable content intact.
// eslint-disable-next-line no-control-regex
const FORMATTING_RE = /\x03(?:\d{1,2}(?:,\d{1,2})?)?|[\x00-\x08\x0B-\x1F]/g;

export const stripFormatting = (text: string): string =>
  text.replace(FORMATTING_RE, "");
