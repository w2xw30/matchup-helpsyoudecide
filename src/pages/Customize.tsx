import { useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Film, Gamepad2, Lightbulb, Lock, Pencil, PlusCircle, Settings2, Trash2, Utensils } from "lucide-react";
import { KIND_META } from "../lib/catalog";
import { canAddItems, canEditItem, isAdmin, isMember } from "../lib/perms";
import { useSimulatedJoins } from "../lib/hooks";
import { quickTemplates, type LobbyItem } from "../data/mock";
import { useStore } from "../store/useStore";
import { Avatar, Button, Toggle } from "../components/ui/ui";
import { Composer, ItemEditor } from "../components/lobby/Composer";
import { InviteModal } from "../components/lobby/Modals";
import { ItemThumb } from "../components/lobby/visual";

const TPL_ICON = { food: Utensils, movie: Film, game: Gamepad2 } as const;
const TPL_TONE = { food: "pink", movie: "yellow", game: "lavender" } as const;
const MATCH_STEPS: (50 | 75 | 100)[] = [50, 75, 100];

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export function Customize() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobbies[id]);
  const user = useStore((s) => s.user);
  const addItems = useStore((s) => s.addItems);
  const removeItem = useStore((s) => s.removeItem);
  const updateLobby = useStore((s) => s.updateLobby);
  const toast = useStore((s) => s.toast);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<LobbyItem | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  useSimulatedJoins(lobby);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;

  const admin = isAdmin(lobby);
  const canAdd = canAddItems(lobby);
  const items = [...lobby.items].sort((a, b) => a.addedAt - b.addedAt);
  const shown = showAll ? items : items.slice(0, 4);
  const tally = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
  const topKind = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof KIND_META | undefined;

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composerRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  };

  return (
    <div className="customize">
      <div className="cz-main">
        <div className="cz-title">
          <Link to={`/lobby/${id}`} className="back-link">
            <ArrowLeft size={15} /> Back to lobby
          </Link>
          <span className="eyebrow crimson line">Active Lobby</span>
          <h1>
            <span className="h1-emoji" aria-hidden>
              {lobby.emoji}
            </span>
            {lobby.name}
          </h1>
          <p>{lobby.description || "Collaborate with your group to build the perfect evening. Add your favorites or pick from the templates below."}</p>
        </div>

        <h2 className="cz-h">Quick Templates</h2>
        <div className="qt-grid">
          {quickTemplates.map((t) => {
            const Icon = TPL_ICON[t.id as keyof typeof TPL_ICON];
            return (
              <button
                key={t.id}
                type="button"
                disabled={!canAdd}
                className={`qt-card qt-${TPL_TONE[t.id as keyof typeof TPL_TONE]}`}
                onClick={() => {
                  const n = addItems(id, t.items, t.kind);
                  setShowAll(true);
                  toast(n ? `${n} ${t.label.toLowerCase()} ideas added` : `Already added all ${t.label.toLowerCase()} ideas`, n ? "success" : "info");
                }}
              >
                <span className="qt-blob" />
                <Icon size={24} className="qt-icon" />
                <strong>{t.label}</strong>
                <small>{t.sub}</small>
              </button>
            );
          })}
        </div>

        <div className="custom-add" ref={composerRef}>
          {canAdd ? (
            <Composer lobby={lobby} onAdded={() => setShowAll(true)} />
          ) : (
            <div className="locked-note">
              <Lock size={18} />
              <div>
                <strong>{lobby.locked ? "This lobby is locked" : "Only admins can add options here"}</strong>
                <p>{lobby.locked ? "Options are frozen — head to the lobby to vote." : "Ask an admin to allow members to add options."}</p>
              </div>
            </div>
          )}
        </div>

        <div className="contrib-head">
          <h2 className="cz-h">Lobby Contributions</h2>
          <span className="pill pill-lav">
            {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
          </span>
          {items.length > 4 && (
            <button type="button" className="link-crimson" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show Less" : "View All"}
            </button>
          )}
        </div>
        <div className="contrib-grid">
          {canAdd && (
            <button type="button" className="add-new" onClick={focusComposer}>
              <PlusCircle size={18} /> Add New Option
            </button>
          )}
          {shown.map((it, idx) => (
            <div key={it.id} className={`contrib ${idx === 1 ? "accented" : ""}`}>
              <ItemThumb item={it} size={40} />
              <div className="c-text">
                <strong>{it.title}</strong>
                <small>
                  added by <em>{it.byId === "you" ? "you" : it.by}</em>
                  {it.note ? ` · ${it.note}` : ""}
                </small>
              </div>
              {canEditItem(lobby, it) && (
                <span className="c-actions">
                  <button type="button" aria-label={`Edit ${it.title}`} onClick={() => setEditing(it)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="danger" aria-label={`Remove ${it.title}`} onClick={() => (removeItem(id, it.id), toast(`"${it.title}" removed`, "info"))}>
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="muted empty-line">No options yet. Add a few above and your friends can start voting.</p>}
      </div>

      <aside className="cz-side">
        <div className="live-head">
          <h2>Live Lobby</h2>
          <span className="live-dot" aria-label="Live" />
        </div>
        <ul className="live-list">
          {lobby.members.map((m) => {
            const you = m.id === "you";
            const ready = lobby.ready.includes(m.id);
            const note = ready ? "Ready to vote" : m.status === "adding" ? "Adding options..." : "Browsing options";
            return (
              <li key={m.id}>
                <Avatar src={you ? user?.avatar : m.avatar} name={you ? user?.name : (m.fullName ?? m.name)} size={36} status={ready || m.status === "adding" ? "online" : "offline"} />
                <div>
                  <strong>{you ? (m.name === "You" ? (user?.name ?? "You") : `${m.name} (you)`) : (m.fullName ?? m.name)}</strong>
                  <small className={note.startsWith("Adding") ? "crimson" : ""}>{note}</small>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="live-actions">
          <Button block size="lg" onClick={() => nav(`/lobby/${id}`)}>
            Ready to Vote <ArrowRight size={14} />
          </Button>
          <Button block size="lg" variant="soft" onClick={() => setInviteOpen(true)}>
            Invite More Friends
          </Button>
        </div>

        <div className="controls">
          <span className="eyebrow crimson controls-title">
            <Settings2 size={12} /> Lobby Controls
          </span>
          <div className="control-row">
            <span>Voting Deadline</span>
            {admin ? (
              <>
                <button type="button" className="ctl-pill red" onClick={() => (timeRef.current?.showPicker ? timeRef.current.showPicker() : timeRef.current?.focus())}>
                  {to12h(lobby.deadline)}
                </button>
                <input ref={timeRef} type="time" className="sr-only" aria-label="Voting deadline" value={lobby.deadline} onChange={(e) => e.target.value && updateLobby(id, { deadline: e.target.value })} />
              </>
            ) : (
              <span className="ctl-pill red static">{to12h(lobby.deadline)}</span>
            )}
          </div>
          <div className="control-row">
            <span>Required Matches</span>
            {admin ? (
              <button
                type="button"
                className="ctl-pill lav"
                onClick={() => updateLobby(id, { requiredMatch: MATCH_STEPS[(MATCH_STEPS.indexOf(lobby.requiredMatch) + 1) % MATCH_STEPS.length] })}
                aria-label={`Required matches ${lobby.requiredMatch}%. Click to change`}
              >
                {lobby.requiredMatch}% Match
              </button>
            ) : (
              <span className="ctl-pill lav static">{lobby.requiredMatch}% Match</span>
            )}
          </div>
          <div className="control-row">
            <span>Allow Friends to Add</span>
            <Toggle checked={lobby.allowFriends} onChange={(v) => admin && updateLobby(id, { allowFriends: v })} label="Allow friends to add" />
          </div>
        </div>

        <div className="insight">
          <strong>
            <Lightbulb size={15} /> Lobby Insight
          </strong>
          {topKind ? (
            <p>
              Most options in this lobby are about <b>{KIND_META[topKind].label.toLowerCase()}</b>
              {items.length > 1 ? ` — ${tally[topKind]} of ${items.length}` : ""}. {lobby.members.length > 1 ? "Looks like the group is in the mood!" : "Invite friends to see what they think."}
            </p>
          ) : (
            <p>Add a few options and we'll tell you what the lobby is in the mood for.</p>
          )}
        </div>
      </aside>

      <ItemEditor lobby={lobby} item={editing} onClose={() => setEditing(null)} />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} lobby={lobby} />
    </div>
  );
}

