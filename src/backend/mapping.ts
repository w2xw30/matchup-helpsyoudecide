import type { ChatMsg, Clan, Decision, Friend, HistoryEntry, Invite, ItemKind, Lobby, LobbyItem, LobbyKind, Member, Role } from "../data/mock";

/** Shape returned by the `lobby_bundle` SQL function (see supabase/schema.sql). */
export interface BundleJson {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  emoji: string;
  deadline: string;
  required_match: number;
  allow_friends: boolean;
  link_access: boolean;
  max_members: number;
  locked: boolean;
  round: number;
  phase?: "planning" | "voting";
  revealed?: boolean;
  progress?: Record<string, number>;
  deck_size?: number;
  runoff: string[] | null;
  decision: Decision | null;
  history: HistoryEntry[] | null;
  created_at: number;
  members: { user_id: string; nickname: string; role: string; ready: boolean; joined_at: number; avatar: string | null; full_name: string | null }[];
  invites: { id: string; handle: string; created_at: number }[];
  items: {
    id: string;
    title: string;
    by_id: string | null;
    by_name: string | null;
    kind: string;
    emoji: string;
    image: string | null;
    note: string | null;
    price: string | null;
    rating: string | null;
    distance: string | null;
    url: string | null;
    pos: number | null;
    added_at: number;
  }[];
  messages: { id: string; user_id: string | null; from_name: string | null; body: string }[];
  votes: { user_id: string; round: number; item_id: string; choice: "like" | "nope"; t: number }[];
}

export interface FriendJson {
  user_id: string;
  name: string;
  handle: string;
  avatar: string | null;
  status: "friend" | "pending" | "incoming";
  created_at: number;
}
export interface ClanJson {
  id: string;
  name: string;
  emoji: string;
  description: string;
  created_at: number;
  member_ids: string[];
}

const nn = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

/**
 * Server → app model. The signed-in user's id becomes "you" so every screen keeps working unchanged,
 * and everyone else keeps their real user id.
 */
export function bundleToLobby(b: BundleJson, me: string): { lobby: Lobby; myVotes: Record<string, "like" | "nope">; voteOrder: string[] } {
  const who = (uid: string | null | undefined) => (uid && uid === me ? "you" : (uid ?? "unknown"));
  const round = b.round ?? 1;

  const members: Member[] = b.members.map((m) => ({
    id: who(m.user_id),
    name: m.nickname,
    fullName: m.full_name && m.full_name !== m.nickname ? m.full_name : undefined,
    avatar: nn(m.avatar) || undefined,
    status: m.ready ? "ready" : "thinking",
    role: (m.role as Role) ?? "member",
    joinedAt: m.joined_at,
  }));

  const items: LobbyItem[] = b.items.map((t) => ({
    id: t.id,
    title: t.title,
    by: t.by_name ?? "Someone",
    byId: who(t.by_id),
    kind: (t.kind as ItemKind) ?? "other",
    emoji: t.emoji,
    image: nn(t.image),
    note: nn(t.note),
    price: nn(t.price),
    rating: nn(t.rating),
    distance: nn(t.distance),
    url: nn(t.url),
    pos: nn(t.pos),
    addedAt: t.added_at,
  }));

  const invites: Invite[] = b.invites.map((i) => ({ id: i.id, to: i.handle, sentAt: i.created_at }));
  const chat: ChatMsg[] = b.messages.map((c) => ({ id: c.id, from: c.from_name ?? "Someone", text: c.body, mine: c.user_id === me }));

  const votesBy: Record<string, Record<string, "like" | "nope">> = {};
  const myVotes: Record<string, "like" | "nope"> = {};
  const mine: { item: string; t: number }[] = [];
  for (const v of b.votes) {
    if (v.round !== round) continue;
    if (v.user_id === me) {
      myVotes[v.item_id] = v.choice;
      mine.push({ item: v.item_id, t: v.t });
    } else (votesBy[v.user_id] ??= {})[v.item_id] = v.choice;
  }

  const lobby: Lobby = {
    id: b.id,
    code: b.code,
    name: b.name,
    description: b.description,
    kind: b.kind as LobbyKind,
    emoji: b.emoji,
    members,
    invites,
    ready: b.members.filter((m) => m.ready).map((m) => who(m.user_id)),
    items,
    deadline: b.deadline,
    requiredMatch: b.required_match as 50 | 75 | 100,
    allowFriends: b.allow_friends,
    linkAccess: b.link_access,
    maxMembers: b.max_members,
    locked: b.locked,
    chat,
    createdAt: b.created_at,
    round,
    runoff: b.runoff ?? null,
    decision: b.decision ?? null,
    history: b.history ?? [],
    phase: b.phase ?? "planning",
    revealed: b.revealed ?? false,
    votesBy,
    progress: Object.fromEntries(Object.entries(b.progress ?? {}).map(([uid, n]) => [who(uid), n])),
    deckSize: b.deck_size,
  };
  return { lobby, myVotes, voteOrder: mine.sort((a, z) => a.t - z.t).map((x) => x.item) };
}

export const friendFromJson = (f: FriendJson): Friend => ({
  id: f.user_id,
  name: f.name,
  handle: f.handle || f.name,
  avatar: nn(f.avatar) || undefined,
  status: f.status,
  addedAt: f.created_at,
});

export const clanFromJson = (c: ClanJson): Clan => ({
  id: c.id,
  name: c.name,
  emoji: c.emoji,
  description: c.description,
  memberIds: c.member_ids,
  createdAt: c.created_at,
});

/* ---------------- app model → server rows ---------------- */

export const lobbyRow = (l: Lobby) => ({
  code: l.code,
  name: l.name,
  description: l.description,
  kind: l.kind,
  emoji: l.emoji,
  deadline: l.deadline,
  required_match: l.requiredMatch,
  allow_friends: l.allowFriends,
  link_access: l.linkAccess,
  max_members: l.maxMembers,
  locked: l.locked,
  round: l.round,
  phase: l.phase,
  revealed: l.revealed,
  runoff: l.runoff,
  decision: l.decision,
  history: l.history,
});

export const itemRow = (lobbyId: string, it: LobbyItem, me: string) => ({
  id: it.id,
  lobby_id: lobbyId,
  title: it.title,
  by_id: it.byId === "you" ? me : it.byId.length === 36 ? it.byId : null,
  by_name: it.by,
  kind: it.kind,
  emoji: it.emoji,
  image: it.image ?? null,
  note: it.note ?? null,
  price: it.price ?? null,
  rating: it.rating ?? null,
  distance: it.distance ?? null,
  url: it.url ?? null,
  pos: it.pos ?? null,
  added_at: new Date(it.addedAt).toISOString(),
});

/** Only the fields an edit can change, used to decide whether an item needs an UPDATE. */
export const itemEditable = (it: LobbyItem) =>
  JSON.stringify([it.title, it.kind, it.emoji, it.image ?? null, it.note ?? null, it.price ?? null, it.url ?? null, it.pos ?? null]);
export const lobbyEditable = (l: Lobby) => JSON.stringify(lobbyRow(l));
