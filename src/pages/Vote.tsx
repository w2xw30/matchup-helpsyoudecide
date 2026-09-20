import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, Gamepad2, Info, PartyPopper, Pizza, Clapperboard, IceCreamCone, Lightbulb, Star, Undo2, X } from "lucide-react";
import type { DeckCard, ItemKind } from "../data/mock";
import { av } from "../data/mock";
import { buildDeck, computeResult } from "../lib/deck";
import { useStore } from "../store/useStore";
import { AvatarStack, Button, Modal } from "../components/ui/ui";

const KIND_ICON: Record<ItemKind, typeof Pizza> = { food: Pizza, movie: Clapperboard, game: Gamepad2, dessert: IceCreamCone, other: Lightbulb };

export function CardFace({ card, stamp }: { card: DeckCard; stamp?: "like" | "nope" | null }) {
  const Icon = KIND_ICON[card.kind];
  return (
    <div className="swipe-card">
      <div className={`sc-image ${card.image ? "" : "sc-art"}`}>
        {card.image ? <img src={card.image} alt={card.title} draggable={false} /> : <Icon size={72} strokeWidth={1.4} />}
        <div className="sc-chips">
          <span className="chip-glass rating">
            <Star size={11} fill="currentColor" /> {card.rating}
          </span>
          <span className="chip-glass">{card.distance}</span>
        </div>
        {stamp && <span className={`stamp stamp-${stamp}`}>{stamp === "like" ? "MATCH" : "NOPE"}</span>}
      </div>
      <div className="sc-body">
        <div className="sc-title">
          <h2>{card.title}</h2>
          <span className="price">{card.price}</span>
        </div>
        <p>{card.desc}</p>
        <div className="tags">
          {card.tags.map((t) => (
            <span key={t} className="tag">
              {t.toUpperCase()}
            </span>
          ))}
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
  const index = vote?.order.length ?? 0;
  const done = index >= deck.length;
  const card = deck[index];
  const next = deck[index + 1];

  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<"like" | "nope" | null>(null);
  const [info, setInfo] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(-1);
  const celebrate = done && dismissedAt !== index && deck.length > 0;
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

  if (!lobby) return <Navigate to="/groups" replace />;

  const dir = exit ?? (dx > 40 ? "like" : dx < -40 ? "nope" : null);
  const x = exit === "like" ? 520 : exit === "nope" ? -520 : dx;
  const cardStyle = {
    transform: `translateX(${x}px) rotate(${x / 22}deg)`,
    transition: dragging ? "none" : "transform 0.26s ease, opacity 0.26s ease",
    opacity: exit ? 0 : 1,
  };

  const voters = lobby.squad.length;

  return (
    <div className="vote-page">
      {!done && card ? (
        <>
          <p className="vote-progress" aria-live="polite">
            <span>{index + 1}</span> of {deck.length}
            <span className="dots" aria-hidden>
              {deck.map((c, i) => (
                <i key={c.id} className={i < index ? "done" : i === index ? "now" : ""} />
              ))}
            </span>
          </p>
          <div className="deck">
            {next && (
              <div className="deck-under" aria-hidden>
                <CardFace card={next} />
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
              <CardFace card={card} stamp={dir} />
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
            <Button
              variant="soft"
              onClick={() => {
                resetVotes(id);
              }}
            >
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
            <h3>{card.title}</h3>
            <dl>
              <div><dt>Rating</dt><dd>★ {card.rating}</dd></div>
              <div><dt>Distance</dt><dd>{card.distance.toLowerCase()}</dd></div>
              <div><dt>Price</dt><dd>{card.price}</dd></div>
              <div><dt>Group appetite</dt><dd>{card.friendLikes} of {voters - 1} friends leaning yes</dd></div>
            </dl>
            <p>{card.desc}</p>
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
            <AvatarStack avatars={[av(2), av(5), av(3), av(4)]} size={26} />
            <small>All {voters} group members voted</small>
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

  if (!lobby) return <Navigate to="/groups" replace />;
  if (!vote || vote.order.length < deck.length) return <Navigate to={`/session/${id}/vote`} replace />;

  const r = computeResult(deck, vote.answers, lobby.squad.length);
  return (
    <div className="result">
      <span className="pill pill-yellow pill-lg">
        <PartyPopper size={15} /> {r.unanimous ? "IT'S A UNANIMOUS MATCH!" : "THE TOP PICK IS IN!"}
      </span>
      <h1>The Group Has Spoken</h1>
      <div className="result-card">
        <CardFace card={r.winner} />
      </div>
      <p className="result-note">
        {r.score} of {r.voters} people picked this
        {vote.answers[r.winner.id] === "like" ? "" : " — you passed, but the group loved it"}.
      </p>
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
