export const av = (n: number) => `/images/avatars/a${n}.jpg`;

export const FOOD_IMG = {
  pasta: "/images/food/pasta.jpg",
  pizza: "/images/food/pizza.jpg",
  momo: "/images/food/momo.jpg",
};

export type MemberStatus = "ready" | "adding" | "thinking";
export interface Member {
  id: string;
  name: string;
  avatar?: string;
  status: MemberStatus;
}
export interface Presence {
  id: string;
  name: string;
  avatar: string;
  note: string;
  online: boolean;
}
export type ItemKind = "food" | "movie" | "game" | "dessert" | "other";
export interface LobbyItem {
  id: string;
  title: string;
  by: string;
  kind: ItemKind;
  mine?: boolean;
}
export interface ChatMsg {
  id: string;
  from: string;
  text: string;
  mine?: boolean;
}
export interface Lobby {
  id: string;
  code: string;
  name: string;
  invitedName: string;
  description: string;
  category: string;
  squad: Member[];
  presence: Presence[];
  ready: string[];
  items: LobbyItem[];
  deadline: string;
  requiredMatch: 50 | 75 | 100;
  allowFriends: boolean;
  chat: ChatMsg[];
  createdAt: number;
}

export const DEFAULT_LOBBY_ID = "friday-night-42x9";

export const baseSquad = (): Member[] => [
  { id: "alex", name: "Alex", avatar: av(2), status: "ready" },
  { id: "priya", name: "Priya", avatar: av(5), status: "adding" },
  { id: "jordan", name: "Jordan", avatar: av(3), status: "ready" },
  { id: "sam", name: "Sam", avatar: av(4), status: "thinking" },
  { id: "you", name: "You", status: "ready" },
];

export const basePresence = (): Presence[] => [
  { id: "p1", name: "Alex Rivera", avatar: av(1), note: "Adding options...", online: true },
  { id: "p2", name: "Sarah Chen", avatar: av(6), note: "Browsing movies", online: true },
  { id: "p3", name: "Jordan Smith", avatar: av(7), note: "Ready to vote", online: true },
  { id: "p4", name: "Mia Thompson", avatar: av(8), note: "Last seen 5m ago", online: false },
];

export const seedItems = (): LobbyItem[] => [
  { id: "i1", title: "Artisan Pizza", by: "Alex", kind: "food" },
  { id: "i2", title: "Interstellar Marathon", by: "Sarah", kind: "movie" },
  { id: "i3", title: "Catan Night", by: "Jordan", kind: "game" },
  { id: "i4", title: "Vegan Gelato", by: "Mia", kind: "dessert" },
  { id: "i5", title: "Spicy Ramen", by: "Priya", kind: "food" },
  { id: "i6", title: "Mario Kart Tournament", by: "Sam", kind: "game" },
  { id: "i7", title: "Spirited Away", by: "Mia", kind: "movie" },
  { id: "i8", title: "Tiramisu Tasting", by: "Alex", kind: "dessert" },
  { id: "i9", title: "Momo Crawl", by: "Priya", kind: "food" },
];

export const seedChat = (): ChatMsg[] => [
  { id: "c1", from: "Jordan", text: "Anyone down for a warm-round?" },
  { id: "c2", from: "Sarah", text: "Just getting my coffee, 2 mins!" },
];

export function makeLobby(partial: Partial<Lobby> & { id: string; name: string }): Lobby {
  return {
    code: "482913",
    invitedName: partial.name,
    description:
      "Collaborate with your group to build the perfect evening. Add your favorites or pick from the templates below.",
    category: "Friday Night Dinner",
    squad: baseSquad(),
    presence: basePresence(),
    ready: ["alex", "jordan", "you"],
    items: seedItems(),
    deadline: "20:00",
    requiredMatch: 100,
    allowFriends: true,
    chat: seedChat(),
    createdAt: Date.now(),
    ...partial,
  };
}

export const defaultLobbies = (): Record<string, Lobby> => ({
  [DEFAULT_LOBBY_ID]: makeLobby({
    id: DEFAULT_LOBBY_ID,
    name: "Friday Night Social",
    invitedName: "The Friday Hangout",
  }),
  "weekend-gamers-7kq2": makeLobby({
    id: "weekend-gamers-7kq2",
    name: "The Weekend Gamers",
    invitedName: "The Weekend Gamers",
    category: "Game Night",
    code: "731204",
    ready: ["alex"],
    items: seedItems().filter((i) => i.kind === "game" || i.kind === "dessert"),
    createdAt: Date.now() - 86400000 * 2,
  }),
});

export interface Template {
  id: string;
  title: string;
  tag: string;
  tagTone: "yellow" | "gray";
  blurb: string;
  category: string;
  kind: ItemKind;
  items: string[];
}
export const templates: Template[] = [
  {
    id: "warriors",
    title: "Weekend Warriors",
    tag: "HIGH STAKES",
    tagTone: "yellow",
    blurb: "Competitive trivia and voting streak.",
    category: "Trivia Night",
    kind: "game",
    items: ["Pub Trivia", "Charades", "Escape Room"],
  },
  {
    id: "chill",
    title: "Friday Chill",
    tag: "CASUAL",
    tagTone: "gray",
    blurb: "Low pressure polls and vibe checks.",
    category: "Friday Night Dinner",
    kind: "food",
    items: ["Sushi Platter", "Taco Truck", "Burger Joint"],
  },
];

export const quickTemplates: { id: string; label: string; sub: string; kind: ItemKind; items: string[] }[] = [
  { id: "food", label: "Food", sub: "Pizza, Sushi, Burgers...", kind: "food", items: ["Sushi Boat", "Smash Burgers", "Wood-fired Pizza"] },
  { id: "movies", label: "Movies", sub: "Action, Horror, Indie...", kind: "movie", items: ["Dune: Part Two", "The Substitute", "Past Lives"] },
  { id: "games", label: "Games", sub: "Board, PC, Retro...", kind: "game", items: ["Codenames", "Overcooked", "Smash Bros"] },
];

export interface DeckCard {
  id: string;
  title: string;
  price: string;
  rating: string;
  distance: string;
  desc: string;
  tags: string[];
  image?: string;
  kind: ItemKind;
  /** how many of the 4 friends liked it (seeded) */
  friendLikes: number;
}
export const baseDeck: DeckCard[] = [
  { id: "pasta", title: "Yummy Pasta", price: "$10", rating: "4.8", distance: "0.8 MILES", desc: "Very yummy pasta in local restaurant. Really really yummy pasta.", tags: ["Italian", "Local"], image: FOOD_IMG.pasta, kind: "food", friendLikes: 4 },
  { id: "pizza", title: "Yummy Pizza", price: "$15", rating: "4.3", distance: "0.7 MILES", desc: "Very yummy pizza in local restaurant. Really really yummy pizza.", tags: ["Italian", "Local"], image: FOOD_IMG.pizza, kind: "food", friendLikes: 2 },
  { id: "momo", title: "Yummy Momo", price: "$20", rating: "5.0", distance: "0.7 MILES", desc: "Very yummy momo in local restaurant. Really really yummy momo.", tags: ["Nepali", "Local"], image: FOOD_IMG.momo, kind: "food", friendLikes: 1 },
];

export interface Notif {
  id: string;
  type: "invite" | "match" | "group" | "stats";
  who?: string;
  avatar?: string;
  title: string;
  highlight?: string;
  body: string;
  quote?: boolean;
  time: string;
  read: boolean;
  lobbyId: string;
}
export const seedNotifs = (): Notif[] => [
  { id: "n1", type: "invite", who: "Priya", avatar: av(5), title: "invited you to a new session", body: "\"Hey! Thought this would be perfect for our group.\"", quote: true, time: "2M AGO", read: false, lobbyId: DEFAULT_LOBBY_ID },
  { id: "n2", type: "match", title: "Match found for", highlight: "Friday Night Dinner!", body: "4 people with similar interests are ready to go.", time: "45M AGO", read: false, lobbyId: DEFAULT_LOBBY_ID },
  { id: "n3", type: "group", avatar: av(4), title: "New group member joined", highlight: "'The Weekend Gamers'", body: "Marcus and 2 others just hopped in. Say hello!", time: "2H AGO", read: false, lobbyId: "weekend-gamers-7kq2" },
  { id: "n4", type: "stats", title: "Your weekly stats are ready", body: "See how many matches you made last week.", time: "YESTERDAY", read: true, lobbyId: DEFAULT_LOBBY_ID },
];

export const recents = [
  { id: "r1", title: "Late Night Game", meta: "YESTERDAY • 12 PARTICIPANTS", avatars: [av(2), av(3)], lobbyId: DEFAULT_LOBBY_ID },
  { id: "r2", title: "Lunch Spot", meta: "3 DAYS AGO • 8 PARTICIPANTS", avatars: [av(5)], initials: "SJ", lobbyId: "weekend-gamers-7kq2" },
];

export const faqs = [
  { q: "What is Matchup?", a: "Matchup is a real-time group decision app. Everyone in a lobby swipes on the same options, and the group's most-loved pick wins." },
  { q: "How do I invite friends?", a: "Open your lobby and copy the invite link, or share the 6-digit session code. Friends can join from the Join Session screen." },
  { q: "What does 'Required Matches' mean?", a: "It is how much of the group must say yes for something to count as a match. 100% means a unanimous match." },
  { q: "Can I change my vote?", a: "Yes. Use the undo button on the voting screen to step back to your previous card before the deadline." },
  { q: "Is Matchup free?", a: "Matchup is free for groups of up to 12 people. Larger groups and history export are on the roadmap." },
  { q: "How do I delete my account?", a: "Go to Settings → Account & Privacy → Delete Account. This permanently removes your data and cannot be undone." },
];
