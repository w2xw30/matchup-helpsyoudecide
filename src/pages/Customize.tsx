import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clapperboard, Film, Gamepad2, IceCreamCone, Lightbulb, Pizza, PlusCircle, Settings2, Trash2, Utensils } from "lucide-react";
import { quickTemplates, type ItemKind } from "../data/mock";
import { useStore } from "../store/useStore";
import { Avatar, Button, Toggle } from "../components/ui/ui";

const KIND_ICON: Record<ItemKind, { icon: typeof Pizza; tone: string }> = {
  food: { icon: Pizza, tone: "pink" },
  movie: { icon: Clapperboard, tone: "yellow" },
  game: { icon: Gamepad2, tone: "lavender" },
  dessert: { icon: IceCreamCone, tone: "pink" },
  other: { icon: Lightbulb, tone: "lavender" },
};
const TPL_ICON = { food: Utensils, movies: Film, games: Gamepad2 } as const;
const TPL_TONE = { food: "pink", movies: "yellow", games: "lavender" } as const;
const MATCH_STEPS: (50 | 75 | 100)[] = [50, 75, 100];

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export function Customize() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobbies[id]);
  const addItem = useStore((s) => s.addItem);
  const addItems = useStore((s) => s.addItems);
  const removeItem = useStore((s) => s.removeItem);
  const setControl = useStore((s) => s.setControl);
  const toast = useStore((s) => s.toast);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  if (!lobby) return <Navigate to="/groups" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!addItem(id, text)) {
      input.current?.focus();
      return;
    }
    toast(`"${text.trim()}" added to the lobby`);
    setText("");
  };

  const shown = showAll ? lobby.items : lobby.items.slice(0, 4);
  const tally = lobby.items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
  const topKind = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const insight =
    topKind === "movie" ? "Movies" : topKind === "game" ? "Games" : topKind === "dessert" ? "Desserts" : topKind === "other" ? "New ideas" : "Italian";

  return (
    <div className="customize">
      <div className="cz-main">
        <div className="cz-title">
          <span className="eyebrow crimson line">Active Lobby</span>
          <h1>{lobby.name}</h1>
          <p>{lobby.description}</p>
        </div>

        <h2 className="cz-h">Quick Templates</h2>
        <div className="qt-grid">
          {quickTemplates.map((t) => {
            const Icon = TPL_ICON[t.id as keyof typeof TPL_ICON];
            return (
              <button
                key={t.id}
                type="button"
                className={`qt-card qt-${TPL_TONE[t.id as keyof typeof TPL_TONE]}`}
                onClick={() => {
                  const n = addItems(id, t.items, t.kind);
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

        <form className="custom-add" onSubmit={submit}>
          <h3>Add Custom Item</h3>
          <div className="custom-row">
            <input ref={input} placeholder="What should we do tonight?" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} aria-label="Custom item" />
            <Button type="submit" pill>
              Add to Lobby
            </Button>
          </div>
        </form>

        <div className="contrib-head">
          <h2 className="cz-h">Lobby Contributions</h2>
          <span className="pill pill-lav">{lobby.items.length} ITEMS</span>
          <button type="button" className="link-crimson" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show Less" : "View All"}
          </button>
        </div>
        <div className="contrib-grid">
          <button type="button" className="add-new" onClick={() => input.current?.focus()}>
            <PlusCircle size={18} /> Add New Option
          </button>
          {shown.map((it, idx) => {
            const { icon: Icon, tone } = KIND_ICON[it.kind];
            return (
              <div key={it.id} className={`contrib ${idx === 1 ? "accented" : ""}`}>
                <span className={`c-icon ${tone}`}>
                  <Icon size={16} />
                </span>
                <div className="c-text">
                  <strong>{it.title}</strong>
                  <small>
                    added by <em>{it.by}</em>
                  </small>
                </div>
                {it.mine && (
                  <button type="button" className="c-remove" aria-label={`Remove ${it.title}`} onClick={() => removeItem(id, it.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="cz-side">
        <div className="live-head">
          <h2>Live Lobby</h2>
          <span className="live-dot" aria-label="Live" />
        </div>
        <ul className="live-list">
          {lobby.presence.map((p) => (
            <li key={p.id}>
              <Avatar src={p.avatar} name={p.name} size={36} status={p.online ? "online" : "offline"} />
              <div>
                <strong>{p.name}</strong>
                <small className={p.note.startsWith("Adding") ? "crimson" : ""}>{p.note}</small>
              </div>
            </li>
          ))}
        </ul>
        <div className="live-actions">
          <Button block size="lg" onClick={() => nav(`/lobby/${id}`)}>
            Ready to Vote <ArrowRight size={14} />
          </Button>
          <Button
            block
            size="lg"
            variant="soft"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`https://matchup.app/lobby/${id}`);
              } catch {
                /* ignore */
              }
              toast("Link copied to clipboard!");
            }}
          >
            Invite More Friends
          </Button>
        </div>

        <div className="controls">
          <span className="eyebrow crimson controls-title">
            <Settings2 size={12} /> Lobby Controls
          </span>
          <div className="control-row">
            <span>Voting Deadline</span>
            <button type="button" className="ctl-pill red" onClick={() => (timeRef.current?.showPicker ? timeRef.current.showPicker() : timeRef.current?.focus())}>
              {to12h(lobby.deadline)}
            </button>
            <input ref={timeRef} type="time" className="sr-only" aria-label="Voting deadline" value={lobby.deadline} onChange={(e) => e.target.value && setControl(id, { deadline: e.target.value })} />
          </div>
          <div className="control-row">
            <span>Required Matches</span>
            <button
              type="button"
              className="ctl-pill lav"
              onClick={() => setControl(id, { requiredMatch: MATCH_STEPS[(MATCH_STEPS.indexOf(lobby.requiredMatch) + 1) % MATCH_STEPS.length] })}
              aria-label={`Required matches ${lobby.requiredMatch}%. Click to change`}
            >
              {lobby.requiredMatch}% Match
            </button>
          </div>
          <div className="control-row">
            <span>Allow Friends to Add</span>
            <Toggle checked={lobby.allowFriends} onChange={(v) => setControl(id, { allowFriends: v })} label="Allow friends to add" />
          </div>
        </div>

        <div className="insight">
          <strong>
            <Lightbulb size={15} /> Lobby Insight
          </strong>
          <p>
            Most people in this lobby seem to be in the mood for <b>{insight}</b> tonight!
          </p>
        </div>
      </aside>
    </div>
  );
}
