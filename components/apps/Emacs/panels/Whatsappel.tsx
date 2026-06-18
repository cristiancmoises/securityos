import { memo, useRef, useState } from "react";
import { StyledChatPanel } from "components/apps/Emacs/panels/StyledPanels";

/**
 * SIMULATED whatsappel panel — modelled on
 * github.com/cristiancmoises/whatsappel (a WhatsApp-in-Emacs client).
 *
 * THIS IS NOT A REAL WHATSAPP CLIENT. SecurityOS Emacs is offline and
 * self-contained: there is NO network, NO WhatsApp Web bridge, NO phone
 * pairing. The contacts and conversations below are seeded sample data and the
 * composer is local-echo only. The banner makes this explicit to the user.
 */

type Message = {
  from: string;
  text: string;
  time: string;
  me?: boolean;
};

type Contact = {
  id: string;
  name: string;
  status: string;
  unread?: number;
  messages: Message[];
};

const SEED_CONTACTS: Contact[] = [
  {
    id: "alice",
    name: "Alice Roban",
    status: "online",
    unread: 2,
    messages: [
      { from: "Alice", text: "did you push the patch?", time: "10:01" },
      { from: "Alice", text: "review looks good otherwise 👍", time: "10:02" },
    ],
  },
  {
    id: "ops",
    name: "Ops On-Call",
    status: "last seen 12:40",
    messages: [
      { from: "Ops", text: "deploy window opens at 14:00", time: "12:38" },
      { from: "me", text: "copy, standing by from Emacs", time: "12:40", me: true },
    ],
  },
  {
    id: "family",
    name: "Family",
    status: "3 participants",
    unread: 5,
    messages: [
      { from: "Mom", text: "dinner sunday?", time: "18:22" },
      { from: "Sam", text: "I'm in 🍝", time: "18:30" },
      { from: "me", text: "count me in too", time: "18:31", me: true },
    ],
  },
  {
    id: "bob",
    name: "Bob (whatsappel)",
    status: "typing…",
    messages: [
      { from: "Bob", text: "running whatsappel in Emacs is wild", time: "20:11" },
      { from: "me", text: "all simulated here though 🙂", time: "20:12", me: true },
    ],
  },
];

const Whatsappel: FC = () => {
  const [contacts, setContacts] = useState<Contact[]>(SEED_CONTACTS);
  const [activeId, setActiveId] = useState<string>(SEED_CONTACTS[0].id);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const active = contacts.find((c) => c.id === activeId);

  const send = (): void => {
    const body = draft.trim();

    if (!body || !active) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    setContacts((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, messages: [...c.messages, { from: "me", text: body, time, me: true }] }
          : c
      )
    );
    setDraft("");
  };

  return (
    <StyledChatPanel>
      <div className="sim-banner">
        SIMULATED whatsappel — offline demo, no WhatsApp connection
      </div>
      <div className="roster">
        <div className="roster-head">whatsappel — Contacts</div>
        {contacts.map((c) => {
          const last = c.messages[c.messages.length - 1];

          return (
            <button
              key={c.id}
              className={`roster-item${c.id === activeId ? " active" : ""}`}
              onClick={() => {
                setActiveId(c.id);
                setContacts((prev) =>
                  prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))
                );
              }}
              type="button"
            >
              {c.unread ? <span className="badge">{c.unread}</span> : null}
              <span className="who">{c.name}</span>
              <span className="preview">{last ? last.text : c.status}</span>
            </button>
          );
        })}
      </div>
      <div className="convo">
        {active ? (
          <>
            <div className="convo-head">
              <span className="title">{active.name}</span>
              <span className="sub">{active.status}</span>
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
              <span className="prompt">{"C-c C-c"}</span>
              <input
                ref={inputRef}
                aria-label="whatsappel-message-input"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message (local echo — not sent anywhere)"
                value={draft}
              />
            </div>
          </>
        ) : (
          <div className="empty">Select a contact</div>
        )}
      </div>
    </StyledChatPanel>
  );
};

export default memo(Whatsappel);
