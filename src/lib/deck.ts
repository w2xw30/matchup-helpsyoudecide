import type { Lobby, LobbyItem, Member } from "../data/mock";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Until there is a backend, friends' votes are simulated deterministically per (member, option). */
export const friendLikes = (item: LobbyItem, members: Member[]) =>
  members.filter((m) => m.id !== "you" && hash(`${m.id}|${item.id}|s3`) % 100 < 78).length;

/** The vote deck is simply the lobby's options, in the order they were added. */
export const buildDeck = (lobby?: Lobby): LobbyItem[] =>
  [...(lobby?.items ?? [])].sort((a, b) => a.addedAt - b.addedAt);

export interface Ranked {
  item: LobbyItem;
  likes: number;
}

export function computeResult(items: LobbyItem[], answers: Record<string, "like" | "nope">, members: Member[], requiredMatch: number) {
  const voters = Math.max(1, members.length);
  const ranked: Ranked[] = items
    .map((item) => ({ item, likes: friendLikes(item, members) + (answers[item.id] === "like" ? 1 : 0) }))
    .sort((a, b) => b.likes - a.likes || a.item.addedAt - b.item.addedAt);
  const top = ranked[0];
  const pct = top ? Math.round((top.likes / voters) * 100) : 0;
  return {
    ranked,
    voters,
    winner: top?.item,
    likes: top?.likes ?? 0,
    matched: !!top && pct >= requiredMatch,
    unanimous: !!top && top.likes >= voters,
    pct,
  };
}
