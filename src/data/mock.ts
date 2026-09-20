import { guessVisual, type ItemKind, type LobbyKind } from "../lib/catalog";

export type { ItemKind, LobbyKind };

export const av = (n: number) => `/images/avatars/a${n}.jpg`;

export const FOOD_IMG = {
  pasta: "/images/food/pasta.jpg",
  pizza: "/images/food/pizza.jpg",
  momo: "/images/food/momo.jpg",
};

export type MemberStatus = "ready" | "adding" | "thinking";
export type Role = "owner" | "admin" | "member";

export interface Member {
  id: string;
  name: string;
  fullName?: string;
  avatar?: string;
  status: MemberStatus;
  role: Role;
  joinedAt: number;
}
export interface Invite {
  id: string;
  to: string;
  sentAt: number;
}
export interface LobbyItem {
  id: string;
  title: string;
  by: string;
  byId: string;
  kind: ItemKind;
  emoji: string;
  image?: string;
  note?: string;
  price?: string;
  rating?: string;
  distance?: string;
  addedAt: number;
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
  description: string;
  kind: LobbyKind;
  emoji: string;
  members: Member[];
  invites: Invite[];
  ready: string[];
  items: LobbyItem[];
  deadline: string;
  requiredMatch: 50 | 75 | 100;
  allowFriends: boolean;
  linkAccess: boolean;
  maxMembers: number;
  locked: boolean;
  chat: ChatMsg[];
  createdAt: number;
}

export const DEFAULT_LOBBY_ID = "friday-night-42x9";
export const GAMERS_LOBBY_ID = "weekend-gamers-7kq2";

const T0 = 1_760_000_000_000;

const seedMembers = (youRole: Role, ownerId: string): Member[] => {
  const base: Omit<Member, "role">[] = [
    { id: "alex", name: "Alex", fullName: "Alex Morgan", avatar: av(2), status: "ready", joinedAt: T0 },
    { id: "priya", name: "Priya", fullName: "Priya Patel", avatar: av(5), status: "adding", joinedAt: T0 + 1 },
    { id: "jordan", name: "Jordan", fullName: "Jordan Smith", avatar: av(3), status: "ready", joinedAt: T0 + 2 },
    { id: "sam", name: "Sam", fullName: "Sam Lee", avatar: av(4), status: "thinking", joinedAt: T0 + 3 },
    { id: "you", name: "You", status: "ready", joinedAt: T0 + 4 },
  ];
  return base.map((m) => ({ ...m, role: m.id === ownerId ? "owner" : m.id === "you" ? youRole : "member" }));
};

const item = (
  n: number,
  title: string,
  byId: string,
  by: string,
  extra: Partial<LobbyItem> = {},
): LobbyItem => {
  const v = guessVisual(title);
  return { id: `i${n}`, title, by, byId, kind: v.kind, emoji: v.emoji, addedAt: T0 + n, ...extra };
};

export const seedItems = (): LobbyItem[] => [
  item(1, "Artisan Pizza", "alex", "Alex", { image: FOOD_IMG.pizza, rating: "4.3", distance: "0.7 MILES", price: "$15", note: "Wood-fired, thin crust, great for sharing." }),
  item(2, "Interstellar Marathon", "priya", "Priya", { note: "Snacks, blankets and a very long movie." }),
  item(3, "Catan Night", "jordan", "Jordan"),
  item(4, "Vegan Gelato", "sam", "Sam"),
  item(5, "Fresh Pasta Night", "alex", "Alex", { image: FOOD_IMG.pasta, rating: "4.8", distance: "0.8 MILES", price: "$10", note: "Very yummy pasta in local restaurant." }),
  item(6, "Mario Kart Tournament", "sam", "Sam"),
  item(7, "Spicy Ramen", "priya", "Priya"),
  item(8, "Tiramisu Tasting", "alex", "Alex"),
  item(9, "Momo Crawl", "priya", "Priya", { image: FOOD_IMG.momo, rating: "5.0", distance: "0.7 MILES", price: "$20", note: "Steamed, fried and jhol — all the momo." }),
];

export const seedChat = (): ChatMsg[] => [
  { id: "c1", from: "Jordan", text: "Anyone down for a warm-round?" },
  { id: "c2", from: "Priya", text: "Just getting my coffee, 2 mins!" },
];

export const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const defaultLobbies = (): Record<string, Lobby> => ({
  [DEFAULT_LOBBY_ID]: {
    id: DEFAULT_LOBBY_ID,
    code: "482913",
    name: "Friday Night Social",
    description: "Collaborate with your group to build the perfect evening. Add your favorites or pick from the templates below.",
    kind: "mixed",
    emoji: "🎉",
    members: seedMembers("member", "alex"),
    invites: [],
    ready: ["alex", "jordan", "you"],
    items: seedItems(),
    deadline: "20:00",
    requiredMatch: 75,
    allowFriends: true,
    linkAccess: true,
    maxMembers: 12,
    locked: false,
    chat: seedChat(),
    createdAt: T0,
  },
  [GAMERS_LOBBY_ID]: {
    id: GAMERS_LOBBY_ID,
    code: "731204",
    name: "The Weekend Gamers",
    description: "Saturday game night. Bring snacks, keep the rivalry friendly.",
    kind: "game",
    emoji: "🎮",
    members: seedMembers("owner", "you").filter((m) => m.id !== "alex"),
    invites: [{ id: "inv-seed", to: "marcus@example.com", sentAt: T0 + 100 }],
    ready: ["jordan"],
    items: [
      item(21, "Catan", "jordan", "Jordan"),
      item(22, "Mario Kart", "sam", "Sam"),
      item(23, "Codenames", "priya", "Priya"),
      item(24, "Smash Bros", "you", "You"),
    ].map((i) => ({ ...i, id: `g${i.id}` })),
    deadline: "21:00",
    requiredMatch: 75,
    allowFriends: true,
    linkAccess: true,
    maxMembers: 8,
    locked: false,
    chat: [],
    createdAt: T0 - 86_400_000 * 2,
  },
});

export interface Template {
  id: string;
  title: string;
  tag: string;
  tagTone: "yellow" | "gray";
  blurb: string;
  kind: LobbyKind;
  emoji: string;
  items: string[];
}
export const templates: Template[] = [
  {
    id: "warriors",
    title: "Weekend Warriors",
    tag: "HIGH STAKES",
    tagTone: "yellow",
    blurb: "Competitive trivia and voting streak.",
    kind: "game",
    emoji: "🏆",
    items: ["Pub Trivia", "Charades", "Escape Room", "Bowling"],
  },
  {
    id: "chill",
    title: "Friday Chill",
    tag: "CASUAL",
    tagTone: "gray",
    blurb: "Low pressure polls and vibe checks.",
    kind: "mixed",
    emoji: "🌙",
    items: ["Sushi", "Tacos", "Movie Night", "Board Games"],
  },
];

export const quickTemplates: { id: LobbyKind; label: string; sub: string; kind: ItemKind; items: string[] }[] = [
  { id: "food", label: "Food", sub: "Pizza, Sushi, Burgers...", kind: "food", items: ["Sushi", "Smash Burgers", "Wood-fired Pizza"] },
  { id: "movie", label: "Movies", sub: "Action, Horror, Indie...", kind: "movie", items: ["Dune", "Past Lives", "Knives Out"] },
  { id: "game", label: "Games", sub: "Board, PC, Retro...", kind: "game", items: ["Codenames", "Overcooked", "Uno"] },
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
  { id: "n3", type: "group", avatar: av(4), title: "New group member joined", highlight: "'The Weekend Gamers'", body: "Marcus and 2 others just hopped in. Say hello!", time: "2H AGO", read: false, lobbyId: GAMERS_LOBBY_ID },
  { id: "n4", type: "stats", title: "Your weekly stats are ready", body: "See how many matches you made last week.", time: "YESTERDAY", read: true, lobbyId: DEFAULT_LOBBY_ID },
];

export const recents = [
  { id: "r1", title: "Late Night Game", meta: "YESTERDAY • 12 PARTICIPANTS", avatars: [av(2), av(3)], lobbyId: DEFAULT_LOBBY_ID },
  { id: "r2", title: "Lunch Spot", meta: "3 DAYS AGO • 8 PARTICIPANTS", avatars: [av(5)], initials: "SJ", lobbyId: GAMERS_LOBBY_ID },
];

export const faqs = [
  { q: "What is Matchup?", a: "Matchup is a real-time group decision app. Everyone in a lobby swipes on the same options, and the group's most-loved pick wins." },
  { q: "How do I create a lobby?", a: "Tap “New lobby” in the top bar, give it a title, choose what you're deciding on, then invite your friends with a link, code or QR." },
  { q: "How do I invite friends?", a: "Open your lobby and choose Invite. You can copy the link, share the 6-digit code, show the QR code, or invite people by name or email." },
  { q: "What can lobby admins do?", a: "Admins can rename the lobby, change its rules, remove options, remove members, and promote other members to admin. The owner can also transfer ownership." },
  { q: "How do options get pictures?", a: "As you type an option we suggest matches with photos. You can also upload your own photo, and if nothing fits we use a category emoji." },
  { q: "What does 'Required Matches' mean?", a: "It is how much of the group must say yes for something to count as a match. 100% means a unanimous match." },
  { q: "Can I change my vote?", a: "Yes. Use the undo button on the voting screen to step back to your previous card before the deadline." },
  { q: "How do I delete my account?", a: "Go to Settings → Account & Privacy → Delete Account. This permanently removes your data and cannot be undone." },
];
