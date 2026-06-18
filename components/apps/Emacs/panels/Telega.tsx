import { memo, useRef, useState } from "react";
import { StyledChatPanel } from "components/apps/Emacs/panels/StyledPanels";

/**
 * SIMULATED Telega panel — modelled on telega.el (Telegram in Emacs).
 *
 * THIS IS NOT A REAL TELEGRAM CLIENT. SecurityOS Emacs is an offline,
 * self-contained engine: there is NO network, NO TDLib, NO account. Everything
 * below is seeded sample data, and the composer is pure local-echo (messages
 * are appended to in-memory state only). The banner says so to the user.
 */

type Message = {
  from: string;
  text: string;
  time: string;
  me?: boolean;
};

type Thread = {
  id: string;
  name: string;
  handle: string;
  unread?: number;
  messages: Message[];
};

const SEED_THREADS: Thread[] = [
  {
    id: "savedmsgs",
    name: "Saved Messages",
    handle: "self",
    messages: [
      { from: "me", text: "telega.el config backup ✅", time: "08:02", me: true },
      { from: "me", text: "remember: M-x telega-chat-with", time: "08:03", me: true },
    ],
  },
  {
    id: "emacs-de",
    name: "Emacs Deutschland",
    handle: "@emacs_de",
    unread: 3,
    messages: [
      { from: "zerolab", text: "org-roam v2 ist endlich stabil", time: "09:14" },
      { from: "lambda", text: "nutzt jemand corfu statt company?", time: "09:18" },
      { from: "me", text: "corfu + cape hier, läuft super", time: "09:21", me: true },
      { from: "zerolab", text: "danke, probier ich aus", time: "09:22" },
    ],
  },
  {
    id: "spacemacs",
    name: "Spacemacs",
    handle: "@spacemacs",
    unread: 1,
    messages: [
      { from: "syl20bnr", text: "develop branch: new SPC a layer", time: "11:40" },
      { from: "me", text: "SPC a t opens telega here 🎉", time: "11:45", me: true },
    ],
  },
  {
    id: "secops",
    name: "secops-warroom",
    handle: "@secops",
    messages: [
      { from: "nullbyte", text: "CVE triage at 1500 UTC", time: "13:02" },
      { from: "me", text: "ack, joining from Emacs", time: "13:05", me: true },
    ],
  },
];

const Telega: FC = () => {
  const [threads, setThreads] = useState<Thread[]>(SEED_THREADS);
  const [activeId, setActiveId] = useState<string>(SEED_THREADS[1].id);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const active = threads.find((t) => t.id === activeId);

  const send = (): void => {
    const body = draft.trim();

    if (!body || !active) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    setThreads((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? { ...t, messages: [...t.messages, { from: "me", text: body, time, me: true }] }
          : t
      )
    );
    setDraft("");
  };

  return (
    <StyledChatPanel>
      <div className="sim-banner">
        SIMULATED telega.el — offline demo, no Telegram connection
      </div>
      <div className="roster">
        <div className="roster-head">telega — Chats</div>
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];

          return (
            <button
              key={t.id}
              className={`roster-item${t.id === activeId ? " active" : ""}`}
              onClick={() => {
                setActiveId(t.id);
                setThreads((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, unread: 0 } : x))
                );
              }}
              type="button"
            >
              {t.unread ? <span className="badge">{t.unread}</span> : null}
              <span className="who">{t.name}</span>
              <span className="preview">{last ? last.text : t.handle}</span>
            </button>
          );
        })}
      </div>
      <div className="convo">
        {active ? (
          <>
            <div className="convo-head">
              <span className="title">{active.name}</span>
              <span className="sub">{active.handle}</span>
            </div>
            <div className="messages">
              {active.messages.map((m, i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${active.id}-${i}`}
                  className={`msg${m.me ? " me" : ""}`}
                >
                  <div className="meta">
                    <span className="name">{m.from}</span>
                    <span className="time">{m.time}</span>
                  </div>
                  <div className="body">{m.text}</div>
                </div>
              ))}
            </div>
            <div className="composer">
              <span className="prompt">{">>>"}</span>
              <input
                ref={inputRef}
                aria-label="telega-message-input"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message (local echo — not sent anywhere)"
                value={draft}
              />
            </div>
          </>
        ) : (
          <div className="empty">Select a chat</div>
        )}
      </div>
    </StyledChatPanel>
  );
};

export default memo(Telega);
