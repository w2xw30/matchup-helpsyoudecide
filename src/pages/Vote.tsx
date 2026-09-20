import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, Info, PartyPopper, PlusCircle, Star, Undo2, X } from "lucide-react";
import { av, type LobbyItem } from "../data/mock";
import { KIND_META } from "../lib/catalog";
import { buildDeck, computeResult } from "../lib/deck";
import { isMember } from "../lib/perms";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, LinkButton, Modal } from "../components/ui/ui";
import { ItemArt, ItemThumb } from "../components/lobby/visual";

export function CardFace({ item, stamp }: { item: LobbyItem; stamp?: "like" | "nope" | null }) {
  const meta = KIND_META[item.kind];
  const byline = item.byId === "you" ? "you" : item.by;
  return (
    <div className="swipe-card">
      <div className="sc-image">
        <ItemArt item={item} />
        <div className="sc-chips">
          {item.rating ? (
            <span className="chip-glass rating">
              <Star size={11} fill="currentColor" /> {item.rating}
            </span>
          ) : (
            <span className="chip-glass">
              <span aria-hidden>{meta.emoji}</span> {meta.label.toUpperCase()}
            </span>
          )}
          <span className="chip-glass">{item.distance ?? `ADDED BY ${byline.toUpperCase()}`}</span>
        </div>
        {stamp && <span className={`stamp stamp-${stamp}`}>{stamp === "like" ? "MATCH" : "NOPE"}</span>}
      </div>
      <div className="sc-body">
        <div className="sc-title">
          <h2>{item.title}</h2>
          {item.price && <span className="price">{item.price}</span>}
        </div>
        <p>{item.note ?? `A ${meta.label.toLowerCase().replace(/s$/, "")} pick added by ${byline}. Swipe right if you're in.`}</p>
        <div className="tags">
          <span className="tag">{meta.label.toUpperCase()}</span>
          <span className="tag">BY {byline.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

const THRESHOLD = 110;

export function Vote() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobbies[id]);
  const vote = useStore((s) => s.votes[id]);
  const castVote = useStore((s) => s.castVote);
  const undoVote = useStore((s) => s.undoVote);
  const resetVotes = useStore((s) => s.resetVotes);

  const deck = useMemo(() => buildDeck(lobby), [lobby]);
  const answers = vote?.answers;
  const index = answers ? deck.filter((c) => answers[c.id]).length : 0;
  const done = deck.length > 0 && index >= deck.length;
  const card = answers ? deck.find((c) => !answers[c.id]) : deck[0];
  const next = deck.find((c) => c !== card && !(answers && answers[c.id]));

  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<"like" | "nope" | null>(null);
  const [info, setInfo] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(-1);
  const celebrate = done && dismissedAt !== index;
  const setCelebrate = (open: boolean) => setDismissedAt(open ? -1 : index);
  const start = useRef(0);
  const busy = useRef(false);

  const commit = useCallback(
    (choice: "like" | "nope") => {
      if (!card || busy.current) return;
      busy.current = true;
      setDragging(false);
      setExit(choice);
      setTimeout(() => {
        castVote(id, card.id, choice);
        setExit(null);
        setDx(0);
        busy.current = false;
      }, 260);
    },
    [card, castVote, id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (info || celebrate) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") commit("like");
      else if (e.key === "ArrowLeft") commit("nope");
      else if ((e.key === "z" || e.key === "Z") && !busy.current) undoVote(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undoVote, id, info, celebrate]);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;

  if (deck.length < 2) {
    return (
      <div className="vote-empty">
        <span className="emoji-big lg" aria-hidden>
          {lobby.emoji}
        </span>
        <h1>Not enough options yet</h1>
        <p>Add at least two options to “{lobby.name}” so there's something to vote on.</p>
        <LinkButton to={`/lobby/${id}/customize`} pill size="lg">
          <PlusCircle size={16} /> Add options
        </LinkButton>
      </div>
    );
  }

  const dir = exit ?? (dx > 40 ? "like" : dx < -40 ? "nope" : null);
  const x = exit === "like" ? 520 : exit === "nope" ? -520 : dx;
  const cardStyle = {
    transform: `translateX(${x}px) rotate(${x / 22}deg)`,
    transition: dragging ? "none" : "transform 0.26s ease, opacity 0.26s ease",
    opacity: exit ? 0 : 1,
  };

  const voters = lobby.members.length;
  const others = lobby.members.filter((m) => m.avatar).slice(0, 4);

  return (
    <div className="vote-page">
      {!done && card ? (
        <>
          <p className="vote-progress" aria-live="polite">
            <span>{index + 1}</span> of {deck.length}
            <span className="dots" aria-hidden>
              {deck.slice(0, 14).map((c) => (
                <i key={c.id} className={answers?.[c.id] ? "done" : c === card ? "now" : ""} />
              ))}
            </span>
          </p>
          <div className="deck">
            {next && (
              <div className="deck-under" aria-hidden>
                <CardFace item={next} />
              </div>
            )}
            <div
              className="deck-top"
              style={cardStyle}
              onPointerDown={(e) => {
                if (busy.current) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                start.current = e.clientX - dx;
                setDragging(true);
              }}
              onPointerMove={(e) => dragging && setDx(e.clientX - start.current)}
              onPointerUp={() => {
                if (!dragging) return;
                if (dx > THRESHOLD) commit("like");
                else if (dx < -THRESHOLD) commit("nope");
                else {
                  setDragging(false);
                  setDx(0);
                }
              }}
              onPointerCancel={() => {
                setDragging(false);
                setDx(0);
              }}
            >
              <CardFace item={card} stamp={dir} />
            </div>
          </div>
          <div className="vote-controls">
            <button type="button" className="vc vc-sm" aria-label="Undo last vote (Z)" onClick={() => undoVote(id)} disabled={index === 0}>
              <Undo2 size={16} />
            </button>
            <button type="button" className="vc vc-no" aria-label="Pass (Left arrow)" onClick={() => commit("nope")}>
              <X size={34} strokeWidth={1.6} />
            </button>
            <button type="button" className="vc vc-yes" aria-label="Match (Right arrow)" onClick={() => commit("like")}>
              <Check size={34} strokeWidth={1.8} />
            </button>
            <button type="button" className="vc vc-sm" aria-label="More info" onClick={() => setInfo(true)}>
              <Info size={16} />
            </button>
          </div>
        </>
      ) : (
        <div className="vote-done">
          <p className="eyebrow muted">You've voted on all {deck.length} options</p>
          <div className="vote-done-actions">
            <Button onClick={() => setCelebrate(true)}>See results</Button>
            <Button variant="soft" onClick={() => resetVotes(id)}>
              Vote again
            </Button>
          </div>
        </div>
      )}

      <Modal open={info} onClose={() => setInfo(false)} label="Option details">
        {card && (
          <div className="info-card">
            <button type="button" className="modal-x" onClick={() => setInfo(false)} aria-label="Close">
              <X size={16} />
            </button>
            <div className="info-head">
              <ItemThumb item={card} size={56} round={false} />
              <h3>{card.title}</h3>
            </div>
            <dl>
              <div><dt>Category</dt><dd>{KIND_META[card.kind].label}</dd></div>
              <div><dt>Added by</dt><dd>{card.byId === "you" ? "You" : card.by}</dd></div>
              {card.rating && <div><dt>Rating</dt><dd>★ {card.rating}</dd></div>}
              {card.distance && <div><dt>Distance</dt><dd>{card.distance.toLowerCase()}</dd></div>}
              {card.price && <div><dt>Price</dt><dd>{card.price}</dd></div>}
            </dl>
            {card.note && <p>{card.note}</p>}
            <Button block onClick={() => setInfo(false)} data-autofocus>
              Got it
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={celebrate} onClose={() => setCelebrate(false)} label="Everyone has voted">
        <div className="celebrate">
          <span className="cel-icon">
            <span className="pulse" />
            <PartyPopper size={34} />
          </span>
          <h3>Everyone has voted!</h3>
          <p>The numbers are in. Ready to see which option came out on top?</p>
          <Button size="lg" pill onClick={() => nav(`/session/${id}/result`)} data-autofocus>
            Reveal the Match
          </Button>
          <div className="cel-people">
            <AvatarStack avatars={others.length ? others.map((m) => m.avatar!) : [av(2)]} size={26} />
            <small>
              All {voters} group {voters === 1 ? "member" : "members"} voted
            </small>
          </div>
          <Link to={`/lobby/${id}`} className="link-inline" onClick={() => setCelebrate(false)}>
            Back to lobby
          </Link>
        </div>
      </Modal>
    </div>
  );
}

export function Result() {
  const { id = "" } = useParams();
  const lobby = useStore((s) => s.lobbies[id]);
  const vote = useStore((s) => s.votes[id]);
  const resetVotes = useStore((s) => s.resetVotes);
  const nav = useNavigate();
  const deck = useMemo(() => buildDeck(lobby), [lobby]);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;
  const answered = vote ? deck.filter((c) => vote.answers[c.id]).length : 0;
  if (!vote || deck.length < 2 || answered < deck.length) return <Navigate to={`/session/${id}/vote`} replace />;

  const r = computeResult(deck, vote.answers, lobby.members, lobby.requiredMatch);
  if (!r.winner) return <Navigate to={`/session/${id}/vote`} replace />;
  const youLiked = vote.answers[r.winner.id] === "like";

  return (
    <div className="result">
      <span className={`pill pill-lg ${r.matched ? "pill-yellow" : "pill-gray"}`}>
        <PartyPopper size={15} /> {r.unanimous ? "IT'S A UNANIMOUS MATCH!" : r.matched ? "THE GROUP HAS A MATCH!" : "NO FULL MATCH — CLOSEST PICK"}
      </span>
      <h1>{r.matched ? "The Group Has Spoken" : "Closest to a Match"}</h1>
      <div className="result-card">
        <CardFace item={r.winner} />
      </div>
      <p className="result-note">
        {r.likes} of {r.voters} {r.voters === 1 ? "person" : "people"} picked this ({r.pct}%)
        {r.matched ? "" : ` — you needed ${lobby.requiredMatch}%`}
        {youLiked ? "" : " — you passed, but the group leaned in"}.
      </p>

      <section className="ranking card" aria-label="All results">
        <h3>How everyone voted</h3>
        <ol>
          {r.ranked.map(({ item, likes }, i) => (
            <li key={item.id} className={i === 0 ? "top" : ""}>
              <span className="rk-n">{i + 1}</span>
              <ItemThumb item={item} size={34} round={false} />
              <span className="rk-title">{item.title}</span>
              <span className="rk-bar" aria-hidden>
                <i style={{ width: `${(likes / r.voters) * 100}%` }} />
              </span>
              <span className="rk-count">
                {likes}/{r.voters}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="result-actions">
        <Button pill size="lg" onClick={() => nav(`/lobby/${id}`)}>
          Back to Lobby
        </Button>
        <Button
          pill
          size="lg"
          variant="soft"
          onClick={() => {
            resetVotes(id);
            nav(`/session/${id}/vote`);
          }}
        >
          Vote again
        </Button>
      </div>
    </div>
  );
}
