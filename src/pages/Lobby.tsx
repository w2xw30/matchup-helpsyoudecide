import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Copy, ListChecks, Plus, UserPlus, Utensils } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Member } from "../data/mock";
import { Avatar, Button } from "../components/ui/ui";

const STATUS_TEXT = { ready: "READY", adding: "ADDING OPTIONS...", thinking: "THINKING" } as const;

const REPLIES = ["Nice, count me in!", "Ooh good call.", "Give me one sec, almost ready.", "Voting soon 👀", "Ha, same."];

function MemberCard({ m, ready, mine, avatar }: { m: Member; ready: boolean; mine: boolean; avatar?: string }) {
  const state = ready ? "ready" : m.status === "ready" ? "thinking" : m.status;
  const ring = state === "ready" ? "var(--crimson)" : state === "adding" ? "#e6cf6b" : "#c8c6d0";
  const dot = state === "ready" ? "ready" : state === "adding" ? "away" : "offline";
  return (
    <div className="member-card">
      <Avatar src={mine ? avatar : m.avatar} name={mine ? "You" : m.name} size={48} status={dot} ring={ring} />
      <div>
        <strong>{m.name}</strong>
        <small className={`st-${state}`}>{STATUS_TEXT[state]}</small>
      </div>
    </div>
  );
}

export function LobbyPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobbies[id]);
  const user = useStore((s) => s.user);
  const toggleReady = useStore((s) => s.toggleReady);
  const setMemberStatus = useStore((s) => s.setMemberStatus);
  const sendChat = useStore((s) => s.sendChat);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  const total = lobby?.squad.length ?? 0;
  const readyCount = lobby?.ready.length ?? 0;
  const allReady = total > 0 && readyCount >= total;

  // Friends lock in one by one while the user is in the lobby.
  useEffect(() => {
    if (!lobby || allReady) return;
    const next = lobby.squad.find((m) => m.id !== "you" && !lobby.ready.includes(m.id));
    if (!next) return;
    const t = setTimeout(() => setMemberStatus(id, next.id, true), 6000);
    return () => clearTimeout(t);
  }, [lobby, allReady, id, setMemberStatus]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lobby?.chat.length]);

  if (!lobby) return <Navigate to="/groups" replace />;

  const link = `matchup.app/lobby/${lobby.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
    } catch {
      /* clipboard may be blocked; still confirm */
    }
    toast("Link copied to clipboard!");
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendChat(id, draft);
    setDraft("");
    const who = lobby.squad.find((m) => m.id === "jordan")?.name ?? "Jordan";
    setTimeout(() => {
      useStore.setState((s) => {
        const l = s.lobbies[id];
        if (!l) return s;
        const msg = { id: `c-${Date.now()}`, from: who, text: REPLIES[Math.floor(Math.random() * REPLIES.length)] };
        return { lobbies: { ...s.lobbies, [id]: { ...l, chat: [...l.chat, msg] } } };
      });
    }, 1400);
  };

  const youReady = lobby.ready.includes("you");
  const remaining = total - readyCount;

  return (
    <div className="lobby-page">
      <div className="lobby-left">
        <section className="card readiness">
          <span className="eyebrow muted">Group Readiness</span>
          <div className="ready-count" aria-live="polite">
            <span>
              {readyCount}/{total}
            </span>
            <small>READY</small>
          </div>
          <p>
            {allReady
              ? "Everyone's locked in. Time to find your match!"
              : remaining === 1
                ? "Almost there! Just waiting for 1 more friend to lock in."
                : `Almost there! Just waiting for ${remaining} more friends to lock in.`}
          </p>
          {allReady ? (
            <Button size="lg" onClick={() => nav(`/session/${lobby.id}/vote`)}>
              Start Voting <ArrowRight size={16} />
            </Button>
          ) : (
            <Button size="lg" variant={youReady ? "primary" : "outline"} onClick={() => toggleReady(lobby.id)} aria-pressed={youReady}>
              {youReady ? "Ready" : "I'm Ready"}
            </Button>
          )}
          {allReady && (
            <button type="button" className="link-inline" onClick={() => toggleReady(lobby.id)}>
              Not ready yet
            </button>
          )}
        </section>

        <section className="card session-details">
          <div className="sd-head">
            <span className="eyebrow muted">Session Details</span>
            <span className="pill pill-yellow">LIVE</span>
          </div>
          <div className="sd-row">
            <span className="sd-icon pink">
              <Utensils size={18} />
            </span>
            <div>
              <small>CATEGORY</small>
              <strong>{lobby.category}</strong>
            </div>
          </div>
          <Link to={`/lobby/${lobby.id}/customize`} className="sd-row sd-link">
            <span className="sd-icon yellow">
              <ListChecks size={18} />
            </span>
            <div>
              <small>OPTIONS ADDED</small>
              <strong>{lobby.items.length} Venues</strong>
            </div>
          </Link>
        </section>
      </div>

      <div className="lobby-right">
        <div className="section-head">
          <h2>The Squad</h2>
          <button type="button" className="invite-more" onClick={copy}>
            <UserPlus size={16} /> Invite More Friends
          </button>
        </div>
        <div className="squad-grid">
          {lobby.squad.map((m) => (
            <MemberCard key={m.id} m={m} ready={lobby.ready.includes(m.id)} mine={m.id === "you"} avatar={user?.avatar} />
          ))}
          <button type="button" className="member-card invite-tile" onClick={copy}>
            <span className="plus-circle">
              <Plus size={18} />
            </span>
            Invite more friends
          </button>
        </div>

        <section className="card chat">
          <h3>Lobby Chat</h3>
          <div className="chat-log" role="log" aria-live="polite">
            {lobby.chat.map((c) => (
              <p key={c.id} className={c.mine ? "mine" : ""}>
                <span className={c.mine ? "" : "who"}>{c.from}:</span> {c.text}
              </p>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={send} className="chat-form">
            <input placeholder="Type a message..." value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Message" maxLength={200} />
          </form>
        </section>
      </div>

      <section className="invite-link">
        <h2>Invite via Link</h2>
        <div className="copy-field">
          <span>{link}</span>
          <button type="button" className="btn btn-coral btn-sm btn-pill" onClick={copy}>
            <Copy size={14} /> Copy Link
          </button>
        </div>
      </section>
    </div>
  );
}
