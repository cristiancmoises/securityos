import { useCallback, useEffect, useRef, useState } from "react";

// All Matrix traffic goes to this SAME-ORIGIN endpoint, which forwards to the one
// fixed homeserver over Tor (see pages/api/matrix/[...path].ts). The client never
// talks to matrix.securityops.co directly.
const API_BASE = "/api/matrix/_matrix/client/v3";

// First /sync pulls a small slice of recent timeline so the UI isn't empty; the
// long-poll loop then streams new events with timeout=30000.
const INITIAL_SYNC_FILTER = JSON.stringify({
  room: { timeline: { limit: 30 } },
});

export type MatrixMessage = {
  body: string;
  eventId: string;
  mine: boolean;
  pending?: boolean;
  sender: string;
};

export type MatrixRoom = {
  id: string;
  messages: MatrixMessage[];
  name: string;
};

type Session = {
  accessToken: string;
  userId: string;
};

export type ConnState = "offline" | "connecting" | "online" | "error";

// Minimal shapes for the bits of the Matrix /sync + /login responses we read.
type LoginResponse = {
  access_token?: string;
  error?: string;
  errcode?: string;
  user_id?: string;
};

type TimelineEvent = {
  content?: { body?: string; msgtype?: string; name?: string };
  event_id?: string;
  sender?: string;
  type?: string;
};

type JoinedRoom = {
  state?: { events?: TimelineEvent[] };
  timeline?: { events?: TimelineEvent[] };
};

type SyncResponse = {
  error?: string;
  next_batch?: string;
  rooms?: { join?: Record<string, JoinedRoom> };
};

// Opaque transaction id for PUT .../send/... — crypto.getRandomValues only (no
// Math.random / Date.now), combined with a monotonic ref counter for uniqueness
// within a session.
const randomHex = (bytes: number): string => {
  const buffer = new Uint8Array(bytes);

  crypto.getRandomValues(buffer);

  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
};

type UseMatrix = {
  activeRoom?: MatrixRoom;
  conn: ConnState;
  error: string;
  login: (username: string, password: string) => Promise<void>;
  loggingIn: boolean;
  logout: () => void;
  rooms: MatrixRoom[];
  selectRoom: (roomId: string) => void;
  selectedRoomId: string;
  sendMessage: (text: string) => Promise<void>;
  session?: Session;
};

const useMatrix = (): UseMatrix => {
  const [session, setSession] = useState<Session>();
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [conn, setConn] = useState<ConnState>("offline");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // mountedRef gates every async setState; abortRef cancels the in-flight /sync on
  // unmount so the long-poll loop stops cleanly.
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController>();
  const txnRef = useRef(0);

  // Apply one /sync response into the room map: room name (m.room.name state event
  // else the room id) + appended m.room.message timeline events.
  const applySync = useCallback(
    (data: SyncResponse, userId: string) => {
      const joined = data.rooms?.join;

      if (!joined) return;

      setRooms((previous) => {
        const byId = new Map(previous.map((room) => [room.id, room]));

        Object.entries(joined).forEach(([roomId, room]) => {
          const existing = byId.get(roomId) ?? {
            id: roomId,
            messages: [],
            name: roomId,
          };
          let { name } = existing;

          (room.state?.events ?? []).forEach((event) => {
            if (event.type === "m.room.name" && event.content?.name) {
              name = event.content.name;
            }
          });

          const seen = new Set(existing.messages.map((m) => m.eventId));
          const incoming: MatrixMessage[] = [];

          (room.timeline?.events ?? []).forEach((event) => {
            if (
              event.type !== "m.room.message" ||
              !event.content?.body ||
              !event.event_id
            ) {
              return;
            }
            if (seen.has(event.event_id)) return;
            seen.add(event.event_id);
            incoming.push({
              body: event.content.body,
              eventId: event.event_id,
              mine: event.sender === userId,
              sender: event.sender || "?",
            });
          });

          // Drop optimistic placeholders once the real event arrives for our own
          // messages (reconcile by body), then append the confirmed events.
          const confirmedBodies = new Set(
            incoming.filter((m) => m.mine).map((m) => m.body)
          );
          const kept = existing.messages.filter(
            (m) => !(m.pending && confirmedBodies.has(m.body))
          );

          byId.set(roomId, {
            id: roomId,
            messages: [...kept, ...incoming],
            name,
          });
        });

        return Array.from(byId.values());
      });
    },
    [setRooms]
  );

  // Long-poll /sync forever (until unmount/abort). The first call carries the
  // filter and no since; each subsequent call passes since=<next_batch> with a
  // 30s timeout. Network blips set the error state but keep the loop alive.
  const runSyncLoop = useCallback(
    async (accessToken: string, userId: string) => {
      const controller = new AbortController();

      abortRef.current = controller;

      let since = "";

      while (mountedRef.current && !controller.signal.aborted) {
        const params = new URLSearchParams();

        if (since) {
          params.set("since", since);
          params.set("timeout", "30000");
        } else {
          params.set("filter", INITIAL_SYNC_FILTER);
        }

        try {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(`${API_BASE}/sync?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });

          if (!mountedRef.current) return;

          // eslint-disable-next-line no-await-in-loop
          const data = (await response.json()) as SyncResponse;

          if (!response.ok) {
            setConn("error");
            setError(data.error || `Sync failed (${response.status})`);
            // Back off briefly, then retry rather than spinning hot.
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => {
              setTimeout(r, 3000);
            });
            continue;
          }

          if (!mountedRef.current) return;
          setConn("online");
          setError("");
          applySync(data, userId);
          since = data.next_batch || since;
        } catch (caught) {
          if (controller.signal.aborted || !mountedRef.current) return;
          setConn("error");
          setError(
            caught instanceof Error ? caught.message : "Connection lost"
          );
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => {
            setTimeout(r, 3000);
          });
        }
      }
    },
    [applySync]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        setError("Enter a username and password.");
        return;
      }

      setLoggingIn(true);
      setError("");
      setConn("connecting");

      try {
        const response = await fetch(`${API_BASE}/login`, {
          body: JSON.stringify({
            identifier: { type: "m.id.user", user: username },
            password,
            type: "m.login.password",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as LoginResponse;

        if (!mountedRef.current) return;

        if (!response.ok || !data.access_token || !data.user_id) {
          setConn("error");
          setError(
            data.error || data.errcode || `Login failed (${response.status})`
          );
          return;
        }

        // IN MEMORY only — amnesic. Never persisted to localStorage; closing the
        // app forgets the token (re-login each session is the private default).
        setSession({ accessToken: data.access_token, userId: data.user_id });
        setConn("connecting");
        runSyncLoop(data.access_token, data.user_id);
      } catch (caught) {
        if (!mountedRef.current) return;
        setConn("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not reach the homeserver over Tor."
        );
      } finally {
        if (mountedRef.current) setLoggingIn(false);
      }
    },
    [runSyncLoop]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed || !session || !selectedRoomId) return;

      txnRef.current += 1;
      const txnId = `securityos-${txnRef.current}-${randomHex(8)}`;
      const optimisticId = `pending-${txnId}`;

      // Optimistically append; the next /sync reconciles by body and removes this
      // placeholder when the confirmed event arrives.
      setRooms((previous) =>
        previous.map((room) =>
          room.id === selectedRoomId
            ? {
                ...room,
                messages: [
                  ...room.messages,
                  {
                    body: trimmed,
                    eventId: optimisticId,
                    mine: true,
                    pending: true,
                    sender: session.userId,
                  },
                ],
              }
            : room
        )
      );

      try {
        const url = `${API_BASE}/rooms/${encodeURIComponent(
          selectedRoomId
        )}/send/m.room.message/${encodeURIComponent(txnId)}`;
        const response = await fetch(url, {
          body: JSON.stringify({ body: trimmed, msgtype: "m.text" }),
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          method: "PUT",
        });

        if (!mountedRef.current) return;

        if (!response.ok) {
          const data = (await response
            .json()
            .catch(() => ({}))) as LoginResponse;

          setError(data.error || `Send failed (${response.status})`);
          // Mark the optimistic bubble as failed (drop the pending tint reconcile).
          setRooms((previous) =>
            previous.map((room) =>
              room.id === selectedRoomId
                ? {
                    ...room,
                    messages: room.messages.filter(
                      (m) => m.eventId !== optimisticId
                    ),
                  }
                : room
            )
          );
        }
      } catch (caught) {
        if (!mountedRef.current) return;
        setError(
          caught instanceof Error ? caught.message : "Could not send message."
        );
        setRooms((previous) =>
          previous.map((room) =>
            room.id === selectedRoomId
              ? {
                  ...room,
                  messages: room.messages.filter(
                    (m) => m.eventId !== optimisticId
                  ),
                }
              : room
          )
        );
      }
    },
    [selectedRoomId, session]
  );

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  const logout = useCallback(() => {
    abortRef.current?.abort();
    setSession(undefined);
    setRooms([]);
    setSelectedRoomId("");
    setConn("offline");
    setError("");
  }, []);

  // Auto-select the first room once rooms appear.
  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  // Stop the sync loop on unmount.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const activeRoom = rooms.find((room) => room.id === selectedRoomId);

  return {
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
  };
};

export default useMatrix;
