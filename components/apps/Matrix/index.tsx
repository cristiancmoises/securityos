import {
  HOMESERVER_LABEL,
  isSecureCryptoContext,
} from "components/apps/Matrix/matrixClient";
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
    torReachable,
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
  const [dragOver, setDragOver] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Encrypted-room attachments need crypto.subtle, which only exists in a secure
  // context (HTTPS / http://localhost). On a plain-http LAN origin we disable the
  // attach control for encrypted rooms and say why, instead of failing after the pick.
  const secureCrypto = isSecureCryptoContext();

  // Send every file dropped (or pasted) into the chat. uploadImage handles both
  // images (m.image) and other files (m.file), encrypting them in E2EE rooms.
  const sendFiles = (files: FileList | File[] | null | undefined): void => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file) void uploadImage(file);
    });
  };

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
    <StyledMatrix
      // Swallow file drops ANYWHERE in the Matrix window. Matrix renders as a real
      // top-level React component (not an iframe), so an unhandled file drop would
      // make the browser navigate the whole page to the file — tearing down the OS
      // session. preventDefault here makes a stray drop (e.g. on the login screen or
      // with no room selected) a harmless no-op; the chat pane adds the upload.
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes("Files")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        if (Array.from(event.dataTransfer.types).includes("Files")) {
          event.preventDefault();
        }
      }}
    >
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

          <div
            className="chat"
            onDragLeave={(event) => {
              // Ignore flicker from moving over child elements — only clear when the
              // pointer actually leaves the chat pane.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOver(false);
              }
            }}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) {
                return;
              }
              // preventDefault FIRST (registers the drop zone + blocks navigation),
              // then decide whether to show the upload overlay.
              event.preventDefault();
              if (activeRoom) setDragOver(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (activeRoom) sendFiles(event.dataTransfer.files);
            }}
          >
            {dragOver && activeRoom && (
              <div className="drop-overlay">
                <div className="drop-card">
                  📎 Drop to send to {activeRoom.name}
                </div>
              </div>
            )}
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
                            onClick={() => {
                              // Open the viewer window SYNCHRONOUSLY inside the click
                              // gesture (so the pop-up blocker allows it), then point
                              // it at the resolved blob URL once the (async) fetch +
                              // decryption finishes. Opening after the await would be
                              // blocked and silently fail.
                              const viewer = window.open("", "_blank");

                              void resolveMedia(message)
                                .then((url) => {
                                  if (!viewer) return;
                                  if (url) viewer.location.href = url;
                                  else viewer.close();
                                })
                                .catch(() => viewer?.close());
                            }}
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
                    multiple
                    onChange={(event) => {
                      sendFiles(event.target.files);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                  <button
                    className="attach-btn"
                    disabled={activeRoom.encrypted && !secureCrypto}
                    onClick={() => fileRef.current?.click()}
                    title={
                      activeRoom.encrypted && !secureCrypto
                        ? "Encrypted-room attachments need HTTPS or http://localhost — text messages still work"
                        : "Send an image"
                    }
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
                    onPaste={(event) => {
                      // Paste an image straight into the chat (e.g. a screenshot).
                      const { files } = event.clipboardData;

                      if (files && files.length > 0) {
                        event.preventDefault();
                        sendFiles(files);
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
              <div className="empty">
                Select a chat, or find people to message.
              </div>
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
            <p className="sub">
              {HOMESERVER_LABEL} · end-to-end encrypted · over Tor
            </p>
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
            <button
              className="primary-btn"
              disabled={loggingIn || torReachable === "down"}
              type="submit"
            >
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
            {torReachable === "down" ? (
              <p className="hint warn">
                🧅 Tor isn&apos;t reachable, so the homeserver can&apos;t be
                contacted. Open <b>Tor Control</b> and start Tor, then reopen
                Matrix.
              </p>
            ) : loggingIn ? (
              <p className="hint">
                Connecting over Tor… the first connection can take 15–40 seconds
                while the circuit builds.
              </p>
            ) : circuit === "warming" ? (
              <p className="hint">
                ⏳ Establishing Tor circuit — makes sign-in fast…
              </p>
            ) : circuit === "ready" ? (
              <p className="hint">
                ✓ Tor circuit ready — sign-in will be quick.
              </p>
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
