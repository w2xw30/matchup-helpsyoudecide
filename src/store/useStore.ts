import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_LOBBY_ID,
  av,
  defaultLobbies,
  newCode,
  normalizeLobby,
  seedClans,
  seedFriends,
  seedNotifs,
  type Clan,
  type Decision,
  type Friend,
  type Invite,
  type ItemKind,
  type Lobby,
  type LobbyItem,
  type LobbyKind,
  type Member,
  type Notif,
  type Role,
} from "../data/mock";
import { KIND_META, guessVisual } from "../lib/catalog";
import { IS_BACKEND } from "../backend/config";

export type Theme = "light" | "dark";
export interface User {
  name: string;
  email: string;
  bio: string;
  avatar: string;
  /** backend user id (undefined in local mode) */
  id?: string;
  /** public username friends can search for (online accounts only) */
  handle?: string;
  /** true until the person logs in or signs up — guests can use everything */
  guest?: boolean;
}
export interface Settings {
  push: boolean;
  email: boolean;
  twoFactor: boolean;
  visibility: "everyone" | "friends" | "me";
  showActivity: boolean;
  discoverable: boolean;
}
export interface Vote {
  answers: Record<string, "like" | "nope">;
  order: string[];
}
export interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "warn";
}

export interface NewLobby {
  name: string;
  description: string;
  kind: LobbyKind;
  emoji: string;
  linkAccess: boolean;
  allowFriends: boolean;
  maxMembers: number;
  deadline: string;
  requiredMatch: 50 | 75 | 100;
  itemTitles: string[];
  /** handles (emails/usernames) to invite right away, e.g. a clan's members */
  invites?: string[];
}
export interface ItemDraft {
  title: string;
  kind?: ItemKind;
  emoji?: string;
  image?: string;
  note?: string;
  price?: string;
  url?: string;
}
export type LobbyPatch = Partial<
  Pick<Lobby, "name" | "description" | "kind" | "emoji" | "linkAccess" | "allowFriends" | "maxMembers" | "deadline" | "requiredMatch" | "locked" | "phase" | "revealed">
>;
export type InviteResult = "ok" | "duplicate" | "full" | "invalid";
export type FriendResult = "ok" | "duplicate" | "invalid" | "self";
export interface NewClan {
  name: string;
  emoji: string;
  description: string;
  memberIds: string[];
}
export type NewNotif = Omit<Notif, "id" | "at" | "read"> & { id?: string };

/** Network hooks. The backend registers these on boot; the store never imports the backend (no import cycle). */
export interface NetHooks {
  friendRequest?: (localId: string, handle: string) => void;
  friendRespond?: (friend: Friend, accept: boolean) => void;
  friendRemove?: (friend: Friend) => void;
  clanSave?: (clan: Clan, isNew: boolean) => void;
  clanDelete?: (id: string) => void;
  profileSave?: (user: User) => void;
  refreshLobby?: (id: string) => void;
}
export const net: NetHooks = {};

/** Updates that come *from* the server are applied through this so the sync engine doesn't echo them back. */
let remoteDepth = 0;
export const isRemoteUpdate = () => remoteDepth > 0;
export function runRemote(fn: () => void) {
  remoteDepth++;
  try {
    fn();
  } finally {
    remoteDepth--;
  }
}

interface State {
  theme: Theme;
  user: User;
  settings: Settings;
  friends: Friend[];
  clans: Clan[];
  lobbies: Record<string, Lobby>;
  votes: Record<string, Vote>;
  notifs: Notif[];
  hiddenTemplates: string[];
  introDismissed: boolean;
  toasts: Toast[];
  /** false only while the online backend is still signing in / loading the first data */
  booted: boolean;

  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  login: (email: string, name?: string) => void;
  logout: () => void;
  deleteAccount: () => void;
  updateProfile: (p: Partial<User>) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  dismissIntro: () => void;

  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;

  addFriend: (handle: string) => FriendResult;
  acceptFriend: (id: string) => void;
  respondFriend: (id: string, accept: boolean) => void;
  removeFriend: (id: string) => void;
  createClan: (input: NewClan) => string;
  updateClan: (id: string, patch: Partial<NewClan>) => void;
  deleteClan: (id: string) => void;

  createLobby: (input: NewLobby) => string;
  updateLobby: (id: string, patch: LobbyPatch) => void;
  deleteLobby: (id: string) => void;
  leaveLobby: (id: string) => void;
  joinLobby: (id: string, nickname: string) => void;
  regenerateCode: (id: string) => string;

  inviteMember: (id: string, to: string) => InviteResult;
  cancelInvite: (id: string, inviteId: string) => void;
  acceptInvite: (id: string, inviteId: string) => string | null;
  setRole: (id: string, memberId: string, role: Role) => void;
  transferOwnership: (id: string, memberId: string) => void;
  removeMember: (id: string, memberId: string) => void;

  addItem: (lobbyId: string, draft: ItemDraft) => LobbyItem | null;
  addItems: (lobbyId: string, titles: string[], kind?: ItemKind) => number;
  updateItem: (lobbyId: string, itemId: string, patch: Partial<ItemDraft>) => void;
  removeItem: (lobbyId: string, itemId: string) => void;
  moveItem: (lobbyId: string, itemId: string, dir: -1 | 1) => void;

  toggleReady: (lobbyId: string, memberId?: string) => void;
  setMemberStatus: (lobbyId: string, memberId: string, ready: boolean) => void;
  sendChat: (lobbyId: string, text: string, from?: string, mine?: boolean) => void;

  castVote: (sessionId: string, cardId: string, choice: "like" | "nope") => void;
  undoVote: (sessionId: string) => void;
  resetVotes: (sessionId: string) => void;

  lockDecision: (lobbyId: string, d: Omit<Decision, "at" | "byName">) => void;
  startRunoff: (lobbyId: string, itemIds: string[], prev: { title: string; emoji: string; likes: number; voters: number }) => void;
  reopenLobby: (lobbyId: string) => void;
  /** admin/owner only: open voting for everyone */
  startVoting: (lobbyId: string) => void;
  /** admin/owner only: close voting without a result (back to planning) */
  endVoting: (lobbyId: string) => void;
  /** admin/owner only: show results now even if some people haven't finished */
  revealResults: (lobbyId: string) => void;
  /** admin/owner only: everyone votes again from scratch on the full list */
  restartVoting: (lobbyId: string) => void;

  pushNotif: (n: NewNotif) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;

  hideTemplate: (id: string) => void;
  resetDemo: () => void;
}

// No stock photo by default: people without one get an initials tile.
const defaultUser = (name = "Alex Rivera", email = "alex@example.com"): User => ({
  name,
  email,
  bio: "Daytime party enthusiast and poll creator. Let's find the best spots in the city! 🙌",
  avatar: "",
});
export const guestUser = (): User => ({ name: "Guest", email: "", bio: "", avatar: "", guest: true });

const defaultSettings = (): Settings => ({
  push: true,
  email: false,
  twoFactor: false,
  visibility: "friends",
  showActivity: true,
  discoverable: true,
});

let toastSeq = 1;
let notifSeq = 1;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28) || "lobby";
export const rid = () => Math.random().toString(36).slice(2, 6);
const POOL = [av(6), av(7), av(8), av(2), av(3), av(4), av(5)];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const handleToName = (h: string) => {
  const local = h.trim().replace(/^@/, "").split("@")[0];
  const word = local.split(/[._\-\s]+/).filter(Boolean)[0] ?? "Friend";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
};
export const validHandle = (h: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h.trim()) || /^@?[a-z0-9._-]{2,24}$/i.test(h.trim());
export const validUrl = (u: string) => {
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
};

function uniqueCode(lobbies: Record<string, Lobby>) {
  const used = new Set(Object.values(lobbies).map((l) => l.code));
  let c = newCode();
  while (used.has(c)) c = newCode();
  return c;
}

const patchLobby = (s: State, id: string, fn: (l: Lobby) => Lobby): Partial<State> => {
  const l = s.lobbies[id];
  return l ? { lobbies: { ...s.lobbies, [id]: fn(l) } } : {};
};

const orderOf = (i: LobbyItem) => i.pos ?? i.addedAt;
export const sortedItems = (items: LobbyItem[]) => [...items].sort((a, b) => orderOf(a) - orderOf(b) || a.addedAt - b.addedAt);

/**
 * localStorage writes are synchronous and the whole store is serialised on every change, which janks phones.
 * Coalesce them: write the latest value shortly after the last change, and flush when the tab is hidden/closed.
 */
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const flush = () => {
  clearTimeout(timer);
  timer = undefined;
  for (const [k, v] of pending) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked — state stays in memory */
    }
  }
  pending.clear();
};
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

const safeStorage = {
  getItem: (k: string) => {
    try {
      return pending.get(k) ?? localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    pending.set(k, v);
    timer ??= setTimeout(flush, 400);
  },
  removeItem: (k: string) => {
    pending.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      theme: "light",
      user: guestUser(),
      settings: defaultSettings(),
      // With an online backend everything starts empty and is loaded from the server.
      friends: IS_BACKEND ? [] : seedFriends(),
      clans: IS_BACKEND ? [] : seedClans(),
      lobbies: IS_BACKEND ? {} : defaultLobbies(),
      votes: {},
      notifs: IS_BACKEND ? [] : seedNotifs(),
      hiddenTemplates: [],
      introDismissed: false,
      toasts: [],
      booted: !IS_BACKEND,

      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (theme) => set({ theme }),
      login: (email, name) =>
        set((s) => ({
          user:
            !s.user.guest && s.user.email === email && !name
              ? s.user
              : defaultUser(name ?? (email === "alex@example.com" ? "Alex Rivera" : prettyName(email)), email),
        })),
      logout: () => set({ user: guestUser() }),
      deleteAccount: () =>
        set({
          user: guestUser(),
          friends: IS_BACKEND ? [] : seedFriends(),
          clans: IS_BACKEND ? [] : seedClans(),
          settings: defaultSettings(),
          lobbies: IS_BACKEND ? {} : defaultLobbies(),
          votes: {},
          notifs: IS_BACKEND ? [] : seedNotifs(),
          hiddenTemplates: [],
          introDismissed: false,
        }),
      updateProfile: (p) => {
        set((s) => ({ user: { ...s.user, ...p } }));
        net.profileSave?.(get().user);
      },
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
      dismissIntro: () => set({ introDismissed: true }),

      // One quiet toast at a time: a new message replaces the old one instead of stacking.
      toast: (message, tone = "success") => {
        const id = toastSeq++;
        set({ toasts: [{ id, message, tone }] });
        setTimeout(() => get().dismissToast(id), 2600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      /* ---------------- friends & clans ---------------- */
      addFriend: (handle) => {
        const h = handle.trim();
        if (!validHandle(h)) return "invalid";
        const s = get();
        const key = h.toLowerCase().replace(/^@/, "");
        if (s.user.email && key === s.user.email.toLowerCase()) return "self";
        const name = handleToName(h);
        if (s.friends.some((f) => f.handle.toLowerCase().replace(/^@/, "") === key || f.name.split(" ")[0].toLowerCase() === name.toLowerCase())) return "duplicate";
        const id = `f-${rid()}${rid()}`;
        set((x) => ({ friends: [...x.friends, { id, name, handle: h, status: "pending", addedAt: Date.now() }] }));
        net.friendRequest?.(id, h);
        return "ok";
      },
      // Local prototype only: simulates the other person accepting. With a backend the server does this.
      acceptFriend: (id) =>
        set((s) => ({
          friends: s.friends.map((f) => (f.id === id && f.status === "pending" ? { ...f, status: "friend" as const, avatar: POOL[hash(f.name) % POOL.length] } : f)),
        })),
      respondFriend: (id, accept) => {
        const f = get().friends.find((x) => x.id === id);
        if (!f) return;
        set((s) => ({ friends: accept ? s.friends.map((x) => (x.id === id ? { ...x, status: "friend" as const } : x)) : s.friends.filter((x) => x.id !== id) }));
        net.friendRespond?.(f, accept);
      },
      removeFriend: (id) => {
        const f = get().friends.find((x) => x.id === id);
        set((s) => ({
          friends: s.friends.filter((x) => x.id !== id),
          clans: s.clans.map((c) => ({ ...c, memberIds: c.memberIds.filter((m) => m !== id) })),
        }));
        if (f) net.friendRemove?.(f);
      },
      createClan: (input) => {
        const id = `clan-${slug(input.name)}-${rid()}`;
        const clan: Clan = { id, name: input.name.trim(), emoji: input.emoji, description: input.description.trim(), memberIds: input.memberIds, createdAt: Date.now() };
        set((s) => ({ clans: [clan, ...s.clans] }));
        net.clanSave?.(clan, true);
        return id;
      },
      updateClan: (id, patch) => {
        set((s) => ({
          clans: s.clans.map((c) =>
            c.id === id
              ? { ...c, ...patch, name: patch.name !== undefined ? patch.name.trim() || c.name : c.name, description: patch.description !== undefined ? patch.description.trim() : c.description }
              : c,
          ),
        }));
        const c = get().clans.find((x) => x.id === id);
        if (c) net.clanSave?.(c, false);
      },
      deleteClan: (id) => {
        set((s) => ({ clans: s.clans.filter((c) => c.id !== id) }));
        net.clanDelete?.(id);
      },

      /* ---------------- lobbies ---------------- */
      createLobby: (input) => {
        const s = get();
        let id = `${slug(input.name)}-${rid()}`;
        while (s.lobbies[id]) id = `${slug(input.name)}-${rid()}`;
        const now = Date.now();
        const fallback: ItemKind = input.kind === "mixed" ? "other" : input.kind;
        const items: LobbyItem[] = input.itemTitles.map((t, i) => {
          const v = guessVisual(t, fallback);
          return { id: `${id}-${i}`, title: t, by: "You", byId: "you", kind: v.kind, emoji: v.emoji, addedAt: now + i };
        });
        const lobby: Lobby = {
          id,
          code: uniqueCode(s.lobbies),
          name: input.name.trim(),
          description: input.description.trim(),
          kind: input.kind,
          emoji: input.emoji,
          members: [{ id: "you", name: "You", status: "thinking", role: "owner", joinedAt: now }],
          invites: (input.invites ?? []).map((to, i) => ({ id: `inv-${rid()}${i}`, to, sentAt: now })),
          ready: [],
          items,
          deadline: input.deadline,
          requiredMatch: input.requiredMatch,
          allowFriends: input.allowFriends,
          linkAccess: input.linkAccess,
          maxMembers: input.maxMembers,
          locked: false,
          chat: [],
          createdAt: now,
          round: 1,
          runoff: null,
          decision: null,
          history: [],
          phase: "planning",
          revealed: false,
        };
        set({ lobbies: { ...s.lobbies, [id]: lobby } });
        return id;
      },
      updateLobby: (id, patch) => set((s) => patchLobby(s, id, (l) => ({ ...l, ...patch }))),
      deleteLobby: (id) =>
        set((s) => {
          const lobbies = { ...s.lobbies };
          delete lobbies[id];
          const votes = { ...s.votes };
          for (const k of Object.keys(votes)) if (k === id || k.startsWith(`${id}#`)) delete votes[k];
          return { lobbies, votes };
        }),
      leaveLobby: (id) =>
        set((s) => {
          const l = s.lobbies[id];
          if (!l) return s;
          const rest = l.members.filter((m) => m.id !== "you");
          const lobbies = { ...s.lobbies };
          if (rest.length === 0) delete lobbies[id];
          else {
            // ownership passes to the longest-standing admin, then the longest-standing member
            const hadOwner = rest.some((m) => m.role === "owner");
            const heir = hadOwner ? null : [...rest].sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin") || a.joinedAt - b.joinedAt)[0];
            lobbies[id] = {
              ...l,
              members: rest.map((m) => (heir && m.id === heir.id ? { ...m, role: "owner" as Role } : m)),
              ready: l.ready.filter((r) => r !== "you"),
            };
          }
          const votes = { ...s.votes };
          for (const k of Object.keys(votes)) if (k === id || k.startsWith(`${id}#`)) delete votes[k];
          return { lobbies, votes };
        }),
      joinLobby: (id, nickname) =>
        set((s) => {
          const l = s.lobbies[id];
          if (!l) return s;
          const me = l.members.find((m) => m.id === "you");
          const members: Member[] = me
            ? l.members.map((m) => (m.id === "you" ? { ...m, name: nickname } : m))
            : [...l.members, { id: "you", name: nickname, status: "thinking", role: "member", joinedAt: Date.now() }];
          const email = s.user?.email.toLowerCase();
          return {
            lobbies: { ...s.lobbies, [id]: { ...l, members, invites: l.invites.filter((i) => i.to.toLowerCase() !== email) } },
          };
        }),
      regenerateCode: (id) => {
        const code = uniqueCode(get().lobbies);
        set((s) => patchLobby(s, id, (l) => ({ ...l, code })));
        return code;
      },

      inviteMember: (id, to) => {
        const l = get().lobbies[id];
        const handle = to.trim();
        if (!l || !validHandle(handle)) return "invalid";
        const key = handle.toLowerCase();
        if (l.invites.some((i) => i.to.toLowerCase() === key) || l.members.some((m) => m.name.toLowerCase() === handleToName(handle).toLowerCase())) return "duplicate";
        if (l.members.length + l.invites.length >= l.maxMembers) return "full";
        const invite: Invite = { id: `inv-${rid()}${rid()}`, to: handle, sentAt: Date.now() };
        set((s) => patchLobby(s, id, (x) => ({ ...x, invites: [...x.invites, invite] })));
        return "ok";
      },
      cancelInvite: (id, inviteId) => set((s) => patchLobby(s, id, (l) => ({ ...l, invites: l.invites.filter((i) => i.id !== inviteId) }))),
      // Local prototype only: simulates the invitee accepting. With a backend this happens when they join.
      acceptInvite: (id, inviteId) => {
        const l = get().lobbies[id];
        const inv = l?.invites.find((i) => i.id === inviteId);
        if (!l || !inv) return null;
        const friend = get().friends.find((f) => f.handle.toLowerCase() === inv.to.toLowerCase());
        const name = friend ? friend.name.split(" ")[0] : handleToName(inv.to);
        const member: Member = {
          id: `m-${rid()}${rid()}`,
          name,
          fullName: friend?.name ?? (inv.to.includes("@") ? inv.to : undefined),
          avatar: friend?.avatar ?? POOL[hash(name) % POOL.length],
          status: "thinking",
          role: "member",
          joinedAt: Date.now(),
        };
        set((s) => patchLobby(s, id, (x) => ({ ...x, invites: x.invites.filter((i) => i.id !== inviteId), members: [...x.members, member] })));
        return name;
      },
      setRole: (id, memberId, role) =>
        set((s) => patchLobby(s, id, (l) => ({ ...l, members: l.members.map((m) => (m.id === memberId && m.role !== "owner" ? { ...m, role } : m)) }))),
      transferOwnership: (id, memberId) =>
        set((s) =>
          patchLobby(s, id, (l) => ({
            ...l,
            members: l.members.map((m) => (m.id === memberId ? { ...m, role: "owner" as Role } : m.role === "owner" ? { ...m, role: "admin" as Role } : m)),
          })),
        ),
      removeMember: (id, memberId) =>
        set((s) => patchLobby(s, id, (l) => ({ ...l, members: l.members.filter((m) => m.id !== memberId), ready: l.ready.filter((r) => r !== memberId) }))),

      /* ---------------- items ---------------- */
      addItem: (lobbyId, draft) => {
        const l = get().lobbies[lobbyId];
        const title = draft.title.trim();
        if (!l || !title) return null;
        const fallback: ItemKind = l.kind === "mixed" ? "other" : l.kind;
        const v = guessVisual(title, fallback);
        const kind = draft.kind ?? v.kind;
        const me = l.members.find((m) => m.id === "you");
        const url = draft.url?.trim();
        const item: LobbyItem = {
          id: `${lobbyId}-${Date.now().toString(36)}-${rid()}`,
          title,
          by: me?.name && me.name !== "You" ? me.name : "You",
          byId: "you",
          kind,
          emoji: draft.emoji ?? (draft.kind && draft.kind !== v.kind ? KIND_META[draft.kind].emoji : v.emoji),
          image: draft.image,
          note: draft.note?.trim() || undefined,
          price: draft.price?.trim() || undefined,
          url: url && validUrl(url) ? url : undefined,
          addedAt: Date.now(),
        };
        // if the list has been manually ordered, new options go to the end of that order
        if (l.items.some((i) => i.pos !== undefined)) item.pos = Math.max(...l.items.map(orderOf)) + 10;
        set((s) => patchLobby(s, lobbyId, (x) => ({ ...x, items: [...x.items, item] })));
        return item;
      },
      addItems: (lobbyId, titles, kind) => {
        const l = get().lobbies[lobbyId];
        if (!l) return 0;
        const have = new Set(l.items.map((i) => i.title.toLowerCase()));
        let added = 0;
        for (const t of titles) {
          const clean = t.trim();
          if (!clean || have.has(clean.toLowerCase())) continue;
          have.add(clean.toLowerCase());
          if (get().addItem(lobbyId, { title: clean, kind: kind && !guessVisual(clean).matched ? kind : undefined })) added++;
        }
        return added;
      },
      updateItem: (lobbyId, itemId, patch) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => ({
            ...l,
            items: l.items.map((i) => {
              if (i.id !== itemId) return i;
              const url = patch.url !== undefined ? patch.url.trim() : undefined;
              return {
                ...i,
                ...patch,
                title: patch.title?.trim() || i.title,
                note: patch.note !== undefined ? patch.note.trim() || undefined : i.note,
                price: patch.price !== undefined ? patch.price.trim() || undefined : i.price,
                url: patch.url !== undefined ? (url && validUrl(url) ? url : undefined) : i.url,
              };
            }),
          })),
        ),
      removeItem: (lobbyId, itemId) => set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }))),
      moveItem: (lobbyId, itemId, dir) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => {
            const list = sortedItems(l.items);
            const idx = list.findIndex((i) => i.id === itemId);
            const to = idx + dir;
            if (idx < 0 || to < 0 || to >= list.length) return l;
            [list[idx], list[to]] = [list[to], list[idx]];
            const pos = new Map(list.map((i, n) => [i.id, n * 10]));
            return { ...l, items: l.items.map((i) => ({ ...i, pos: pos.get(i.id) })) };
          }),
        ),

      /* ---------------- readiness / chat ---------------- */
      toggleReady: (lobbyId, memberId = "you") =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => ({
            ...l,
            ready: l.ready.includes(memberId) ? l.ready.filter((m) => m !== memberId) : [...l.ready, memberId],
          })),
        ),
      setMemberStatus: (lobbyId, memberId, ready) =>
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l || l.ready.includes(memberId) === ready) return s;
          return patchLobby(s, lobbyId, (x) => ({ ...x, ready: ready ? [...x.ready, memberId] : x.ready.filter((m) => m !== memberId) }));
        }),
      sendChat: (lobbyId, text, from = "You", mine = true) => {
        const clean = text.trim();
        if (!clean) return;
        set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, chat: [...l.chat, { id: `c-${Date.now()}-${rid()}`, from, text: clean, mine }] })));
      },

      /* ---------------- voting ---------------- */
      castVote: (sessionId, cardId, choice) =>
        set((s) => {
          const v = s.votes[sessionId] ?? { answers: {}, order: [] };
          return {
            votes: {
              ...s.votes,
              [sessionId]: { answers: { ...v.answers, [cardId]: choice }, order: [...v.order.filter((c) => c !== cardId), cardId] },
            },
          };
        }),
      undoVote: (sessionId) =>
        set((s) => {
          const v = s.votes[sessionId];
          if (!v || v.order.length === 0) return s;
          const last = v.order[v.order.length - 1];
          const answers = { ...v.answers };
          delete answers[last];
          return { votes: { ...s.votes, [sessionId]: { answers, order: v.order.slice(0, -1) } } };
        }),
      resetVotes: (sessionId) =>
        set((s) => {
          const votes = { ...s.votes };
          delete votes[sessionId];
          return { votes };
        }),

      /* ---------------- decisions ---------------- */
      lockDecision: (lobbyId, d) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => {
            const me = l.members.find((m) => m.id === "you");
            const decision: Decision = { ...d, at: Date.now(), byName: me?.name && me.name !== "You" ? me.name : s.user.name };
            const history = [...l.history, { round: l.round, title: d.title, emoji: d.emoji, likes: d.likes, voters: d.voters, kind: "decided" as const, at: decision.at }];
            return { ...l, decision, locked: true, phase: "planning" as const, history };
          }),
        ),
      startRunoff: (lobbyId, itemIds, prev) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => ({
            ...l,
            round: l.round + 1,
            runoff: itemIds,
            decision: null,
            phase: "voting" as const,
            revealed: false,
            history: [...l.history, { round: l.round, ...prev, kind: "runoff" as const, at: Date.now() }],
          })),
        ),
      reopenLobby: (lobbyId) =>
        set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, decision: null, locked: false, runoff: null, phase: "planning" as const, revealed: false }))),
      startVoting: (lobbyId) =>
        set((s) => patchLobby(s, lobbyId, (l) => (l.items.length >= 2 && !l.decision ? { ...l, phase: "voting" as const, revealed: false } : l))),
      endVoting: (lobbyId) => set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, phase: "planning" as const, revealed: false }))),
      revealResults: (lobbyId) => set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, revealed: true }))),
      restartVoting: (lobbyId) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => ({ ...l, round: l.round + 1, runoff: null, decision: null, phase: "voting" as const, revealed: false, votesBy: undefined, progress: undefined })),
        ),

      /* ---------------- notifications ---------------- */
      pushNotif: (n) =>
        set((s) => {
          const id = n.id ?? `n-${Date.now().toString(36)}-${notifSeq++}`;
          if (s.notifs.some((x) => x.id === id)) return s;
          return { notifs: [{ ...n, id, at: Date.now(), read: false }, ...s.notifs].slice(0, 60) };
        }),
      markAllRead: () => set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, read: true })) })),
      markRead: (id) => set((s) => ({ notifs: s.notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

      hideTemplate: (id) => set((s) => ({ hiddenTemplates: [...s.hiddenTemplates, id] })),
      resetDemo: () =>
        set({
          lobbies: IS_BACKEND ? {} : defaultLobbies(),
          votes: {},
          notifs: IS_BACKEND ? [] : seedNotifs(),
          hiddenTemplates: [],
          friends: IS_BACKEND ? [] : seedFriends(),
          clans: IS_BACKEND ? [] : seedClans(),
        }),
    }),
    {
      name: "matchup-v1",
      version: 4,
      storage: createJSONStorage(() => safeStorage),
      // v1 → v2: lobbies changed shape, so reset them. v3: everyone can browse as a guest and the stock profile
      // photo is gone. v4: rounds/decisions on lobbies and timestamped notifications. Keep the person's account.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<State> & { notifs?: (Notif & { time?: string })[] };
        const next: Partial<State> = { ...p } as Partial<State>;
        if (version < 2) {
          next.lobbies = defaultLobbies();
          next.votes = {};
        }
        if (!p.user) next.user = guestUser();
        else if (p.user.avatar === av(1)) next.user = { ...p.user, avatar: "" };
        if (next.lobbies) next.lobbies = Object.fromEntries(Object.entries(next.lobbies).map(([k, l]) => [k, normalizeLobby(l)]));
        if (version < 4) next.notifs = seedNotifs();
        return next as State;
      },
      // With a backend the server owns lobbies, friends, clans and the account; only local preferences are cached.
      partialize: (s) =>
        (IS_BACKEND
          ? { theme: s.theme, settings: s.settings, hiddenTemplates: s.hiddenTemplates, introDismissed: s.introDismissed, notifs: s.notifs }
          : {
              theme: s.theme,
              user: s.user,
              settings: s.settings,
              friends: s.friends,
              clans: s.clans,
              lobbies: s.lobbies,
              votes: s.votes,
              notifs: s.notifs,
              hiddenTemplates: s.hiddenTemplates,
              introDismissed: s.introDismissed,
            }) as unknown as State,
    },
  ),
);

export function prettyName(email: string) {
  const local = email.split("@")[0] ?? "Alex";
  const words = local.replace(/[._-]+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return "Alex Rivera";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export { DEFAULT_LOBBY_ID };
