import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { LOBBY_KINDS, POPULAR, guessVisual, type LobbyKind } from "../lib/catalog";
import { templates } from "../data/mock";
import { useStore } from "../store/useStore";
import { Button, Toggle } from "../components/ui/ui";

const EMOJIS = ["🎉", "🍕", "🍣", "🌮", "🍔", "☕", "🎬", "🍿", "🎮", "🎲", "🏆", "🥾", "🎤", "🎳", "🏖️", "✨"];
const KIND_EMOJI: Record<LobbyKind, string> = { food: "🍕", movie: "🎬", game: "🎮", activity: "🥾", mixed: "🎉", drink: "☕", dessert: "🍨", place: "📍", other: "✨" };

export function CreateLobby() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const create = useStore((s) => s.createLobby);
  const toast = useStore((s) => s.toast);
  const tpl = templates.find((t) => t.id === params.get("template"));

  const [name, setName] = useState(tpl?.title ?? "");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState<LobbyKind>(tpl?.kind ?? "food");
  const [emoji, setEmoji] = useState(tpl?.emoji ?? "🍕");
  const [picks, setPicks] = useState<string[]>(tpl?.items ?? []);
  const [linkAccess, setLinkAccess] = useState(true);
  const [allowFriends, setAllowFriends] = useState(true);
  const [max, setMax] = useState(12);
  const [deadline, setDeadline] = useState("20:00");
  const [req, setReq] = useState<50 | 75 | 100>(75);
  const [error, setError] = useState("");
  const [emojiTouched, setEmojiTouched] = useState(!!tpl);

  const pickKind = (k: LobbyKind) => {
    setKind(k);
    if (!emojiTouched) setEmoji(KIND_EMOJI[k]);
  };

  const suggestions = Array.from(new Set([...POPULAR[kind], ...picks])).slice(0, 12);
  const toggle = (t: string) => setPicks((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 3) {
      setError("Give your lobby a title (3+ characters).");
      document.getElementById("lobby-title")?.focus();
      return;
    }
    const id = create({ name: n, description: desc, kind, emoji, linkAccess, allowFriends, maxMembers: max, deadline, requiredMatch: req, itemTitles: picks });
    toast(`"${n}" is live — invite your friends!`);
    nav(`/lobby/${id}?invite=1`);
  };

  return (
    <div className="create-page">
      <Link to="/groups" className="back-link">
        <ArrowLeft size={15} /> Groups
      </Link>
      <div className="page-head col">
        <h1>Create a Lobby</h1>
        <p>Name it, choose what you're deciding on, then bring your friends in.</p>
      </div>

      {!tpl && (
        <div className="tpl-strip" aria-label="Start from a template">
          <span>Start from:</span>
          {templates.map((t) => (
            <Link key={t.id} to={`/lobby/new?template=${t.id}`} className="pop-chip" replace>
              <span aria-hidden>{t.emoji}</span> {t.title}
            </Link>
          ))}
        </div>
      )}

      <form className="card create-card" onSubmit={submit} noValidate>
        <section>
          <label className="sheet-label" htmlFor="lobby-title">
            Title
          </label>
          <div className="title-row">
            <span className="emoji-big" aria-hidden>
              {emoji}
            </span>
            <input
              id="lobby-title"
              className={`sheet-input ${error ? "err" : ""}`}
              placeholder="e.g. Friday Night Social"
              value={name}
              onChange={(e) => (setName(e.target.value), setError(""))}
              maxLength={40}
              autoFocus
            />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="emoji-row" role="radiogroup" aria-label="Lobby icon">
            {EMOJIS.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={emoji === e} className={`emoji-opt ${emoji === e ? "on" : ""}`} onClick={() => (setEmoji(e), setEmojiTouched(true))}>
                {e}
              </button>
            ))}
          </div>
          <label className="sheet-label" htmlFor="lobby-desc">
            Description <em>(optional)</em>
          </label>
          <textarea id="lobby-desc" className="sheet-input" rows={2} placeholder="What's the plan? Set the vibe for your group." value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
        </section>

        <section>
          <span className="sheet-label">What are you deciding?</span>
          <div className="kind-cards" role="radiogroup" aria-label="Lobby type">
            {LOBBY_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`kind-card ${kind === k.id ? "on" : ""}`} onClick={() => pickKind(k.id)}>
                <span className="kc-emoji" aria-hidden>
                  {k.emoji}
                </span>
                <strong>{k.label}</strong>
                <small>{k.blurb}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <span className="sheet-label">
            Kick off with some options <em>(you can add more, with pictures, next)</em>
          </span>
          <div className="pop-wrap">
            {suggestions.map((t) => {
              const on = picks.includes(t);
              return (
                <button key={t} type="button" className={`pop-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(t)}>
                  <span aria-hidden>{guessVisual(t, kind === "mixed" ? "other" : kind).emoji}</span> {t}
                </button>
              );
            })}
          </div>
        </section>

        <section className="setting-rows">
          <span className="sheet-label">Rules</span>
          <div className="pref">
            <div>
              <strong>Anyone with the link or code can join</strong>
              <small>YOU CAN TURN THIS OFF ANY TIME</small>
            </div>
            <Toggle checked={linkAccess} onChange={setLinkAccess} label="Anyone with the link can join" />
          </div>
          <div className="pref">
            <div>
              <strong>Members can add options</strong>
              <small>ADMINS CAN ALWAYS ADD</small>
            </div>
            <Toggle checked={allowFriends} onChange={setAllowFriends} label="Members can add options" />
          </div>
          <div className="pref">
            <div>
              <strong>Member limit</strong>
              <small>HOW BIG CAN THE GROUP GET</small>
            </div>
            <div className="stepper">
              <button type="button" aria-label="Fewer members" onClick={() => setMax((m) => Math.max(2, m - 1))}>
                −
              </button>
              <output>{max}</output>
              <button type="button" aria-label="More members" onClick={() => setMax((m) => Math.min(50, m + 1))}>
                +
              </button>
            </div>
          </div>
          <div className="pref">
            <div>
              <strong>Voting deadline</strong>
              <small>WHEN THE DECISION IS DUE</small>
            </div>
            <input type="time" className="time-input" value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} aria-label="Voting deadline" />
          </div>
          <div className="pref">
            <div>
              <strong>Required match</strong>
              <small>SHARE OF THE GROUP THAT MUST SAY YES</small>
            </div>
            <div className="seg" role="radiogroup" aria-label="Required match">
              {([50, 75, 100] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={req === p} className={req === p ? "on" : ""} onClick={() => setReq(p)}>
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="create-actions">
          <Button variant="soft" size="lg" pill onClick={() => nav(-1)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" pill>
            Create Lobby
          </Button>
        </div>
      </form>
    </div>
  );
}
