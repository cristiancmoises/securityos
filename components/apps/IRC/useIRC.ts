import {
  findNetwork,
  isChannel,
  type IrcMessage,
  parseMessage,
  saslPlain,
  stripFormatting,
  tunnelUrl,
  WANTED_CAPS,
} from "components/apps/IRC/ircClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// SecurityOS IRC — a full first-party IRC client. It speaks the IRC protocol over a
// WebSocket tunneled through the same-origin /api/ws relay to the network's gateway,
// over Tor. Handles CAP negotiation, SASL PLAIN (for registered accounts), channels,
// private messages, NAMES/topics, nick changes, /commands and PING keepalive.
// Amnesic: nothing is written to disk; closing the window forgets everything.

export type ConnStatus =
  | "connecting"
  | "error"
  | "offline"
  | "online"
  | "registering";

export type LineKind =
  | "action"
  | "join"
  | "message"
  | "notice"
  | "part"
  | "quit"
  | "system";

export type IrcLine = {
  from: string;
  id: string;
  kind: LineKind;
  mine: boolean;
  text: string;
  ts: number;
};

export type BufferKind = "channel" | "pm" | "server";

export type IrcBuffer = {
  id: string; // lowercased key
  kind: BufferKind;
  messages: IrcLine[];
  name: string; // display name (original case)
  topic: string;
  unread: number;
  users: string[]; // sorted display names (channels only)
};

export type ConnectOpts = {
  account: string;
  channels: string[];
  networkId: string;
  nick: string;
  password: string;
};

type UseIrc = {
  activeBuffer?: IrcBuffer;
  activeId: string;
  buffers: IrcBuffer[];
  closeBuffer: (id: string) => void;
  connect: (opts: ConnectOpts) => void;
  disconnect: () => void;
  error: string;
  nick: string;
  selectBuffer: (id: string) => void;
  sendInput: (text: string) => void;
  status: ConnStatus;
};

export const SERVER_ID = "*server*";
const SERVER_NAME = "Server";
const MAX_LINES = 500; // per-buffer scrollback cap (amnesic, memory-bounded)
const MAX_NICK_RETRIES = 4;
// Allowance (bytes) for the :nick!user@host hostmask the server prepends when it
// relays our PRIVMSG to other users — that prefix counts toward the 512-byte line
// limit for THEM, so we leave room for it.
const HOSTMASK_RESERVE = 100;
const textEncoder = new TextEncoder();

// Split a payload into chunks that each fit the 512-BYTE IRC line limit once the
// "PRIVMSG <target> :" envelope, CRLF and the relayed hostmask are accounted for.
// Measures UTF-8 bytes (not UTF-16 code units) and never splits a code point, so
// non-ASCII text isn't truncated and astral chars (emoji) aren't cut into lone
// surrogates (iterating a string yields whole code points).
const chunkForLine = (
  target: string,
  payload: string,
  action = false
): string[] => {
  const overhead =
    textEncoder.encode(`PRIVMSG ${target} :`).length +
    2 +
    HOSTMASK_RESERVE +
    // reserve for the per-chunk CTCP ACTION framing (\x01ACTION <..>\x01)
    (action ? 10 : 0);
  const budget = Math.max(64, 512 - overhead);
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const cp of payload) {
    const size = textEncoder.encode(cp).length;

    if (currentBytes + size > budget && current) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += cp;
    currentBytes += size;
  }
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [""];
};

let lineSeq = 0;
const nextId = (): string => {
  lineSeq += 1;

  return `l${lineSeq}`;
};

const userSortKey = (name: string): string =>
  // Strip status prefixes (~&@%+) for sorting, keep them for display.
  name.replace(/^[~&@%+]+/, "").toLowerCase();

const sortUsers = (users: string[]): string[] =>
  [...users].sort((a, b) => {
    const order = "~&@%+";
    const ra = order.indexOf(a[0]);
    const rb = order.indexOf(b[0]);
    const pa = ra === -1 ? order.length : ra;
    const pb = rb === -1 ? order.length : rb;

    if (pa !== pb) return pa - pb;

    return userSortKey(a).localeCompare(userSortKey(b));
  });

const useIRC = (): UseIrc => {
  const wsRef = useRef<WebSocket>();
  const buffersRef = useRef<Map<string, IrcBuffer>>(new Map());
  const orderRef = useRef<string[]>([SERVER_ID]);
  const activeRef = useRef<string>(SERVER_ID);
  const nickRef = useRef("");
  const optsRef = useRef<ConnectOpts>();
  const lineBufRef = useRef(""); // accumulates partial WS frames into whole lines
  const capsRef = useRef<{ ls: string; sasl: boolean; wanted: string[] }>({
    ls: "",
    sasl: false,
    wanted: [],
  });
  const nickTriesRef = useRef(0);
  const namesAccRef = useRef<Map<string, string[]>>(new Map());
  const mountedRef = useRef(true);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const intentionalCloseRef = useRef(false);

  const [status, setStatus] = useState<ConnStatus>("offline");
  // Mirror of `status` that the once-bound WebSocket message handler can read without
  // capturing a stale closure value (ws.onmessage is set exactly once, at connect).
  const statusRef = useRef<ConnStatus>("offline");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  // Coalesce the storm of IRC events (a busy channel, a big NAMES list) into at most
  // one React re-render per ~80ms frame — the render reads straight from the refs.
  const scheduleRender = useCallback(() => {
    if (renderTimerRef.current) return;
    renderTimerRef.current = setTimeout(() => {
      renderTimerRef.current = undefined;
      if (mountedRef.current) setVersion((v) => v + 1);
    }, 80);
  }, []);

  const ensureBuffer = useCallback(
    (name: string, kind: BufferKind, forcedId?: string): IrcBuffer => {
      const id = forcedId ?? name.toLowerCase();
      const existing = buffersRef.current.get(id);

      if (existing) return existing;

      const buffer: IrcBuffer = {
        id,
        kind,
        messages: [],
        name,
        topic: "",
        unread: 0,
        users: [],
      };

      buffersRef.current.set(id, buffer);
      if (!orderRef.current.includes(id)) orderRef.current.push(id);

      return buffer;
    },
    []
  );

  const addLine = useCallback(
    (
      bufferName: string,
      kind: BufferKind,
      line: Omit<IrcLine, "id" | "ts"> & { ts?: number },
      forcedId?: string
    ) => {
      const buffer = ensureBuffer(bufferName, kind, forcedId);

      buffer.messages.push({
        ...line,
        id: nextId(),
        ts: line.ts ?? Date.now(),
      });
      if (buffer.messages.length > MAX_LINES) {
        buffer.messages.splice(0, buffer.messages.length - MAX_LINES);
      }
      if (buffer.id !== activeRef.current) buffer.unread += 1;
      scheduleRender();
    },
    [ensureBuffer, scheduleRender]
  );

  const addServer = useCallback(
    (text: string, kind: LineKind = "system") => {
      addLine(
        SERVER_NAME,
        "server",
        { from: "", kind, mine: false, text },
        SERVER_ID
      );
    },
    [addLine]
  );

  const send = useCallback((line: string) => {
    const ws = wsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN) {
      // Strip any embedded CR/LF so a crafted message can't inject extra IRC
      // commands (line-injection), then frame with the required CRLF.
      ws.send(`${line.replace(/[\r\n]+/g, " ")}\r\n`);
    }
  }, []);

  const renameUserEverywhere = useCallback(
    (from: string, to: string) => {
      const fromKey = from.toLowerCase();

      buffersRef.current.forEach((buffer) => {
        if (buffer.kind !== "channel") return;
        const idx = buffer.users.findIndex((u) => userSortKey(u) === fromKey);

        if (idx !== -1) {
          const prefix = buffer.users[idx].match(/^[~&@%+]*/)?.[0] || "";

          buffer.users[idx] = prefix + to;
          buffer.users = sortUsers(buffer.users);
          addLine(buffer.name, "channel", {
            from: "",
            kind: "system",
            mine: false,
            text: `${from} is now known as ${to}`,
          });
        }
      });
    },
    [addLine]
  );

  const removeUserEverywhere = useCallback(
    (who: string, reason: string, verb: LineKind) => {
      const key = who.toLowerCase();

      buffersRef.current.forEach((buffer) => {
        if (buffer.kind !== "channel") return;
        const before = buffer.users.length;

        buffer.users = buffer.users.filter((u) => userSortKey(u) !== key);
        if (buffer.users.length !== before) {
          addLine(buffer.name, "channel", {
            from: "",
            kind: verb,
            mine: false,
            text: `${who} ${verb === "quit" ? "quit" : "left"}${
              reason ? ` (${reason})` : ""
            }`,
          });
        }
      });
    },
    [addLine]
  );

  // -- The IRC command router --------------------------------------------------
  const handle = useCallback(
    (msg: IrcMessage) => {
      const me = nickRef.current.toLowerCase();
      const ts = msg.time;

      switch (msg.command) {
        case "PING":
          send(`PONG :${msg.params[msg.params.length - 1] || ""}`);
          return;

        case "CAP": {
          const sub = msg.params[1];
          const list = msg.params[msg.params.length - 1] || "";

          if (sub === "LS") {
            // CAP LS 302 may be split across MULTIPLE lines: a continuation line
            // carries an extra "*" param before the trailing caps
            // (":srv CAP nick LS * :a b"), the final line does not
            // (":srv CAP nick LS :y z"). Acting on the first fragment would send
            // CAP REQ/END too early and abort SASL — so accumulate until the final.
            capsRef.current.ls += (capsRef.current.ls ? " " : "") + list;
            if (msg.params[msg.params.length - 2] === "*") return;

            const full = capsRef.current.ls;

            capsRef.current.ls = "";
            const avail = full
              .split(" ")
              .map((c) => c.split("=")[0])
              .filter(Boolean);
            const want = WANTED_CAPS.filter((c) => avail.includes(c));

            if (capsRef.current.sasl && avail.includes("sasl")) {
              want.push("sasl");
            } else {
              capsRef.current.sasl = false;
            }
            capsRef.current.wanted = want;
            if (want.length > 0) send(`CAP REQ :${want.join(" ")}`);
            else send("CAP END");
          } else if (sub === "ACK") {
            const acked = list.split(" ").filter(Boolean);

            if (capsRef.current.sasl && acked.includes("sasl")) {
              send("AUTHENTICATE PLAIN");
            } else {
              send("CAP END");
            }
          } else if (sub === "NAK") {
            capsRef.current.sasl = false;
            send("CAP END");
          }
          return;
        }

        case "AUTHENTICATE": {
          if (msg.params[0] === "+") {
            const opts = optsRef.current;

            if (opts)
              send(`AUTHENTICATE ${saslPlain(opts.account, opts.password)}`);
          }
          return;
        }

        // SASL outcomes — then always end capability negotiation.
        case "903": // RPL_SASLSUCCESS
          addServer("✓ Authenticated with the network (SASL).");
          send("CAP END");
          return;
        case "902": // ERR_NICKLOCKED
        case "904": // ERR_SASLFAIL
        case "905": // ERR_SASLTOOLONG
        case "906": // ERR_SASLABORTED
          addServer(
            "⚠ SASL authentication failed — continuing without it (some channels may be unavailable)."
          );
          capsRef.current.sasl = false;
          send("CAP END");
          return;

        case "001": // RPL_WELCOME
          nickRef.current = msg.params[0] || nickRef.current;
          nickTriesRef.current = 0;
          setStatus("online");
          setError("");
          addServer(`Connected as ${nickRef.current}.`);
          {
            const chans = optsRef.current?.channels || [];

            if (chans.length > 0) send(`JOIN ${chans.join(",")}`);
          }
          scheduleRender();
          return;

        case "433": // ERR_NICKNAMEINUSE
          if (
            statusRef.current !== "online" &&
            nickTriesRef.current < MAX_NICK_RETRIES
          ) {
            nickTriesRef.current += 1;
            nickRef.current = `${nickRef.current}_`;
            addServer(`Nick in use — trying ${nickRef.current}…`);
            send(`NICK ${nickRef.current}`);
          } else {
            addServer(`Nick "${msg.params[1] || ""}" is already in use.`);
            if (statusRef.current !== "online") {
              setStatus("error");
              setError("That nickname is taken. Pick another and reconnect.");
            }
          }
          return;

        case "432": // ERR_ERRONEUSNICKNAME
          addServer(`Invalid nickname: ${msg.params[1] || ""}.`);
          if (statusRef.current !== "online") {
            setStatus("error");
            setError("The server rejected that nickname.");
          }
          return;

        case "JOIN": {
          const chan = msg.params[0];

          if (!chan) return;
          if (msg.nick.toLowerCase() === me) {
            ensureBuffer(chan, "channel");
            activeRef.current = chan.toLowerCase();
            const buf = buffersRef.current.get(chan.toLowerCase());

            if (buf) buf.unread = 0;
            addLine(chan, "channel", {
              from: "",
              kind: "system",
              mine: false,
              text: `You joined ${chan}`,
              ts,
            });
          } else {
            const buf = ensureBuffer(chan, "channel");

            if (
              !buf.users.some((u) => userSortKey(u) === msg.nick.toLowerCase())
            ) {
              buf.users = sortUsers([...buf.users, msg.nick]);
            }
            addLine(chan, "channel", {
              from: "",
              kind: "join",
              mine: false,
              text: `${msg.nick} joined`,
              ts,
            });
          }
          scheduleRender();
          return;
        }

        case "PART": {
          const chan = msg.params[0];
          const reason = msg.params[1] || "";

          if (!chan) return;
          if (msg.nick.toLowerCase() === me) {
            addLine(chan, "channel", {
              from: "",
              kind: "part",
              mine: false,
              text: `You left ${chan}`,
              ts,
            });
            const buf = buffersRef.current.get(chan.toLowerCase());

            if (buf) buf.users = [];
          } else {
            const buf = buffersRef.current.get(chan.toLowerCase());

            if (buf) {
              buf.users = buf.users.filter(
                (u) => userSortKey(u) !== msg.nick.toLowerCase()
              );
            }
            addLine(chan, "channel", {
              from: "",
              kind: "part",
              mine: false,
              text: `${msg.nick} left${reason ? ` (${reason})` : ""}`,
              ts,
            });
          }
          scheduleRender();
          return;
        }

        case "QUIT":
          removeUserEverywhere(msg.nick, msg.params[0] || "", "quit");
          scheduleRender();
          return;

        case "KICK": {
          const chan = msg.params[0];
          const target = msg.params[1] || "";
          const reason = msg.params[2] || "";

          if (!chan) return;
          if (target.toLowerCase() === me) {
            addLine(chan, "channel", {
              from: "",
              kind: "part",
              mine: false,
              text: `You were kicked from ${chan}${
                reason ? ` (${reason})` : ""
              }`,
              ts,
            });
            const buf = buffersRef.current.get(chan.toLowerCase());

            if (buf) buf.users = [];
          } else {
            const buf = buffersRef.current.get(chan.toLowerCase());

            if (buf) {
              buf.users = buf.users.filter(
                (u) => userSortKey(u) !== target.toLowerCase()
              );
            }
            addLine(chan, "channel", {
              from: "",
              kind: "part",
              mine: false,
              text: `${target} was kicked by ${msg.nick}${
                reason ? ` (${reason})` : ""
              }`,
              ts,
            });
          }
          scheduleRender();
          return;
        }

        case "NICK": {
          const to = msg.params[0] || "";

          if (msg.nick.toLowerCase() === me) nickRef.current = to;
          renameUserEverywhere(msg.nick, to);
          scheduleRender();
          return;
        }

        case "PRIVMSG":
        case "NOTICE": {
          const target = msg.params[0] || "";
          let text = stripFormatting(msg.params[1] || "");
          const isNotice = msg.command === "NOTICE";
          // CTCP ACTION ("/me") arrives as \x01ACTION …\x01.
          let kind: LineKind = isNotice ? "notice" : "message";
          const action = /^\x01ACTION ([\s\S]*)\x01?$/.exec(
            msg.params[1] || ""
          );

          if (action) {
            text = stripFormatting(action[1]);
            kind = "action";
          }
          // Route: a channel target -> that channel; a message to us -> a PM buffer
          // keyed by the sender; a server NOTICE (no real sender) -> server buffer.
          if (isChannel(target)) {
            addLine(target, "channel", {
              from: msg.nick,
              kind,
              mine: false,
              text,
              ts,
            });
          } else if (msg.nick && msg.prefix.includes("!")) {
            addLine(msg.nick, "pm", {
              from: msg.nick,
              kind,
              mine: false,
              text,
              ts,
            });
          } else {
            addServer(text, "notice");
          }
          return;
        }

        case "TOPIC": {
          const chan = msg.params[0];

          if (!chan) return;
          const topic = stripFormatting(msg.params[1] || "");
          const buf = buffersRef.current.get(chan.toLowerCase());

          if (buf) buf.topic = topic;
          addLine(chan, "channel", {
            from: "",
            kind: "system",
            mine: false,
            text: `${msg.nick} changed the topic to: ${topic}`,
            ts,
          });
          scheduleRender();
          return;
        }

        case "332": {
          // RPL_TOPIC
          const chan = msg.params[1];
          const buf = buffersRef.current.get(chan?.toLowerCase() || "");

          if (buf) buf.topic = stripFormatting(msg.params[2] || "");
          scheduleRender();
          return;
        }

        case "353": {
          // RPL_NAMREPLY — accumulate until 366.
          const chan = msg.params[2];
          const names = (msg.params[3] || "").split(" ").filter(Boolean);
          const acc = namesAccRef.current.get(chan?.toLowerCase() || "") || [];

          namesAccRef.current.set(chan?.toLowerCase() || "", [
            ...acc,
            ...names,
          ]);
          return;
        }

        case "366": {
          // RPL_ENDOFNAMES — commit the accumulated NAMES to the channel.
          const chan = msg.params[1];
          const key = chan?.toLowerCase() || "";
          const names = namesAccRef.current.get(key) || [];
          const buf = buffersRef.current.get(key);

          if (buf) buf.users = sortUsers(names);
          namesAccRef.current.delete(key);
          scheduleRender();
          return;
        }

        case "MODE": {
          // Channel MODE: keep the user list's op/voice prefixes current. Ignore
          // user-mode-on-self (target isn't a channel). Walk the mode string with an
          // argument cursor: prefix modes (q~ a& o@ h% v+) and list/key modes
          // (b,e,I,k) always consume an arg; +l consumes one, -l does not; bare flags
          // consume none.
          const chan = msg.params[0];

          if (!chan || !isChannel(chan)) return;
          const buf = buffersRef.current.get(chan.toLowerCase());
          const modeStr = msg.params[1] || "";
          const args = msg.params.slice(2);
          const PREFIX: Record<string, string> = {
            a: "&",
            h: "%",
            o: "@",
            q: "~",
            v: "+",
          };
          const ARG_ALWAYS = new Set([
            "q",
            "a",
            "o",
            "h",
            "v",
            "b",
            "e",
            "I",
            "k",
          ]);
          const rank = "~&@%+";
          let adding = true;
          let ai = 0;

          for (const c of modeStr) {
            if (c === "+") {
              adding = true;
            } else if (c === "-") {
              adding = false;
            } else {
              const takesArg = ARG_ALWAYS.has(c) || (c === "l" && adding);
              const arg = takesArg ? args[ai++] : undefined;

              if (PREFIX[c] && arg && buf) {
                const sigil = PREFIX[c];
                const idx = buf.users.findIndex(
                  (u) => userSortKey(u) === arg.toLowerCase()
                );

                if (idx !== -1) {
                  const cur = buf.users[idx];
                  const bare = cur.replace(/^[~&@%+]*/, "");
                  let prefixes = (cur.match(/^[~&@%+]*/)?.[0] || "").split("");

                  if (adding) {
                    if (!prefixes.includes(sigil)) prefixes.push(sigil);
                  } else {
                    prefixes = prefixes.filter((p) => p !== sigil);
                  }
                  prefixes.sort((a, b) => rank.indexOf(a) - rank.indexOf(b));
                  buf.users[idx] = prefixes.join("") + bare;
                }
              }
            }
          }
          if (buf) buf.users = sortUsers(buf.users);
          addLine(chan, "channel", {
            from: "",
            kind: "system",
            mine: false,
            text: `${msg.nick || "Server"} sets mode ${[modeStr, ...args].join(
              " "
            )}`,
            ts,
          });
          scheduleRender();
          return;
        }

        case "ERROR":
          addServer(`Server error: ${msg.params[0] || ""}`, "system");
          return;

        // 333 = topic author/time metadata — benign, intentionally not surfaced.
        case "333":
          return;

        default:
          // Numeric replies (MOTD, LUSERS, WHOIS, errors) and anything unmodeled go
          // to the server buffer so nothing is silently lost.
          if (/^\d{3}$/.test(msg.command)) {
            const text = msg.params.slice(1).join(" ").trim();

            if (text) addServer(text, "notice");
          }
      }
    },
    [
      addLine,
      addServer,
      ensureBuffer,
      removeUserEverywhere,
      renameUserEverywhere,
      scheduleRender,
      send,
    ]
  );

  const teardown = useCallback((next: ConnStatus) => {
    intentionalCloseRef.current = true;
    const ws = wsRef.current;

    if (ws) {
      // Detach handlers FIRST so a late event from this (now-abandoned) socket can't
      // fire into current state or clobber a freshly-created wsRef on reconnect.
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send("QUIT :SecurityOS\r\n");
        ws.close();
      } catch {
        // ignore teardown errors
      }
    }
    wsRef.current = undefined;
    lineBufRef.current = "";
    if (mountedRef.current) setStatus(next);
  }, []);

  const connect = useCallback(
    (opts: ConnectOpts) => {
      // Reset all session state for a clean (re)connect.
      teardown("connecting");
      intentionalCloseRef.current = false;
      buffersRef.current = new Map();
      orderRef.current = [SERVER_ID];
      namesAccRef.current = new Map();
      activeRef.current = SERVER_ID;
      nickRef.current = opts.nick.trim();
      nickTriesRef.current = 0;
      optsRef.current = opts;
      capsRef.current = {
        ls: "",
        sasl: Boolean(opts.account && opts.password),
        wanted: [],
      };
      setError("");
      setStatus("connecting");

      const network = findNetwork(opts.networkId);

      addServer(`Connecting to ${network.label} over Tor…`);

      let ws: WebSocket;

      try {
        ws = new WebSocket(tunnelUrl(network.gateway));
      } catch {
        setStatus("error");
        setError("Could not open the Tor WebSocket tunnel.");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current || wsRef.current !== ws) return;
        setStatus("registering");
        addServer("Tunnel open — registering…");
        send("CAP LS 302");
        send(`NICK ${nickRef.current}`);
        send(`USER ${nickRef.current} 0 * :SecurityOS`);
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws || typeof event.data !== "string") return;
        // A frame may carry several IRC lines, or a partial line — buffer and split
        // on newlines, keeping any trailing partial for the next frame.
        lineBufRef.current += event.data;
        const parts = lineBufRef.current.split(/\r?\n/);

        lineBufRef.current = parts.pop() || "";
        parts.forEach((line) => {
          if (line.trim()) handle(parseMessage(line));
        });
      };

      ws.onerror = () => {
        if (!mountedRef.current || wsRef.current !== ws) return;
        addServer("Tunnel error.");
      };

      ws.onclose = () => {
        if (!mountedRef.current || wsRef.current !== ws) return;
        wsRef.current = undefined;
        if (intentionalCloseRef.current) return;
        setStatus("error");
        setError(
          "Disconnected from the network. This can happen if the Tor exit is blocked or the gateway dropped the link — reconnect to try a fresh circuit."
        );
        addServer("Disconnected.");
      };
    },
    [addServer, handle, send, teardown]
  );

  const disconnect = useCallback(() => {
    teardown("offline");
    addServer("You disconnected.");
    scheduleRender();
  }, [addServer, scheduleRender, teardown]);

  const selectBuffer = useCallback(
    (id: string) => {
      activeRef.current = id;
      const buf = buffersRef.current.get(id);

      if (buf) buf.unread = 0;
      scheduleRender();
    },
    [scheduleRender]
  );

  const closeBuffer = useCallback(
    (id: string) => {
      if (id === SERVER_ID) return;
      const buf = buffersRef.current.get(id);

      if (buf?.kind === "channel" && wsRef.current) send(`PART ${buf.name}`);
      buffersRef.current.delete(id);
      orderRef.current = orderRef.current.filter((o) => o !== id);
      if (activeRef.current === id) activeRef.current = SERVER_ID;
      scheduleRender();
    },
    [scheduleRender, send]
  );

  // Send a chat line or interpret a /command from the composer.
  const sendInput = useCallback(
    (raw: string) => {
      const text = raw.replace(/\r?\n/g, " ");

      if (!text.trim()) return;

      const activeId = activeRef.current;
      const active = buffersRef.current.get(activeId);
      const targetName = active && active.kind !== "server" ? active.name : "";

      const say = (target: string, body: string, action = false) => {
        if (!target) {
          addServer("No channel or user selected. Join a channel first.");
          return;
        }
        // Split the BODY (not the framed line) so each emitted PRIVMSG stays within
        // the 512-byte limit AND each chunk of a long /me keeps its own valid
        // \x01ACTION …\x01 framing (wrapping before chunking would strand the markers).
        chunkForLine(target, body, action).forEach((chunk) =>
          send(
            `PRIVMSG ${target} :${action ? `\x01ACTION ${chunk}\x01` : chunk}`
          )
        );
        addLine(target, isChannel(target) ? "channel" : "pm", {
          from: nickRef.current,
          kind: action ? "action" : "message",
          mine: true,
          text: body,
        });
      };

      if (!text.startsWith("/")) {
        say(targetName, text);
        return;
      }

      const spaceIdx = text.indexOf(" ");
      const cmd = (
        spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)
      ).toLowerCase();
      const rest = spaceIdx === -1 ? "" : text.slice(spaceIdx + 1);

      switch (cmd) {
        case "me":
          say(targetName, rest, true);
          break;
        case "msg":
        case "query": {
          const sp = rest.indexOf(" ");
          const to = sp === -1 ? rest : rest.slice(0, sp);
          const body = sp === -1 ? "" : rest.slice(sp + 1);

          if (!to) {
            addServer("Usage: /msg <nick|#channel> <message>");
            break;
          }
          if (body) say(to, body);
          else {
            ensureBuffer(to, isChannel(to) ? "channel" : "pm");
            selectBuffer(to.toLowerCase());
          }
          break;
        }
        case "join":
        case "j":
          if (rest.trim()) send(`JOIN ${rest.trim()}`);
          else addServer("Usage: /join #channel");
          break;
        case "part":
        case "leave":
          send(`PART ${rest.trim() || targetName}`);
          break;
        case "nick":
          if (rest.trim()) send(`NICK ${rest.trim()}`);
          else addServer("Usage: /nick <newnick>");
          break;
        case "topic":
          send(`TOPIC ${targetName}${rest ? ` :${rest}` : ""}`);
          break;
        case "whois":
          if (rest.trim()) send(`WHOIS ${rest.trim()}`);
          break;
        case "names":
          send(`NAMES ${targetName}`);
          break;
        case "quit":
          disconnect();
          break;
        case "raw":
        case "quote":
          if (rest.trim()) send(rest.trim());
          break;
        default:
          // Unknown /command: forward it verbatim as a raw IRC command (power users).
          send(`${cmd.toUpperCase()}${rest ? ` ${rest}` : ""}`);
      }
    },
    [addLine, addServer, disconnect, ensureBuffer, selectBuffer, send]
  );

  // Keep statusRef in lock-step with the status state so the once-bound WebSocket
  // message handler (handle) reads the CURRENT connection phase, not a stale closure.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
      const ws = wsRef.current;

      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send("QUIT :SecurityOS\r\n");
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Build the render-facing snapshot from the refs (recomputed each version bump).
  const buffers = useMemo(
    () =>
      orderRef.current
        .map((id) => buffersRef.current.get(id))
        .filter((b): b is IrcBuffer => Boolean(b)),
    // Recompute whenever the coalesced render counter bumps (buffers live in refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, status]
  );

  const activeBuffer = buffersRef.current.get(activeRef.current);

  return {
    activeBuffer,
    activeId: activeRef.current,
    buffers,
    closeBuffer,
    connect,
    disconnect,
    error,
    nick: nickRef.current,
    selectBuffer,
    sendInput,
    status,
  };
};

export default useIRC;
