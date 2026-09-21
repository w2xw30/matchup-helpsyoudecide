import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, ExternalLink, Info, PartyPopper, PlusCircle, Star, Undo2, X } from "lucide-react";
import { av, type LobbyItem } from "../data/mock";
import { KIND_META } from "../lib/catalog";
import { IS_BACKEND } from "../backend/config";
import { buildDeck, doneMembers, voteKey } from "../lib/deck";
import { isAdmin, isMember } from "../lib/perms";
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
              {meta.label.toUpperCase()}
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
          {item.url && (
            <a className="tag tag-link" href={item.url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
              OPEN LINK <ExternalLink size={11} />
            </a>
          )}
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
  const key = lobby ? voteKey(lobby) : id;
  const vote = useStore((s) => s.votes[key]);
  const castVote = useStore((s) => s.castVote);
  const undoVote = useStore((s) => s.undoVote);
  const resetVotes = useStore((s) => s.resetVotes);
  const startVoting = useStore((s) => s.startVoting);

  const deck = useMemo(() => buildDeck(lobby), [lobby]);
  const answers = vote?.answers;
  const index = answers ? deck.filter((c) => answers[c.id]).length : 0;
  const done = deck.length > 0 && index >= deck.length;
  const card = answers ? deck.find((c) => !answers[c.id]) : deck[0];
  const next = deck.find((c) => c !== card && !(answers && answers[c.id]));

  // The card follows the finger via direct DOM writes; React state only changes when the stamp direction flips.
  const [dir, setDir] = useState<"like" | "nope" | null>(null);
  const [exit, setExit] = useState<"like" | "nope" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const frame = useRef(0);
  const [info, setInfo] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(-1);
  const celebrate = done && dismissedAt !== index;
  const setCelebrate = (open: boolean) => setDismissedAt(open ? -1 : index);
  const start = useRef(0);
  const busy = useRef(false);

  const paint = useCallback((x: number, animate: boolean) => {
    const el = topRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.26s ease, opacity 0.26s ease" : "none";
    el.style.transform = `translate3d(${x}px, 0, 0) rotate(${x / 22}deg)`;
  }, []);
  const moveTo = useCallback(
    (x: number) => {
      dxRef.current = x;
      const d = x > 40 ? "like" : x < -40 ? "nope" : null;
      setDir((cur) => (cur === d ? cur : d));
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => paint(x, false));
    },
    [paint],
  );

  const commit = useCallback(
    (choice: "like" | "nope") => {
      if (!card || busy.current) return;
      busy.current = true;
      dragging.current = false;
      cancelAnimationFrame(frame.current);
      setExit(choice);
      const off = choice === "like" ? 520 : -520;
      paint(off, true);
      if (topRef.current) topRef.current.style.opacity = "0";
      setTimeout(() => {
        castVote(key, card.id, choice);
        setExit(null);
        setDir(null);
        dxRef.current = 0;
        busy.current = false;
      }, 260);
    },
    [card, castVote, key, paint],
  );

  // Once the next card is in the DOM, snap the (invisible) top card back to centre before it paints.
  const cardId = card?.id;
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    el.style.opacity = "";
    el.style.transition = "none";
    el.style.transform = "";
  }, [cardId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (info || celebrate) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") commit("like");
      else if (e.key === "ArrowLeft") commit("nope");
      else if ((e.key === "z" || e.key === "Z") && !busy.current) undoVote(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undoVote, key, info, celebrate]);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;

  if (lobby.decision) return <Navigate to={`/session/${id}/result`} replace />;

  if (lobby.phase !== "voting") {
    const admin = isAdmin(lobby);
    return (
      <div className="vote-empty">
        <span className="emoji-big lg" aria-hidden>
          {lobby.emoji}
        </span>
        <h1>Voting hasn't started</h1>
        <p>
          {admin
            ? deck.length < 2
              ? `Add at least two options to “${lobby.name}”, then start voting.`
              : "When everyone's ready, start voting so the whole group swipes at the same time."
            : "The host will open voting soon — you'll get a notification. Only the host and admins can start it."}
        </p>
        <div className="vote-empty-actions">
          {admin && deck.length >= 2 && (
            <Button pill size="lg" onClick={() => startVoting(id)}>
              Start Voting
            </Button>
          )}
          {admin && deck.length < 2 && (
            <LinkButton to={`/lobby/${id}/customize`} pill size="lg">
              <PlusCircle size={16} /> Add options
            </LinkButton>
          )}
          <LinkButton to={`/lobby/${id}`} pill size="lg" variant="soft">
            Back to Lobby
          </LinkButton>
        </div>
      </div>
    );
  }

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

  const stamp = exit ?? dir;

  const voters = lobby.members.length;
  const others = lobby.members.filter((m) => m.avatar).slice(0, 4);

  return (
    <div className="vote-page">
      {!done && card ? (
        <>
          <p className="vote-progress" aria-live="polite">
            {lobby.runoff && <em className="round-tag">Runoff</em>}
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
              ref={topRef}
              onPointerDown={(e) => {
                if (busy.current) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                start.current = e.clientX - dxRef.current;
                dragging.current = true;
              }}
              onPointerMove={(e) => dragging.current && moveTo(e.clientX - start.current)}
              onPointerUp={() => {
                if (!dragging.current) return;
                const x = dxRef.current;
                if (x > THRESHOLD) commit("like");
                else if (x < -THRESHOLD) commit("nope");
                else {
                  dragging.current = false;
                  dxRef.current = 0;
                  setDir(null);
                  cancelAnimationFrame(frame.current);
                  paint(0, true);
                }
              }}
              onPointerCancel={() => {
                dragging.current = false;
                dxRef.current = 0;
                setDir(null);
                cancelAnimationFrame(frame.current);
                paint(0, true);
              }}
            >
              <CardFace item={card} stamp={stamp} />
            </div>
          </div>
          <div className="vote-controls">
            <button type="button" className="vc vc-sm" aria-label="Undo last vote (Z)" onClick={() => undoVote(key)} disabled={index === 0}>
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
            {(!IS_BACKEND || (!lobby.revealed && doneMembers(lobby, deck, answers).length < lobby.members.length)) && (
              <Button variant="soft" onClick={() => resetVotes(key)}>
                {IS_BACKEND ? "Change my votes" : "Vote again"}
              </Button>
            )}
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
            {card.url && (
              <a className="info-link" href={card.url} target="_blank" rel="noopener noreferrer">
                Open link <ExternalLink size={13} />
              </a>
            )}
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
          <h3>{IS_BACKEND ? "You're done voting!" : "Everyone has voted!"}</h3>
          <p>{IS_BACKEND ? "Results appear once everyone has finished — or when the host reveals them." : "The numbers are in. Ready to see which option came out on top?"}</p>
          <Button size="lg" pill onClick={() => nav(`/session/${id}/result`)} data-autofocus>
            {IS_BACKEND ? "See results" : "Reveal the Match"}
          </Button>
          <div className="cel-people">
            <AvatarStack avatars={others.length ? others.map((m) => m.avatar!) : [av(2)]} size={26} />
            <small>{IS_BACKEND ? `${voters} in the lobby` : `All ${voters} group ${voters === 1 ? "member" : "members"} voted`}</small>
          </div>
          <Link to={`/lobby/${id}`} className="link-inline" onClick={() => setCelebrate(false)}>
            Back to lobby
          </Link>
        </div>
      </Modal>
    </div>
  );
}
