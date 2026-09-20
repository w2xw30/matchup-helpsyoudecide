import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { LOBBY_KINDS, POPULAR, guessVisual, type LobbyKind } from "../lib/catalog";
import { EMOJIS } from "../lib/emoji";
import { templates } from "../data/mock";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, Toggle } from "../components/ui/ui";

const KIND_EMOJI: Record<LobbyKind, string> = { food: "🍕", movie: "🎬", game: "🎮", activity: "🥾", mixed: "🎉", drink: "☕", dessert: "🍨", place: "📍", other: "✨" };

export function CreateLobby() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const create = useStore((s) => s.createLobby);
  const toast = useStore((s) => s.toast);
  const clans = useStore((s) => s.clans);
  const friends = useStore((s) => s.friends);
  const tpl = templates.find((t) => t.id === params.get("template"));
  const clan = clans.find((c) => c.id === params.get("clan"));
  const clanFriends = clan ? clan.memberIds.map((id) => friends.find((f) => f.id === id && f.status === "friend")).filter((f) => !!f) : [];

  const [name, setName] = useState(clan?.name ?? tpl?.title ?? "");
  const [desc, setDesc] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [kind, setKind] = useState<LobbyKind>(tpl?.kind ?? "food");
  const [emoji, setEmoji] = useState(clan?.emoji ?? tpl?.emoji ?? "🍕");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTouched, setEmojiTouched] = useState(!!(tpl || clan));
  const [picks, setPicks] = useState<string[]>(tpl?.items ?? []);
  const [more, setMore] = useState(false);
  const [linkAccess, setLinkAccess] = useState(true);
  const [allowFriends, setAllowFriends] = useState(true);
  const [max, setMax] = useState(12);
  const [deadline, setDeadline] = useState("20:00");
  const [req, setReq] = useState<50 | 75 | 100>(75);
  const [error, setError] = useState("");

  const pickKind = (k: LobbyKind) => {
    setKind(k);
    if (!emojiTouched) setEmoji(KIND_EMOJI[k]);
  };
  const ideas = Array.from(new Set([...POPULAR[kind].slice(0, 7), ...picks]));
  const toggle = (t: string) => setPicks((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 3) {
      setError("Give your lobby a name (3+ characters).");
      document.getElementById("lobby-title")?.focus();
      return;
    }
    const id = create({
      name: n,
      description: desc,
      kind,
      emoji,
      linkAccess,
      allowFriends,
      maxMembers: Math.max(max, clanFriends.length + 1),
      deadline,
      requiredMatch: req,
      itemTitles: picks,
      invites: clanFriends.map((f) => f.handle),
    });
    toast(clanFriends.length ? `"${n}" is live — invites sent to ${clan?.name}` : `"${n}" is live — invite your friends!`);
    nav(`/lobby/${id}${clanFriends.length ? "" : "?invite=1"}`);
  };

  const summary = `Up to ${max} people · ${req}% match · ${linkAccess ? "link joining on" : "link joining off"}`;

  return (
    <div className="cm">
      <Link to="/groups" className="back-link">
        <ArrowLeft size={15} /> Groups
      </Link>
      <h1>New lobby</h1>

      {clan && clanFriends.length > 0 && (
        <div className="cm-clan">
          <AvatarStack avatars={clanFriends.filter((f) => f.avatar).slice(0, 4).map((f) => f.avatar!)} size={24} />
          Inviting everyone in <strong>{clan.name}</strong> ({clanFriends.length})
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="cm-title">
          <button type="button" className="cm-emoji" onClick={() => setEmojiOpen((o) => !o)} aria-label="Choose an icon" aria-expanded={emojiOpen}>
            {emoji}
          </button>
          <input
            id="lobby-title"
            className={error ? "err" : ""}
            placeholder="Name your lobby"
            value={name}
            onChange={(e) => (setName(e.target.value), setError(""))}
            maxLength={40}
            autoFocus
            aria-label="Lobby name"
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {emojiOpen && (
          <div className="emoji-row cm-emoji-row" role="radiogroup" aria-label="Lobby icon">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                className={`emoji-opt ${emoji === e ? "on" : ""}`}
                onClick={() => (setEmoji(e), setEmojiTouched(true), setEmojiOpen(false))}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {descOpen ? (
          <textarea className="cm-desc" rows={2} placeholder="What's the plan? (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} autoFocus aria-label="Description" />
        ) : (
          <button type="button" className="cm-link" onClick={() => setDescOpen(true)}>
            + Add a description
          </button>
        )}

        <div className="cm-block">
          <span className="cm-label">Deciding on</span>
          <div className="cm-kinds" role="radiogroup" aria-label="Lobby type">
            {LOBBY_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`cm-kind ${kind === k.id ? "on" : ""}`} onClick={() => pickKind(k.id)}>
                <span aria-hidden>{k.emoji}</span> {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-block">
          <span className="cm-label">
            Start with a few ideas <em>optional</em>
          </span>
          <div className="pop-wrap">
            {ideas.map((t) => {
              const on = picks.includes(t);
              return (
                <button key={t} type="button" className={`pop-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(t)}>
                  <span aria-hidden>{guessVisual(t, kind === "mixed" ? "other" : kind).emoji}</span> {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="cm-block">
          <button type="button" className={`cm-more ${more ? "open" : ""}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            <span>
              <strong>Settings</strong>
              <small>{summary}</small>
            </span>
            <ChevronDown size={18} />
          </button>
          {more && (
            <div className="cm-rows">
              <div className="cm-row">
                <span>Anyone with the link or code can join</span>
                <Toggle checked={linkAccess} onChange={setLinkAccess} label="Anyone with the link can join" />
              </div>
              <div className="cm-row">
                <span>Members can add options</span>
                <Toggle checked={allowFriends} onChange={setAllowFriends} label="Members can add options" />
              </div>
              <div className="cm-row">
                <span>Member limit</span>
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
              <div className="cm-row">
                <span>Voting deadline</span>
                <input type="time" className="time-input" value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} aria-label="Voting deadline" />
              </div>
              <div className="cm-row">
                <span>Required match</span>
                <div className="seg" role="radiogroup" aria-label="Required match">
                  {([50, 75, 100] as const).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={req === p} className={req === p ? "on" : ""} onClick={() => setReq(p)}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" size="lg" pill block className="cm-submit">
          Create lobby
        </Button>
      </form>
    </div>
  );
}
