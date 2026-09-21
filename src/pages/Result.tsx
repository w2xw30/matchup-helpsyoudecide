import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Copy, Download, Loader2, Lock, PartyPopper, RotateCcw, Share2, Swords, Unlock } from "lucide-react";
import type { LobbyItem } from "../data/mock";
import { buildDeck, computeResult, voteKey } from "../lib/deck";
import { isAdmin, isMember } from "../lib/perms";
import { makeShareImage } from "../lib/shareCard";
import { inviteUrl } from "../lib/url";
import { IS_BACKEND } from "../backend/config";
import { net, useStore } from "../store/useStore";
import { Avatar, Button } from "../components/ui/ui";
import { ItemThumb } from "../components/lobby/visual";
import { CardFace } from "./Vote";

export function Result() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const lobby = useStore((s) => s.lobbies[id]);
  const vote = useStore((s) => (lobby ? s.votes[voteKey(lobby)] : undefined));
  const user = useStore((s) => s.user);
  const revealResults = useStore((s) => s.revealResults);
  const restartVoting = useStore((s) => s.restartVoting);
  const lockDecision = useStore((s) => s.lockDecision);
  const startRunoff = useStore((s) => s.startRunoff);
  const reopenLobby = useStore((s) => s.reopenLobby);
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deck = useMemo(() => buildDeck(lobby), [lobby]);

  // Online: others' progress is only visible after a refresh, so keep checking while we wait.
  useEffect(() => {
    if (!IS_BACKEND) return;
    net.refreshLobby?.(id); // the last person to finish shouldn't wait for the first poll
    const t = setInterval(() => {
      const l = useStore.getState().lobbies[id];
      if (l && !l.revealed && !l.decision) net.refreshLobby?.(id);
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  if (!lobby || !isMember(lobby)) return <Navigate to="/groups" replace />;
  const admin = isAdmin(lobby);
  const decision = lobby.decision;

  const answered = vote ? deck.filter((c) => vote.answers[c.id]).length : 0;
  if (!decision && lobby.phase !== "voting") return <Navigate to={`/session/${id}/vote`} replace />;
  // once an admin reveals the results, everyone can see them — even people who hadn't finished
  if (!decision && !lobby.revealed && (!vote || deck.length < 2 || answered < deck.length)) return <Navigate to={`/session/${id}/vote`} replace />;

  const r = computeResult(lobby, deck, vote?.answers);
  const everyoneDone = r.finished >= r.voters;
  if (!decision && !lobby.revealed && !everyoneDone) {
    const pctDone = Math.round((r.finished / Math.max(1, r.voters)) * 100);
    return (
      <div className="result waiting">
        <span className="pill pill-lg pill-gray">
          <Loader2 size={14} className="spin" /> WAITING FOR THE GROUP
        </span>
        <h1>You're done — hang tight</h1>
        <p className="result-note">Results appear as soon as everyone has voted.</p>
        <section className="card wait-card" aria-live="polite">
          <div className="wait-head">
            <strong>
              {r.finished} of {r.voters} finished
            </strong>
            <span>{pctDone}%</span>
          </div>
          <div className="wait-bar" aria-hidden>
            <i style={{ width: `${pctDone}%` }} />
          </div>
          <ul>
            {lobby.members.map((m) => {
              const finished = r.done.includes(m.id);
              const you = m.id === "you";
              return (
                <li key={m.id} className={finished ? "done" : ""}>
                  <Avatar src={you ? user.avatar : m.avatar} name={you ? user.name : (m.fullName ?? m.name)} size={32} />
                  <span className="wait-name">{you ? `${m.name === "You" ? user.name : m.name} (you)` : (m.fullName ?? m.name)}</span>
                  <span className="wait-state">
                    {finished ? (
                      <>
                        <Check size={13} /> Done
                      </>
                    ) : (
                      "Still voting…"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        {admin ? (
          <div className="decide-row">
            <Button pill size="lg" onClick={() => revealResults(id)}>
              Reveal results now
            </Button>
          </div>
        ) : null}
        <p className="result-hint">
          {admin ? "People who haven't finished won't be counted yet." : "The host can also reveal the results early."}
        </p>
        <div className="result-actions">
          <Button pill size="lg" variant="soft" onClick={() => nav(`/lobby/${id}`)}>
            Back to Lobby
          </Button>
          {!lobby.revealed && (
            <Button pill size="lg" variant="soft" onClick={() => nav(`/session/${id}/vote`)}>
              Change my votes
            </Button>
          )}
        </div>
      </div>
    );
  }

  const winner: LobbyItem | undefined = decision
    ? (lobby.items.find((i) => i.id === decision.itemId) ?? { id: decision.itemId, title: decision.title, emoji: decision.emoji, image: decision.image, kind: "other", by: "", byId: "", addedAt: 0 })
    : r.winner;
  if (!winner) return <Navigate to={`/session/${id}/vote`} replace />;

  const likes = decision?.likes ?? r.likes;
  const voters = decision?.voters ?? r.voters;
  const pct = Math.round((likes / Math.max(1, voters)) * 100);
  const matched = decision ? decision.matched : r.matched;
  const youLiked = vote?.answers[winner.id] === "like";

  const headline = decision ? "Decided" : r.unanimous ? "Unanimous match" : matched ? "The group has a match" : "Closest pick";
  const detail = `${likes} of ${voters} ${voters === 1 ? "person" : "people"} picked it (${pct}%)`;
  const text = `${winner.emoji} ${winner.title} — ${detail} in “${lobby.name}”. ${inviteUrl(lobby)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be blocked */
    }
    toast("Result copied to clipboard");
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${winner.title} — ${lobby.name}`, text, url: inviteUrl(lobby) });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copy();
  };
  const saveImage = async () => {
    setBusy(true);
    try {
      const href = await makeShareImage({ item: winner, lobbyName: lobby.name, headline, detail });
      const a = document.createElement("a");
      a.href = href;
      a.download = `matchup-${lobby.id}-result.png`;
      a.click();
      toast("Image saved");
    } catch {
      toast("Couldn't create the image", "warn");
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    lockDecision(id, { itemId: winner.id, title: winner.title, emoji: winner.emoji, image: winner.image, likes, voters, matched });
    toast(`Locked in: ${winner.title}`);
  };
  const runoff = () => {
    const top = r.ranked.slice(0, 2);
    startRunoff(id, top.map((t) => t.item.id), { title: winner.title, emoji: winner.emoji, likes: r.likes, voters: r.voters });
    toast("Runoff started — top two options");
    nav(`/session/${id}/vote`);
  };
  const canRunoff = admin && !decision && deck.length > 2 && (!r.matched || r.tied.length > 1);

  return (
    <div className="result">
      <span className={`pill pill-lg ${matched || decision ? "pill-yellow" : "pill-gray"}`}>
        {decision ? <Lock size={14} /> : <PartyPopper size={15} />}{" "}
        {decision ? "DECIDED" : r.unanimous ? "IT'S A UNANIMOUS MATCH!" : matched ? "THE GROUP HAS A MATCH!" : "NO FULL MATCH — CLOSEST PICK"}
      </span>
      <h1>{decision ? "It's Decided" : matched ? "The Group Has Spoken" : "Closest to a Match"}</h1>
      <div className="result-card">
        <CardFace item={winner} />
      </div>
      <p className="result-note">
        {detail}
        {!decision && !matched ? ` — you needed ${lobby.requiredMatch}%` : ""}
        {decision ? ` · locked in by ${decision.byName}` : !youLiked && likes > 0 ? " — you passed, but the group leaned in" : ""}.
      </p>
      {!decision && r.finished < r.voters && (
        <p className="result-wait" role="status">
          Revealed early — {r.voters - r.finished} {r.voters - r.finished === 1 ? "person hadn't" : "people hadn't"} finished, so their votes aren't counted yet.
        </p>
      )}

      <div className="share-row" role="group" aria-label="Share this result">
        <Button size="sm" variant="soft" pill onClick={copy}>
          <Copy size={14} /> Copy result
        </Button>
        <Button size="sm" variant="soft" pill onClick={share}>
          <Share2 size={14} /> Share
        </Button>
        <Button size="sm" variant="soft" pill onClick={saveImage} disabled={busy}>
          <Download size={14} /> Save image
        </Button>
      </div>

      {(admin || decision) && (
        <div className="decide-row">
          {admin && !decision && (
            <Button pill size="lg" onClick={lock}>
              <Lock size={16} /> Lock in this pick
            </Button>
          )}
          {canRunoff && (
            <Button pill size="lg" variant="soft" onClick={runoff}>
              <Swords size={16} /> Runoff: top two
            </Button>
          )}
          {admin && decision && (
            <Button pill size="lg" variant="soft" onClick={() => reopenLobby(id)}>
              <Unlock size={16} /> Reopen lobby
            </Button>
          )}
        </div>
      )}
      {!admin && !decision && <p className="result-hint">Only lobby admins can lock in the final pick.</p>}

      {!decision && (
        <section className="ranking card" aria-label="All results">
          <h3>How everyone voted</h3>
          <ol>
            {r.ranked.map(({ item, likes: n, likedBy }, i) => {
              const isOpen = open === item.id;
              return (
                <li key={item.id} className={`${i === 0 ? "top" : ""} ${isOpen ? "open" : ""}`}>
                  <button type="button" className="rk-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : item.id)}>
                    <span className="rk-n">{i + 1}</span>
                    <ItemThumb item={item} size={34} round={false} />
                    <span className="rk-title">{item.title}</span>
                    <span className="rk-bar" aria-hidden>
                      <i style={{ width: `${(n / r.voters) * 100}%` }} />
                    </span>
                    <span className="rk-count">
                      {n}/{r.voters}
                    </span>
                    <ChevronDown size={15} className="rk-chev" />
                  </button>
                  {isOpen && (
                    <div className="rk-who">
                      {likedBy.length === 0 ? (
                        <span className="muted">Nobody picked this one.</span>
                      ) : (
                        likedBy.map((m) => (
                          <span key={m.id} className="who-chip">
                            <Avatar src={m.id === "you" ? user.avatar : m.avatar} name={m.id === "you" ? user.name : (m.fullName ?? m.name)} size={22} />
                            {m.id === "you" ? "You" : m.name}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {lobby.history.length > 0 && (
        <section className="history card" aria-label="Round history">
          <h3>Rounds</h3>
          <ul>
            {lobby.history.map((h, i) => (
              <li key={i}>
                <span className="hist-r">Round {h.round}</span>
                <span className="hist-t">
                  {h.emoji} {h.title}
                </span>
                <span className="hist-k">{h.kind === "runoff" ? "Went to runoff" : "Decided"}</span>
                <span className="hist-n">
                  {h.likes}/{h.voters}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="result-actions">
        <Button pill size="lg" onClick={() => nav(`/lobby/${id}`)}>
          Back to Lobby
        </Button>
        {!decision && admin && (
          <Button
            pill
            size="lg"
            variant="soft"
            onClick={() => {
              restartVoting(id);
              toast("New round — everyone votes again");
              nav(`/session/${id}/vote`);
            }}
          >
            <RotateCcw size={15} /> Restart voting
          </Button>
        )}
      </div>
    </div>
  );
}
