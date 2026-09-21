import type { Lobby, LobbyItem, Member } from "../data/mock";
import { IS_BACKEND } from "../backend/config";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Key of the local vote record for a lobby's current round. */
export const voteKey = (l: Pick<Lobby, "id" | "round">) => (l.round > 1 ? `${l.id}#${l.round}` : l.id);

type Answers = Record<string, "like" | "nope">;

/**
 * How one member voted on one option.
 *  - you           → your recorded answers
 *  - backend mode  → the real votes fetched from the server (undefined = hasn't voted yet)
 *  - local mode    → simulated deterministically, so the prototype works alone
 */
export function memberVote(lobby: Lobby, member: Member, item: LobbyItem, mine: Answers | undefined): "like" | "nope" | undefined {
  if (member.id === "you") return mine?.[item.id];
  if (IS_BACKEND) return lobby.votesBy?.[member.id]?.[item.id];
  const salt = lobby.round > 1 ? `s3|${lobby.round}` : "s3";
  return hash(`${member.id}|${item.id}|${salt}`) % 100 < 78 ? "like" : "nope";
}

/** The options currently up for a vote: everything, or just the runoff pair. Stable manual order first. */
export const buildDeck = (lobby?: Lobby): LobbyItem[] => {
  if (!lobby) return [];
  const inPlay = lobby.runoff ? lobby.items.filter((i) => lobby.runoff!.includes(i.id)) : lobby.items;
  return [...inPlay].sort((a, b) => (a.pos ?? a.addedAt) - (b.pos ?? b.addedAt) || a.addedAt - b.addedAt);
};

/** Members who have answered every option in play. Locally, everyone but you is simulated as finished. */
export function doneMembers(lobby: Lobby, deck: LobbyItem[], mine: Answers | undefined): string[] {
  const size = lobby.deckSize ?? deck.length;
  return lobby.members
    .filter((m) => {
      if (m.id === "you") return deck.length > 0 && deck.every((i) => mine?.[i.id] !== undefined);
      if (!IS_BACKEND) return true;
      return (lobby.progress?.[m.id] ?? 0) >= size && size > 0;
    })
    .map((m) => m.id);
}

export interface Ranked {
  item: LobbyItem;
  likes: number;
  likedBy: Member[];
}

export function computeResult(lobby: Lobby, deck: LobbyItem[], mine: Answers | undefined) {
  const members = lobby.members;
  const voters = Math.max(1, members.length);
  const ranked: Ranked[] = deck
    .map((item) => {
      const likedBy = members.filter((m) => memberVote(lobby, m, item, mine) === "like");
      return { item, likes: likedBy.length, likedBy };
    })
    .sort((a, b) => b.likes - a.likes || (a.item.pos ?? a.item.addedAt) - (b.item.pos ?? b.item.addedAt));
  const top = ranked[0];
  const pct = top ? Math.round((top.likes / voters) * 100) : 0;
  const done = doneMembers(lobby, deck, mine);
  const finished = done.length;
  const tied = ranked.filter((r) => r.likes === (top?.likes ?? -1));
  return {
    ranked,
    voters,
    finished,
    done,
    winner: top?.item,
    likes: top?.likes ?? 0,
    matched: !!top && top.likes > 0 && pct >= lobby.requiredMatch,
    unanimous: !!top && top.likes >= voters,
    pct,
    tied,
  };
}
