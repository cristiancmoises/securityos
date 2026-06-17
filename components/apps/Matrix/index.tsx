import StyledMatrix from "components/apps/Matrix/StyledMatrix";
import useMatrix, { type ConnState } from "components/apps/Matrix/useMatrix";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useEffect, useRef, useState } from "react";

// Matrix — first-party, FUNCTIONAL Matrix chat client for the SecurityOS desktop.
// Every network call goes to the SAME-ORIGIN /api/matrix endpoint, which forwards
// to the one fixed homeserver (matrix.securityops.co) over Tor. The access token
// lives in memory only (amnesic): closing the window forgets it, so each session
// re-authenticates — the privacy-correct default.

const CONN_LABEL: Record<ConnState, string> = {
  connecting: "Connecting over Tor…",
  error: "Connection error",
  offline: "Not connected",
  online: "Connected over Tor",
};

const Matrix: FC<ComponentProcessProps> = () => {
  const {
    activeRoom,
    conn,
    error,
    login,
    loggingIn,
    logout,
    rooms,
    selectRoom,
    selectedRoomId,
    sendMessage,
    session,
  } = useMatrix();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Keep the message list pinned to the newest message.
  useEffect(() => {
    const element = messagesRef.current;

    if (element) element.scrollTop = element.scrollHeight;
  }, [activeRoom?.messages]);

  const dotClass =
    conn === "error" ? "dot error" : conn === "online" ? "dot" : "dot busy";

  const onSend = (): void => {
    if (!draft.trim()) return;
    void sendMessage(draft);
    setDraft("");
  };

  return (
    <StyledMatrix>
      <div className="tor-bar">
        <span className="status">
          <span className={dotClass} />
          {CONN_LABEL[conn]}
        </span>
        {session && (
          <button className="ghost-btn" onClick={logout} type="button">
            Sign out
          </button>
        )}
      </div>

      {session ? (
        <div className="panes">
          <div className="sidebar">
            <div className="me" title={session.userId}>
              {session.userId}
            </div>
            {rooms.length === 0 ? (
              <div className="empty">
                {conn === "online" ? "No joined rooms." : "Loading rooms…"}
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
                  onClick={() => selectRoom(room.id)}
                  title={room.name}
                  type="button"
                >
                  {room.name}
                </button>
              ))
            )}
          </div>

          <div className="chat">
            {activeRoom ? (
              <>
                <div className="chat-header" title={activeRoom.name}>
                  {activeRoom.name}
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
                        }`}
                      >
                        <div className="sender">{message.sender}</div>
                        <div className="body">{message.body}</div>
                      </div>
                    ))
                  )}
                </div>
                {error && <div className="error">{error}</div>}
                <div className="composer">
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
              <div className="empty">Select a room to start chatting.</div>
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
            <p className="sub">matrix.securityops.co · routed over Tor</p>
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
          </form>
        </div>
      )}
    </StyledMatrix>
  );
};

export default Matrix;
