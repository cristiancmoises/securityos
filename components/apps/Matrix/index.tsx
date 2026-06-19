import { HOMESERVER_LABEL } from "components/apps/Matrix/matrixClient";
import StyledMatrix from "components/apps/Matrix/StyledMatrix";
import useMatrix, {
  type ConnState,
  type MatrixMessage,
} from "components/apps/Matrix/useMatrix";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useEffect, useRef, useState } from "react";

// Matrix — first-party, FULLY FUNCTIONAL Matrix client for the SecurityOS desktop
// (matrix-js-sdk + Rust crypto/E2EE). Every network call goes to the SAME-ORIGIN
// /api/matrix endpoint, forwarded to matrix.securityops.co over Tor. Decrypts
// encrypted rooms, searches people, browses + joins federated rooms, handles
// invites, and renders images. The session is in-memory/amnesic.

const CONN_LABEL: Record<ConnState, string> = {
  connecting: "Connecting over Tor…",
  error: "Connection error",
  offline: "Not connected",
  online: "Connected over Tor",
  syncing: "Syncing over Tor…",
};

type Tab = "chats" | "discover" | "people";

// Lazily fetch + decrypt an image attachment, then render it from a blob URL.
const MediaImage: FC<{
  message: MatrixMessage;
  resolve: (message: MatrixMessage) => Promise<string>;
}> = ({ message, resolve }) => {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    resolve(message)
      .then((resolved) => active && setUrl(resolved))
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
    };
  }, [message, resolve]);

  if (failed) return <div className="media-fail">🖼️ {message.fileName}</div>;
  if (!url) return <div className="media-loading">Loading image…</div>;

  return (
    <a href={url} rel="noreferrer" target="_blank">
      <img alt={message.fileName || "image"} className="media-img" src={url} />
    </a>
  );
};

const Matrix: FC<ComponentProcessProps> = () => {
  const {
    acceptInvite,
    activeRoom,
    busy,
    circuit,
    conn,
    cryptoReady,
    error,
    invites,
    joinRoom,
    listPublicRooms,
    loggingIn,
    login,
    logout,
    publicRooms,
    rejectInvite,
    resolveMedia,
    rooms,
    searchUsers,
    selectRoom,
    selectedRoomId,
    sendMessage,
    session,
    startDm,
    uploadImage,
    userResults,
  } = useMatrix();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>("chats");
  const [peopleTerm, setPeopleTerm] = useState("");
  const [roomTerm, setRoomTerm] = useState("");
  const [joinTarget, setJoinTarget] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const element = messagesRef.current;

    if (element) element.scrollTop = element.scrollHeight;
  }, [activeRoom?.messages, selectedRoomId]);

  const dotClass =
    conn === "error" ? "dot error" : conn === "online" ? "dot" : "dot busy";

  const onSend = (): void => {
    if (!draft.trim()) return;
    void sendMessage(draft);
    setDraft("");
  };

  const onSelect = (roomId: string): void => {
    selectRoom(roomId);
    setTab("chats");
  };

  return (
    <StyledMatrix>
      <div className="tor-bar">
        <span className="status">
          <span className={dotClass} />
          {CONN_LABEL[conn]}
          {busy && <span className="spinner"> · working…</span>}
        </span>
        {session && (
          <button className="ghost-btn" onClick={logout} type="button">
            Sign out
          </button>
        )}
      </div>

      {session && !cryptoReady && (
        <div className="notice">
          🔓 End-to-end encryption couldn&apos;t start this session — encrypted
          messages may not be readable. Try reopening the app.
        </div>
      )}

      {session ? (
        <div className="panes">
          <div className="sidebar">
            <div className="me" title={session.userId}>
              {session.userId}
            </div>

            <div className="tabs">
              <button
                className={tab === "chats" ? "tab active" : "tab"}
                onClick={() => setTab("chats")}
                type="button"
              >
                Chats
              </button>
              <button
                className={tab === "people" ? "tab active" : "tab"}
                onClick={() => setTab("people")}
                type="button"
              >
                People
              </button>
              <button
                className={tab === "discover" ? "tab active" : "tab"}
                onClick={() => {
                  setTab("discover");
                  if (publicRooms.length === 0) void listPublicRooms();
                }}
                type="button"
              >
                Discover
              </button>
            </div>

            {tab === "chats" && (
              <div className="list">
                {invites.length > 0 && (
                  <div className="invites">
                    <div className="section-label">Invites</div>
                    {invites.map((invite) => (
                      <div key={invite.id} className="invite">
                        <div className="invite-name" title={invite.inviter}>
                          {invite.name}
                        </div>
                        <div className="invite-actions">
                          <button
                            className="mini-btn accept"
                            onClick={() => void acceptInvite(invite.id)}
                            type="button"
                          >
                            Accept
                          </button>
                          <button
                            className="mini-btn"
                            onClick={() => void rejectInvite(invite.id)}
                            type="button"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {rooms.length === 0 ? (
                  <div className="empty">
                    {conn === "online" ? "No joined rooms yet." : "Loading…"}
                  </div>
                ) : (
                  rooms.map((room) => (
                    <button
                      key={room.id}
                      className={
                        room.id === selectedRoomId
                          ? "room-item active"
                          : "room-item"
                      }
                      onClick={() => onSelect(room.id)}
                      title={room.name}
                      type="button"
                    >
                      <span className="room-name">
                        {room.encrypted ? "🔒 " : ""}
                        {room.name}
                      </span>
                      {room.unread > 0 && (
                        <span className="badge">{room.unread}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {tab === "people" && (
              <div className="list">
                <form
                  className="finder"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void searchUsers(peopleTerm);
                  }}
                >
                  <input
                    onChange={(event) => setPeopleTerm(event.target.value)}
                    placeholder="Search people…"
                    value={peopleTerm}
                  />
                  <button className="mini-btn" type="submit">
                    Find
                  </button>
                </form>
                {userResults.length === 0 ? (
                  <div className="empty">
                    Search the directory to start a chat.
                  </div>
                ) : (
                  userResults.map((user) => (
                    <div key={user.userId} className="result">
                      <div className="result-main" title={user.userId}>
                        <div className="result-name">{user.displayName}</div>
                        <div className="result-sub">{user.userId}</div>
                      </div>
                      <button
                        className="mini-btn accept"
                        onClick={() => void startDm(user.userId)}
                        type="button"
                      >
                        Message
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "discover" && (
              <div className="list">
                <form
                  className="finder"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void listPublicRooms(roomTerm);
                  }}
                >
                  <input
                    onChange={(event) => setRoomTerm(event.target.value)}
                    placeholder="Search rooms…"
                    value={roomTerm}
                  />
                  <button className="mini-btn" type="submit">
                    Search
                  </button>
                </form>
                <form
                  className="finder"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void joinRoom(joinTarget);
                    setJoinTarget("");
                  }}
                >
                  <input
                    onChange={(event) => setJoinTarget(event.target.value)}
                    placeholder="Join #room:server or !id…"
                    value={joinTarget}
                  />
                  <button className="mini-btn accept" type="submit">
                    Join
                  </button>
                </form>
                {publicRooms.map((room) => (
                  <div key={room.id} className="result">
                    <div className="result-main" title={room.topic}>
                      <div className="result-name">{room.name}</div>
                      <div className="result-sub">
                        {room.memberCount} members
                        {room.alias ? ` · ${room.alias}` : ""}
                      </div>
                    </div>
                    <button
                      className="mini-btn accept"
                      onClick={() => void joinRoom(room.alias || room.id)}
                      type="button"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chat">
            {activeRoom ? (
              <>
                <div className="chat-header" title={activeRoom.name}>
                  <span className="chat-title">
                    {activeRoom.encrypted ? "🔒 " : ""}
                    {activeRoom.name}
                  </span>
                  <span className="chat-sub">
                    {activeRoom.memberCount} members
                    {activeRoom.encrypted ? " · end-to-end encrypted" : ""}
                  </span>
                </div>
                <div ref={messagesRef} className="messages">
                  {activeRoom.messages.length === 0 ? (
                    <div className="empty">No messages yet.</div>
                  ) : (
                    activeRoom.messages.map((message) => (
                      <div
                        key={message.eventId}
                        className={`msg${message.mine ? " mine" : ""}${
                          message.pending ? " pending" : ""
                        }${message.kind === "encrypted" ? " locked" : ""}`}
                      >
                        {!message.mine && (
                          <div className="sender">{message.senderName}</div>
                        )}
                        {message.kind === "image" ? (
                          <MediaImage
                            message={message}
                            resolve={resolveMedia}
                          />
                        ) : message.kind === "file" ? (
                          <button
                            className="file-link"
                            onClick={() =>
                              void resolveMedia(message).then((url) => {
                                if (url) window.open(url, "_blank");
                              })
                            }
                            type="button"
                          >
                            📎 {message.fileName || "Download file"}
                          </button>
                        ) : (
                          <div className="body">{message.body}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {error && <div className="error">{error}</div>}
                <div className="composer">
                  <input
                    ref={fileRef}
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) void uploadImage(file);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                  <button
                    className="attach-btn"
                    onClick={() => fileRef.current?.click()}
                    title="Send an image"
                    type="button"
                  >
                    📎
                  </button>
                  <input
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSend();
                      }
                    }}
                    placeholder="Message (sent over Tor)…"
                    value={draft}
                  />
                  <button
                    className="send-btn"
                    disabled={!draft.trim()}
                    onClick={onSend}
                    type="button"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">Select a chat, or find people to message.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="login-wrap">
          <form
            className="login-card"
            onSubmit={(event) => {
              event.preventDefault();
              void login(username, password);
            }}
          >
            <h1>Matrix</h1>
            <p className="sub">{HOMESERVER_LABEL} · end-to-end encrypted · over Tor</p>
            <label>
              Username
              <input
                autoComplete="off"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="username"
                value={username}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password"
                type="password"
                value={password}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary-btn" disabled={loggingIn} type="submit">
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
            {loggingIn ? (
              <p className="hint">
                Connecting over Tor… the first connection can take 15–40 seconds
                while the circuit builds.
              </p>
            ) : circuit === "warming" ? (
              <p className="hint">⏳ Establishing Tor circuit — makes sign-in fast…</p>
            ) : circuit === "ready" ? (
              <p className="hint">✓ Tor circuit ready — sign-in will be quick.</p>
            ) : (
              <p className="hint">
                Tor circuit is slow right now — sign-in may take up to a minute.
              </p>
            )}
            <p className="hint">
              Encryption keys live in memory only — closing this window forgets
              them.
            </p>
          </form>
        </div>
      )}
    </StyledMatrix>
  );
};

export default Matrix;
