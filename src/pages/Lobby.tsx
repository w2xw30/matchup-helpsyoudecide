import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock, Copy, Crown, ListChecks, Lock, PlusCircle, QrCode, Settings2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { KIND_META, LOBBY_KINDS } from "../lib/catalog";
import { isAdmin, isMember, myRole, roleLabel } from "../lib/perms";
import { useSimulatedJoins } from "../lib/hooks";
import { useStore } from "../store/useStore";
import type { Member } from "../data/mock";
import { Avatar, Button, ConfirmCard } from "../components/ui/ui";
import { inviteDisplay, inviteUrl } from "../lib/url";
import { InviteModal, LobbySettingsModal, MembersModal } from "../components/lobby/Modals";

const STATUS_TEXT = { ready: "READY", adding: "ADDING OPTIONS...", thinking: "THINKING" } as const;
const REPLIES = ["Nice, count me in!", "Ooh good call.", "Give me one sec, almost ready.", "Voting soon 👀", "Ha, same."];

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

function MemberCard({ m, ready, avatar }: { m: Member; ready: boolean; avatar?: string }) {
  const you = m.id === "you";
  const state = ready ? "ready" : m.status === "ready" ? "thinking" : m.status;
  const ring = state === "ready" ? "var(--crimson)" : state === "adding" ? "#e6cf6b" : "#c8c6d0";
  const dot = state === "ready" ? "ready" : state === "adding" ? "away" : "offline";
  return (
    <div className="member-card">
      <Avatar src={you ? avatar : m.avatar} name={you ? "You" : m.name} size={48} status={dot} ring={ring} />
      <div className="mc-text">
        <strong>
          {m.name}
          {you && m.name !== "You" && <span className="you-tag"> (you)</span>}
          {m.role === "owner" && <Crown size={12} className="role-icon" aria-label="Owner" />}
          {m.role === "admin" && <ShieldCheck size={12} className="role-icon" aria-label="Admin" />}
        </strong>
        <small className={`st-${state}`}>{STATUS_TEXT[state]}</small>
      </div>
    </div>
  );
}

export function LobbyPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const lobby = useStore((s) => s.lobbies[id]);
  const user = useStore((s) => s.user);
  const toggleReady = useStore((s) => s.toggleReady);
  const setMemberStatus = useStore((s) => s.setMemberStatus);
  const sendChat = useStore((s) => s.sendChat);
  const leave = useStore((s) => s.leaveLobby);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState("");
  const [members, setMembers] = useState(false);
  const [settings, setSettings] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const inviteOpen = params.get("invite") === "1";
  const setInviteOpen = (v: boolean) => setParams(v ? { invite: "1" } : {}, { replace: true });

  useSimulatedJoins(lobby);

  const total = lobby?.members.length ?? 0;
  const readyCount = lobby?.ready.length ?? 0;
  const allReady = total > 0 && readyCount >= total;

  // Friends lock in one by one while the user is in the lobby (prototype simulation).
  useEffect(() => {
    if (!lobby || allReady) return;
    const next = lobby.members.find((m) => m.id !== "you" && !lobby.ready.includes(m.id));
    if (!next) return;
    const t = setTimeout(() => setMemberStatus(id, next.id, true), 6000);
    return () => clearTimeout(t);
  }, [lobby, allReady, id, setMemberStatus]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lobby?.chat.length]);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;

  const admin = isAdmin(lobby);
  const role = myRole(lobby)!;
  const url = inviteUrl(lobby);
  const canStart = lobby.items.length >= 2;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
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
    const other = lobby.members.find((m) => m.id !== "you");
    if (other) {
      setTimeout(() => sendChat(id, REPLIES[Math.floor(Math.random() * REPLIES.length)], other.name, false), 1400);
    }
  };

  const youReady = lobby.ready.includes("you");
  const remaining = total - readyCount;
  const kindLabel = lobby.kind === "mixed" ? "Anything goes" : KIND_META[lobby.kind].label;

  return (
    <div className="lobby-wrap">
      <header className="lobby-top">
        <div className="lobby-title">
          <span className="emoji-big lg" aria-hidden>
            {lobby.emoji}
          </span>
          <div>
            <span className="eyebrow crimson">
              {roleLabel(role)} · {kindLabel}
            </span>
            <h1>{lobby.name}</h1>
            {lobby.description && <p>{lobby.description}</p>}
          </div>
        </div>
        <div className="lobby-tools">
          <Button size="sm" pill onClick={() => setInviteOpen(true)}>
            <QrCode size={15} /> Invite
          </Button>
          <Button size="sm" pill variant="soft" onClick={() => setMembers(true)}>
            <Users size={15} /> Members ({lobby.members.length})
          </Button>
          <Button size="sm" pill variant="soft" onClick={() => nav(`/lobby/${lobby.id}/customize`)}>
            <ListChecks size={15} /> Options ({lobby.items.length})
          </Button>
          {admin && (
            <Button size="sm" pill variant="soft" onClick={() => setSettings(true)} aria-label="Lobby settings">
              <Settings2 size={15} /> Settings
            </Button>
          )}
        </div>
      </header>

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
              {!canStart
                ? "Add at least 2 options so everyone has something to vote on."
                : allReady
                  ? total === 1
                    ? "You're all set. Invite friends or start voting on your own."
                    : "Everyone's locked in. Time to find your match!"
                  : total === 1
                    ? "It's just you so far. Invite friends, or tap ready to vote solo."
                    : remaining === 1
                    ? "Almost there! Just waiting for 1 more friend to lock in."
                    : `Almost there! Just waiting for ${remaining} more friends to lock in.`}
            </p>
            {!canStart ? (
              <Button size="lg" onClick={() => nav(`/lobby/${lobby.id}/customize`)}>
                <PlusCircle size={16} /> Add options
              </Button>
            ) : allReady ? (
              <Button size="lg" onClick={() => nav(`/session/${lobby.id}/vote`)}>
                Start Voting <ArrowRight size={16} />
              </Button>
            ) : (
              <Button size="lg" variant={youReady ? "primary" : "outline"} onClick={() => toggleReady(lobby.id)} aria-pressed={youReady}>
                {youReady ? "Ready" : "I'm Ready"}
              </Button>
            )}
            {canStart && allReady && (
              <button type="button" className="link-inline" onClick={() => toggleReady(lobby.id)}>
                Not ready yet
              </button>
            )}
            {canStart && !allReady && admin && (
              <button type="button" className="link-inline" onClick={() => nav(`/session/${lobby.id}/vote`)}>
                Start voting anyway
              </button>
            )}
          </section>

          <section className="card session-details">
            <div className="sd-head">
              <span className="eyebrow muted">Session Details</span>
              <span className={`pill ${lobby.locked ? "pill-gray" : "pill-yellow"}`}>{lobby.locked ? "LOCKED" : "LIVE"}</span>
            </div>
            <div className="sd-row">
              <span className="sd-icon lav" aria-hidden>
                <span className="sd-emoji">{lobby.emoji}</span>
              </span>
              <div>
                <small>CATEGORY</small>
                <strong>{LOBBY_KINDS.find((k) => k.id === lobby.kind)?.label ?? "Anything"}</strong>
              </div>
            </div>
            <Link to={`/lobby/${lobby.id}/customize`} className="sd-row sd-link">
              <span className="sd-icon yellow">
                <ListChecks size={18} />
              </span>
              <div>
                <small>OPTIONS ADDED</small>
                <strong>
                  {lobby.items.length} {lobby.items.length === 1 ? "Option" : "Options"}
                </strong>
              </div>
            </Link>
            <div className="sd-row">
              <span className="sd-icon lav">
                <Clock size={18} />
              </span>
              <div>
                <small>VOTING CLOSES</small>
                <strong>
                  {to12h(lobby.deadline)} · {lobby.requiredMatch}% match
                </strong>
              </div>
            </div>
            <div className="sd-row">
              <span className="sd-icon lav">
                <Lock size={18} />
              </span>
              <div>
                <small>ACCESS</small>
                <strong>{lobby.linkAccess ? "Link & code" : "Closed to new joins"}</strong>
              </div>
            </div>
            {role !== "owner" && (
              <button type="button" className="link-inline leave-link" onClick={() => setLeaving(true)}>
                Leave lobby
              </button>
            )}
          </section>
        </div>

        <div className="lobby-right">
          <div className="section-head">
            <h2>The Squad</h2>
            <button type="button" className="invite-more" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} /> Invite More Friends
            </button>
          </div>
          <div className="squad-grid">
            {lobby.members.map((m) => (
              <MemberCard key={m.id} m={m} ready={lobby.ready.includes(m.id)} avatar={user?.avatar} />
            ))}
            {lobby.invites.map((i) => (
              <div key={i.id} className="member-card pending">
                <Avatar name={i.to} size={48} />
                <div className="mc-text">
                  <strong>{i.to}</strong>
                  <small className="st-thinking">INVITED · PENDING</small>
                </div>
              </div>
            ))}
            {lobby.members.length + lobby.invites.length < lobby.maxMembers && (
              <button type="button" className="member-card invite-tile" onClick={() => setInviteOpen(true)}>
                <span className="plus-circle">
                  <UserPlus size={18} />
                </span>
                Invite more friends
              </button>
            )}
          </div>

          <section className="card chat">
            <h3>Lobby Chat</h3>
            <div className="chat-log" role="log" aria-live="polite">
              {lobby.chat.length === 0 && <p className="muted">No messages yet — say hi 👋</p>}
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
            <span>{inviteDisplay(lobby)}</span>
            <button type="button" className="btn btn-coral btn-sm btn-pill" onClick={copy}>
              <Copy size={14} /> Copy Link
            </button>
          </div>
        </section>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} lobby={lobby} />
      <MembersModal open={members} onClose={() => setMembers(false)} lobby={lobby} userAvatar={user?.avatar} />
      {admin && <LobbySettingsModal open={settings} onClose={() => setSettings(false)} lobby={lobby} />}
      <ConfirmCard
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Leave this lobby?"
        text="You'll need a new invite to come back."
        confirmLabel="Leave"
        onConfirm={() => {
          setLeaving(false);
          nav("/groups");
          leave(lobby.id);
          toast("You left the lobby", "info");
        }}
      />
    </div>
  );
}

