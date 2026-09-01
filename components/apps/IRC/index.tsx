import {
  DEFAULT_CHANNELS,
  DEFAULT_NETWORK_ID,
  IRC_NETWORKS,
  isValidChannel,
  isValidNick,
  parseChannels,
} from "components/apps/IRC/ircClient";
import StyledIRC from "components/apps/IRC/StyledIRC";
import useIRC, { type IrcLine } from "components/apps/IRC/useIRC";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useEffect, useMemo, useRef, useState } from "react";

// SecurityOS IRC — a first-party IRC client (Libera.Chat by default), speaking the
// IRC protocol over the same-origin /api/ws WebSocket tunnel, over Tor. Amnesic:
// nick, history and any NickServ password live only in memory for this window.

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting over Tor…",
  error: "Disconnected",
  offline: "Not connected",
  online: "Connected over Tor",
  registering: "Registering…",
};

const twoDigit = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
const clock = (ts: number): string => {
  const d = new Date(ts);

  return `${twoDigit(d.getHours())}:${twoDigit(d.getMinutes())}`;
};

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;
const IS_URL = /^https?:\/\//;

// Render message text with clickable http(s) links (opened in a new tab). Everything
// else is plain text — no HTML from the network is ever interpreted. (IS_URL is a
// fresh, non-global test so it has no stateful lastIndex like the /g split pattern.)
const renderText = (text: string): React.ReactNode => {
  const parts = text.split(URL_RE);

  return parts.map((part, i) =>
    IS_URL.test(part) ? (
      // eslint-disable-next-line react/no-array-index-key
      <a key={i} href={part} rel="noreferrer noopener" target="_blank">
        {part}
      </a>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part}</span>
    )
  );
};

const userClass = (name: string): string => {
  const p = name[0];

  if (p === "@" || p === "&" || p === "~") return "op";
  if (p === "+" || p === "%") return "voice";

  return "";
};

const MessageLine: FC<{ line: IrcLine }> = ({ line }) => (
  <div className={`line ${line.kind}`}>
    <span className="ts">{clock(line.ts)}</span>
    {line.kind === "action" ? (
      <span className="txt">
        * {line.from} {renderText(line.text)}
      </span>
    ) : line.from ? (
      <>
        <span className={`who${line.mine ? " mine" : ""}`}>
          {line.from}
          {line.kind === "notice" ? " -notice-" : ""}:
        </span>
        <span className="txt">{renderText(line.text)}</span>
      </>
    ) : (
      <span className="txt">{renderText(line.text)}</span>
    )}
  </div>
);

const IRC: FC<ComponentProcessProps> = () => {
  const {
    activeBuffer,
    activeId,
    buffers,
    closeBuffer,
    connect,
    disconnect,
    error,
    nick,
    selectBuffer,
    sendInput,
    status,
  } = useIRC();

  const [formNick, setFormNick] = useState("");
  const [formChannels, setFormChannels] = useState(DEFAULT_CHANNELS);
  const [networkId, setNetworkId] = useState(DEFAULT_NETWORK_ID);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState("");
  const [joinInput, setJoinInput] = useState("");

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const connected =
    status === "connecting" || status === "registering" || status === "online";

  useEffect(() => {
    const el = messagesRef.current;

    if (el) el.scrollTop = el.scrollHeight;
    // Messages are mutated in place, so key off the NEWEST line's id (globally
    // incrementing) — length alone pins at MAX_LINES once the scrollback cap is hit
    // and would then stop firing. activeId re-scrolls on buffer switch.
  }, [activeBuffer?.messages[activeBuffer.messages.length - 1]?.id, activeId]);

  const dotClass =
    status === "error" ? "dot error" : status === "online" ? "dot" : "dot busy";

  const onConnect = (): void => {
    const trimmedNick = formNick.trim();

    if (!isValidNick(trimmedNick)) {
      setFormError(
        "Enter a valid nickname (letters, digits, - _ [ ] { } | ` ^ \\; can't start with a digit)."
      );

      return;
    }
    const channels = parseChannels(formChannels);
    const badChannel = formChannels
      .split(/[\s,]+/)
      .filter(Boolean)
      .find((c) => !isValidChannel(c));

    if (badChannel) {
      setFormError(`"${badChannel}" isn't a valid channel (try #name).`);

      return;
    }
    if ((account.trim() && !password) || (!account.trim() && password)) {
      setFormError(
        "For SASL login, fill in BOTH the account and the password (or leave both blank)."
      );

      return;
    }
    setFormError("");
    connect({
      account: account.trim(),
      channels,
      networkId,
      nick: trimmedNick,
      password,
    });
  };

  const onSend = (): void => {
    if (!draft.trim()) return;
    sendInput(draft);
    setDraft("");
  };

  const onJoin = (): void => {
    const value = joinInput.trim();

    if (!value) return;
    if (!isValidChannel(value)) return;
    sendInput(`/join ${value}`);
    setJoinInput("");
  };

  const network = useMemo(
    () => IRC_NETWORKS.find((n) => n.id === networkId) || IRC_NETWORKS[0],
    [networkId]
  );

  return (
    <StyledIRC>
      <div className="tor-bar">
        <span className="status">
          <span className={dotClass} />
          {STATUS_LABEL[status]}
          {nick && connected ? ` · ${nick}` : ""}
        </span>
        {status !== "offline" && (
          <button className="ghost-btn" onClick={disconnect} type="button">
            Disconnect
          </button>
        )}
      </div>

      {connected ? (
        <div className="panes">
          <div className="sidebar">
            <div className="me" title={network.host}>
              🧅 {network.label}
            </div>
            <div className="buffers">
              {buffers.map((buffer) => (
                <button
                  key={buffer.id}
                  className={
                    buffer.id === activeId
                      ? "buffer-item active"
                      : "buffer-item"
                  }
                  onClick={() => selectBuffer(buffer.id)}
                  title={buffer.name}
                  type="button"
                >
                  <span className="b-name">
                    {buffer.kind === "channel"
                      ? ""
                      : buffer.kind === "pm"
                      ? "@"
                      : ""}
                    {buffer.name}
                  </span>
                  <span
                    style={{ alignItems: "center", display: "flex", gap: 4 }}
                  >
                    {buffer.unread > 0 && (
                      <span className="badge">{buffer.unread}</span>
                    )}
                    {buffer.kind !== "server" && (
                      <span
                        aria-label="Close"
                        className="b-close"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeBuffer(buffer.id);
                        }}
                        role="button"
                        tabIndex={-1}
                      >
                        ×
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <form
              className="join-row"
              onSubmit={(event) => {
                event.preventDefault();
                onJoin();
              }}
            >
              <input
                onChange={(event) => setJoinInput(event.target.value)}
                placeholder="Join #channel"
                value={joinInput}
              />
              <button className="mini-btn" type="submit">
                Join
              </button>
            </form>
          </div>

          <div className="chat">
            {activeBuffer ? (
              <>
                <div className="chat-header">
                  <div className="chat-title">{activeBuffer.name}</div>
                  {activeBuffer.topic ? (
                    <div className="chat-topic" title={activeBuffer.topic}>
                      {activeBuffer.topic}
                    </div>
                  ) : activeBuffer.kind === "channel" ? (
                    <div className="chat-topic">
                      {activeBuffer.users.length} member
                      {activeBuffer.users.length === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </div>
                <div className="body-cols">
                  <div ref={messagesRef} className="messages">
                    {activeBuffer.messages.length === 0 ? (
                      <div className="empty">No messages yet.</div>
                    ) : (
                      activeBuffer.messages.map((line) => (
                        <MessageLine key={line.id} line={line} />
                      ))
                    )}
                  </div>
                  {activeBuffer.kind === "channel" &&
                    activeBuffer.users.length > 0 && (
                      <div className="users">
                        <div className="u-count">
                          {activeBuffer.users.length} users
                        </div>
                        {activeBuffer.users.map((user) => {
                          // Strip the FULL status-prefix run (e.g. "@+") so a
                          // multi-prefix nick doesn't leak a stray sigil into the name.
                          const sigil = /^[~&@%+]+/.exec(user)?.[0] || "";

                          return (
                            <div key={user} className="u" title={user}>
                              <span className={userClass(user)}>{sigil}</span>
                              {user.slice(sigil.length)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
                <form
                  className="composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSend();
                  }}
                >
                  <input
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      status === "online"
                        ? `Message ${activeBuffer.name} (or /help)…`
                        : "Connecting…"
                    }
                    value={draft}
                  />
                  <button
                    className="send-btn"
                    disabled={status !== "online" || !draft.trim()}
                    type="submit"
                  >
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="empty">Select a channel to start chatting.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="login-wrap">
          <form
            className="login-card"
            onSubmit={(event) => {
              event.preventDefault();
              onConnect();
            }}
          >
            <h1>IRC</h1>
            <p className="sub">Libera.Chat · over Tor · amnesic</p>

            <label>
              Network
              <select
                onChange={(event) => setNetworkId(event.target.value)}
                value={networkId}
              >
                {IRC_NETWORKS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.host})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Nickname
              <input
                autoComplete="off"
                onChange={(event) => setFormNick(event.target.value)}
                placeholder="e.g. tor_user"
                value={formNick}
              />
            </label>

            <label>
              Channels
              <input
                autoComplete="off"
                onChange={(event) => setFormChannels(event.target.value)}
                placeholder="#libera, #tor"
                value={formChannels}
              />
            </label>

            <span
              className="adv"
              onClick={() => setShowAdvanced((value) => !value)}
              role="button"
              tabIndex={0}
            >
              {showAdvanced ? "▾" : "▸"} Registered account (SASL) — optional
            </span>
            {showAdvanced && (
              <>
                <label>
                  NickServ account
                  <input
                    autoComplete="off"
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder="account name"
                    value={account}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="off"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="NickServ password"
                    type="password"
                    value={password}
                  />
                </label>
                <p className="hint">
                  Libera often requires a registered account authenticated over
                  SASL to join channels from a Tor exit. Kept in memory only.
                </p>
              </>
            )}

            {(formError || error) && (
              <div className="error">{formError || error}</div>
            )}

            <button className="primary-btn" type="submit">
              {status === "error" ? "Reconnect" : "Connect over Tor"}
            </button>
            <p className="hint">
              A first connection over a cold Tor circuit can take 10–30 seconds.
              Messages, history and any password are forgotten when you close
              this window.
            </p>
          </form>
        </div>
      )}
    </StyledIRC>
  );
};

export default IRC;
