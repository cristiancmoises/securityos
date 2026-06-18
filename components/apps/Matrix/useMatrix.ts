import {
  createMatrixSession,
  decryptAttachment,
  encryptAttachment,
} from "components/apps/Matrix/matrixClient";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// SecurityOS Matrix — a FULL Matrix client (matrix-js-sdk + Rust crypto/E2EE),
// every request tunneled through the same-origin /api/matrix Tor proxy. Decrypts
// encrypted rooms, searches the user directory, browses + joins federated rooms,
// handles invites, and renders images/files (incl. encrypted attachments).

export type ConnState =
  | "connecting"
  | "error"
  | "offline"
  | "online"
  | "syncing";

export type MsgKind = "encrypted" | "file" | "image" | "notice" | "text";

export type MatrixMessage = {
  body: string;
  encryptedFile?: unknown;
  eventId: string;
  fileName?: string;
  kind: MsgKind;
  mimetype?: string;
  mine: boolean;
  mxc?: string;
  pending?: boolean;
  sender: string;
  senderName: string;
  ts: number;
};

export type MatrixRoom = {
  encrypted: boolean;
  id: string;
  memberCount: number;
  messages: MatrixMessage[];
  name: string;
  unread: number;
};

export type Invite = { id: string; inviter: string; name: string };
export type UserResult = {
  avatarMxc?: string;
  displayName: string;
  userId: string;
};
export type PublicRoom = {
  alias?: string;
  encrypted?: boolean;
  id: string;
  memberCount: number;
  name: string;
  topic: string;
};

type Session = { userId: string };

type UseMatrix = {
  acceptInvite: (id: string) => Promise<void>;
  activeRoom?: MatrixRoom;
  busy: boolean;
  conn: ConnState;
  cryptoReady: boolean;
  error: string;
  invites: Invite[];
  joinRoom: (idOrAlias: string) => Promise<void>;
  listPublicRooms: (term?: string) => Promise<void>;
  loggingIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  publicRooms: PublicRoom[];
  rejectInvite: (id: string) => Promise<void>;
  resolveMedia: (message: MatrixMessage) => Promise<string>;
  rooms: MatrixRoom[];
  searchUsers: (term: string) => Promise<void>;
  selectRoom: (roomId: string) => void;
  selectedRoomId: string;
  sendMessage: (text: string) => Promise<void>;
  session?: Session;
  startDm: (userId: string) => Promise<void>;
  uploadImage: (file: File) => Promise<void>;
  userResults: UserResult[];
};

const MESSAGE_TYPE = "m.room.message";

const buildMessage = (
  event: MatrixEvent,
  myUserId: string,
  room: Room
): MatrixMessage | undefined => {
  const eventId = event.getId() || "";
  const sender = event.getSender() || "?";
  const base = {
    eventId,
    mine: sender === myUserId,
    pending: event.status === "sending" || event.status === "not_sent",
    sender,
    senderName: room.getMember(sender)?.name || sender,
    ts: event.getTs(),
  };

  if (event.isDecryptionFailure()) {
    return {
      ...base,
      body: "🔒 Unable to decrypt this message (sent before this device).",
      kind: "encrypted",
    };
  }

  const type = event.getType();

  if (type === "m.room.encrypted") {
    return { ...base, body: "🔒 Decrypting…", kind: "encrypted" };
  }

  if (type !== MESSAGE_TYPE) return undefined;

  const content = event.getContent();
  const msgtype = content.msgtype as string | undefined;

  if (msgtype === "m.image") {
    return {
      ...base,
      body: (content.body as string) || "image",
      encryptedFile: content.file,
      fileName: content.body as string,
      kind: "image",
      mimetype: content.info?.mimetype as string,
      mxc: (content.url as string) || (content.file as { url?: string })?.url,
    };
  }

  if (msgtype === "m.file" || msgtype === "m.video" || msgtype === "m.audio") {
    return {
      ...base,
      body: (content.body as string) || "file",
      encryptedFile: content.file,
      fileName: content.body as string,
      kind: "file",
      mimetype: content.info?.mimetype as string,
      mxc: (content.url as string) || (content.file as { url?: string })?.url,
    };
  }

  return {
    ...base,
    body: (content.body as string) || "",
    kind: msgtype === "m.notice" ? "notice" : "text",
  };
};

const toRoom = (room: Room, myUserId: string): MatrixRoom => {
  const events = room.getLiveTimeline().getEvents();
  const messages: MatrixMessage[] = [];

  events.forEach((event) => {
    const message = buildMessage(event, myUserId, room);

    if (message && (message.body || message.kind !== "text")) {
      messages.push(message);
    }
  });

  return {
    encrypted: Boolean(
      (room as unknown as { hasEncryptionStateEvent?: () => boolean })
        .hasEncryptionStateEvent?.()
    ),
    id: room.roomId,
    memberCount: room.getJoinedMemberCount(),
    messages,
    name: room.name || room.roomId,
    unread: room.getUnreadNotificationCount?.() || 0,
  };
};

const useMatrix = (): UseMatrix => {
  const clientRef = useRef<MatrixClient>();
  const tokenRef = useRef("");
  const mediaCacheRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [session, setSession] = useState<Session>();
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [conn, setConn] = useState<ConnState>("offline");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(true);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);

  const rebuild = useCallback(() => {
    const client = clientRef.current;

    if (!client || !mountedRef.current) return;

    const myUserId = client.getUserId() || "";
    const all = client.getRooms();

    setRooms(
      all
        .filter((room) => room.getMyMembership() === "join")
        .map((room) => toRoom(room, myUserId))
        .sort((a, b) => {
          const at = a.messages[a.messages.length - 1]?.ts || 0;
          const bt = b.messages[b.messages.length - 1]?.ts || 0;

          return bt - at;
        })
    );

    setInvites(
      all
        .filter((room) => room.getMyMembership() === "invite")
        .map((room) => ({
          id: room.roomId,
          inviter:
            room.getDMInviter() ||
            room.currentState
              .getStateEvents("m.room.member", myUserId)
              ?.getSender() ||
            "",
          name: room.name || room.roomId,
        }))
    );
  }, []);

  // Coalesce the storm of sync/timeline/decrypt events into one rebuild/frame.
  const scheduleRebuild = useCallback(() => {
    if (rebuildTimerRef.current) return;
    rebuildTimerRef.current = setTimeout(() => {
      rebuildTimerRef.current = undefined;
      rebuild();
    }, 120);
  }, [rebuild]);

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
        const { accessToken, client, cryptoReady: ready, userId } =
          await createMatrixSession(username.trim(), password);

        if (!mountedRef.current) {
          client.stopClient();

          return;
        }

        clientRef.current = client;
        tokenRef.current = accessToken;
        setCryptoReady(ready);
        setSession({ userId });

        const sdk = await import("matrix-js-sdk");

        client.on(sdk.ClientEvent.Sync, (state: string) => {
          if (!mountedRef.current) return;
          if (state === "PREPARED" || state === "SYNCING") {
            setConn("online");
            setError("");
          } else if (state === "ERROR") {
            setConn("error");
          } else if (state === "RECONNECTING") {
            setConn("connecting");
          }
          scheduleRebuild();
        });
        client.on(sdk.RoomEvent.Timeline, scheduleRebuild);
        client.on(sdk.RoomEvent.Name, scheduleRebuild);
        client.on(sdk.RoomEvent.MyMembership, scheduleRebuild);
        client.on(sdk.MatrixEventEvent.Decrypted, scheduleRebuild);

        setConn("syncing");
        // lazyLoadMembers keeps the initial /sync small + fast over Tor (members
        // are fetched on demand) — the big win for connecting an established
        // account on a slow circuit.
        await client.startClient({
          initialSyncLimit: 30,
          lazyLoadMembers: true,
        });
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
    [scheduleRebuild]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const client = clientRef.current;
      const trimmed = text.trim();

      if (!client || !trimmed || !selectedRoomId) return;

      try {
        await client.sendTextMessage(selectedRoomId, trimmed);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not send message."
        );
      }
    },
    [selectedRoomId]
  );

  const uploadImage = useCallback(
    async (file: File) => {
      const client = clientRef.current;

      if (!client || !selectedRoomId) return;

      setBusy(true);
      setError("");

      try {
        const room = client.getRoom(selectedRoomId);
        const isEncrypted = Boolean(
          (room as unknown as { hasEncryptionStateEvent?: () => boolean })
            ?.hasEncryptionStateEvent?.()
        );
        const info = {
          h: 0,
          mimetype: file.type || "application/octet-stream",
          size: file.size,
          w: 0,
        };
        const isImage = file.type.startsWith("image/");
        const msgtype = isImage ? "m.image" : "m.file";

        if (isEncrypted) {
          const { data, file: encryptedFile } = await encryptAttachment(
            await file.arrayBuffer()
          );
          const uploaded = await client.uploadContent(new Blob([data]), {
            includeFilename: false,
            type: "application/octet-stream",
          });

          await client.sendMessage(selectedRoomId, {
            body: file.name,
            file: { ...encryptedFile, url: uploaded.content_uri },
            info,
            msgtype,
          } as never);
        } else {
          const uploaded = await client.uploadContent(file, {
            name: file.name,
            type: file.type,
          });

          await client.sendMessage(selectedRoomId, {
            body: file.name,
            info,
            msgtype,
            url: uploaded.content_uri,
          } as never);
        }
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not upload file."
        );
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [selectedRoomId]
  );

  const resolveMedia = useCallback(
    async (message: MatrixMessage): Promise<string> => {
      const client = clientRef.current;
      const cached = mediaCacheRef.current.get(message.eventId);

      if (cached) return cached;
      if (!client || !message.mxc) return "";

      const httpUrl = client.mxcUrlToHttp(
        message.mxc,
        undefined,
        undefined,
        undefined,
        false,
        true,
        true
      );

      if (!httpUrl) return "";

      const response = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });

      if (!response.ok) throw new Error(`Media fetch failed (${response.status})`);

      let buffer = await response.arrayBuffer();

      if (message.encryptedFile) {
        buffer = await decryptAttachment(
          buffer,
          message.encryptedFile as Parameters<typeof decryptAttachment>[1]
        );
      }

      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: message.mimetype || "application/octet-stream",
        })
      );

      mediaCacheRef.current.set(message.eventId, url);

      return url;
    },
    []
  );

  const searchUsers = useCallback(async (term: string) => {
    const client = clientRef.current;

    if (!client || !term.trim()) {
      setUserResults([]);

      return;
    }

    setBusy(true);

    try {
      const result = await client.searchUserDirectory({ limit: 20, term });

      if (!mountedRef.current) return;
      setUserResults(
        result.results.map((user) => ({
          avatarMxc: user.avatar_url,
          displayName: user.display_name || user.user_id,
          userId: user.user_id,
        }))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, []);

  const listPublicRooms = useCallback(async (term?: string) => {
    const client = clientRef.current;

    if (!client) return;

    setBusy(true);

    try {
      const result = await client.publicRooms({
        limit: 50,
        ...(term?.trim()
          ? { filter: { generic_search_term: term.trim() } }
          : {}),
      });

      if (!mountedRef.current) return;
      setPublicRooms(
        result.chunk.map((room) => ({
          alias: room.canonical_alias,
          id: room.room_id,
          memberCount: room.num_joined_members,
          name: room.name || room.canonical_alias || room.room_id,
          topic: room.topic || "",
        }))
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not list rooms."
      );
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, []);

  const joinRoom = useCallback(
    async (idOrAlias: string) => {
      const client = clientRef.current;
      const target = idOrAlias.trim();

      if (!client || !target) return;

      setBusy(true);
      setError("");

      try {
        const room = await client.joinRoom(target);

        if (mountedRef.current) setSelectedRoomId(room.roomId);
        scheduleRebuild();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not join room."
        );
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [scheduleRebuild]
  );

  const startDm = useCallback(
    async (userId: string) => {
      const client = clientRef.current;

      if (!client || !userId) return;

      setBusy(true);
      setError("");

      try {
        const { room_id: roomId } = await client.createRoom({
          initial_state: [
            {
              content: { algorithm: "m.megolm.v1.aes-sha2" },
              state_key: "",
              type: "m.room.encryption",
            },
          ],
          invite: [userId],
          is_direct: true,
          preset: "trusted_private_chat" as never,
        });

        if (mountedRef.current) {
          setSelectedRoomId(roomId);
          setUserResults([]);
        }
        scheduleRebuild();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not start chat."
        );
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [scheduleRebuild]
  );

  const acceptInvite = useCallback(
    async (id: string) => {
      await joinRoom(id);
    },
    [joinRoom]
  );

  const rejectInvite = useCallback(
    async (id: string) => {
      const client = clientRef.current;

      if (!client) return;

      try {
        await client.leave(id);
        scheduleRebuild();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not decline invite."
        );
      }
    },
    [scheduleRebuild]
  );

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  const logout = useCallback(() => {
    const client = clientRef.current;

    mediaCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    mediaCacheRef.current.clear();

    if (client) {
      try {
        client.stopClient();
        // Best-effort: invalidate the token + device server-side (amnesic).
        void client.logout(true).catch(() => undefined);
        client.clearStores().catch(() => undefined);
      } catch {
        // ignore teardown errors
      }
    }

    clientRef.current = undefined;
    tokenRef.current = "";
    setSession(undefined);
    setRooms([]);
    setInvites([]);
    setSelectedRoomId("");
    setUserResults([]);
    setPublicRooms([]);
    setConn("offline");
    setCryptoReady(true);
    setError("");
  }, []);

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
      mediaCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      mediaCacheRef.current.clear();
      clientRef.current?.stopClient();
    };
  }, []);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId]
  );

  return {
    acceptInvite,
    activeRoom,
    busy,
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
  };
};

export default useMatrix;
