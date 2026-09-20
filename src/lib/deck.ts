import { baseDeck, type DeckCard, type Lobby, type LobbyItem } from "../data/mock";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const KIND_TAGS: Record<string, string[]> = {
  food: ["Food", "Local"],
  movie: ["Movie", "Tonight"],
  game: ["Game", "Group"],
  dessert: ["Dessert", "Sweet"],
  other: ["Idea", "Custom"],
};

export function itemToCard(it: LobbyItem): DeckCard {
  const h = hash(it.title);
  const rating = (3.8 + (h % 13) / 10).toFixed(1);
  return {
    id: it.id,
    title: it.title,
    price: it.kind === "movie" ? "$12" : it.kind === "game" ? "Free" : `$${8 + (h % 14)}`,
    rating: Math.min(5, Number(rating)).toFixed(1),
    distance: `${(0.3 + (h % 9) / 10).toFixed(1)} MILES`,
    desc: `${it.title} — a pick added by ${it.by === "You" ? "you" : it.by}. Vote to see if the group agrees.`,
    tags: KIND_TAGS[it.kind] ?? KIND_TAGS.other,
    kind: it.kind,
    friendLikes: h % 5,
  };
}

/** The Figma deck (pasta, pizza, momo) plus anything the user added to the lobby. */
export function buildDeck(lobby?: Lobby): DeckCard[] {
  const custom = (lobby?.items ?? []).filter((i) => i.mine).map(itemToCard);
  return [...baseDeck, ...custom];
}

export function computeResult(deck: DeckCard[], answers: Record<string, "like" | "nope">, voters: number) {
  const scored = deck.map((c) => ({
    card: c,
    score: c.friendLikes + (answers[c.id] === "like" ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return { winner: top.card, score: top.score, unanimous: top.score >= voters, voters };
}
