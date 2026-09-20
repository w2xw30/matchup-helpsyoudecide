import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_LOBBY_ID,
  av,
  defaultLobbies,
  newCode,
  seedClans,
  seedFriends,
  seedNotifs,
  type Clan,
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

export type Theme = "light" | "dark";
export interface User {
  name: string;
  email: string;
  bio: string;
  avatar: string;
  /** true until the person logs in or signs up — guests can use everything locally */
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
}
export type LobbyPatch = Partial<
  Pick<Lobby, "name" | "description" | "kind" | "emoji" | "linkAccess" | "allowFriends" | "maxMembers" | "deadline" | "requiredMatch" | "locked">
>;
export type InviteResult = "ok" | "duplicate" | "full" | "invalid";
export type FriendResult = "ok" | "duplicate" | "invalid" | "self";
export interface NewClan {
  name: string;
  emoji: string;
  description: string;
  memberIds: string[];
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
  toasts: Toast[];

  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  login: (email: string, name?: string) => void;
  logout: () => void;
  deleteAccount: () => void;
  updateProfile: (p: Partial<User>) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;

  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;

  addFriend: (handle: string) => FriendResult;
  acceptFriend: (id: string) => void;
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

  toggleReady: (lobbyId: string, memberId?: string) => void;
  setMemberStatus: (lobbyId: string, memberId: string, ready: boolean) => void;
  sendChat: (lobbyId: string, text: string, from?: string, mine?: boolean) => void;

  castVote: (sessionId: string, cardId: string, choice: "like" | "nope") => void;
  undoVote: (sessionId: string) => void;
  resetVotes: (sessionId: string) => void;

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
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28) || "lobby";
const rid = () => Math.random().toString(36).slice(2, 6);
const POOL = [av(6), av(7), av(8), av(2), av(3), av(4), av(5)];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const handleToName = (h: string) => {
  const local = h.trim().replace(/^@/, "").split("@")[0];
  const word = local.split(/[._\-\s]+/).filter(Boolean)[0] ?? "Friend";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
};
export const validHandle = (h: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h.trim()) || /^@?[a-z0-9._-]{2,24}$/i.test(h.trim());

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

const safeStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked — state stays in memory */
    }
  },
  removeItem: (k: string) => {
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
      friends: seedFriends(),
      clans: seedClans(),
      lobbies: defaultLobbies(),
      votes: {},
      notifs: seedNotifs(),
      hiddenTemplates: [],
      toasts: [],

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
          friends: seedFriends(),
          clans: seedClans(),
          settings: defaultSettings(),
          lobbies: defaultLobbies(),
          votes: {},
          notifs: seedNotifs(),
          hiddenTemplates: [],
        }),
      updateProfile: (p) => set((s) => ({ user: { ...s.user, ...p } })),
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),

      toast: (message, tone = "success") => {
        const id = toastSeq++;
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
        setTimeout(() => get().dismissToast(id), 2800);
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
        set((x) => ({ friends: [...x.friends, { id: `f-${rid()}${rid()}`, name, handle: h, status: "pending", addedAt: Date.now() }] }));
        return "ok";
      },
      // Simulates the other person accepting the request. Replace with a server event later.
      acceptFriend: (id) =>
        set((s) => ({
          friends: s.friends.map((f) => (f.id === id && f.status === "pending" ? { ...f, status: "friend" as const, avatar: POOL[hash(f.name) % POOL.length] } : f)),
        })),
      removeFriend: (id) =>
        set((s) => ({
          friends: s.friends.filter((f) => f.id !== id),
          clans: s.clans.map((c) => ({ ...c, memberIds: c.memberIds.filter((m) => m !== id) })),
        })),
      createClan: (input) => {
        const id = `clan-${slug(input.name)}-${rid()}`;
        set((s) => ({
          clans: [{ id, name: input.name.trim(), emoji: input.emoji, description: input.description.trim(), memberIds: input.memberIds, createdAt: Date.now() }, ...s.clans],
        }));
        return id;
      },
      updateClan: (id, patch) =>
        set((s) => ({
          clans: s.clans.map((c) =>
            c.id === id
              ? { ...c, ...patch, name: patch.name !== undefined ? patch.name.trim() || c.name : c.name, description: patch.description !== undefined ? patch.description.trim() : c.description }
              : c,
          ),
        })),
      deleteClan: (id) => set((s) => ({ clans: s.clans.filter((c) => c.id !== id) })),

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
          delete votes[id];
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
          delete votes[id];
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
      // Simulates the invitee accepting. With a backend this happens when they open the link.
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
          addedAt: Date.now(),
        };
        set((s) => patchLobby(s, lobbyId, (x) => ({ ...x, items: [...x.items, item] })));
        return item;
      },
      addItems: (lobbyId, titles, kind) => {
        const l = get().lobbies[lobbyId];
        if (!l) return 0;
        const have = new Set(l.items.map((i) => i.title.toLowerCase()));
        let added = 0;
        for (const t of titles) {
          if (have.has(t.toLowerCase())) continue;
          if (get().addItem(lobbyId, { title: t, kind: kind && !guessVisual(t).matched ? kind : undefined })) added++;
        }
        return added;
      },
      updateItem: (lobbyId, itemId, patch) =>
        set((s) =>
          patchLobby(s, lobbyId, (l) => ({
            ...l,
            items: l.items.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    ...patch,
                    title: patch.title?.trim() || i.title,
                    note: patch.note !== undefined ? patch.note.trim() || undefined : i.note,
                    price: patch.price !== undefined ? patch.price.trim() || undefined : i.price,
                  }
                : i,
            ),
          })),
        ),
      removeItem: (lobbyId, itemId) => set((s) => patchLobby(s, lobbyId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }))),

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

      markAllRead: () => set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, read: true })) })),
      markRead: (id) => set((s) => ({ notifs: s.notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

      hideTemplate: (id) => set((s) => ({ hiddenTemplates: [...s.hiddenTemplates, id] })),
      resetDemo: () => set({ lobbies: defaultLobbies(), votes: {}, notifs: seedNotifs(), hiddenTemplates: [], friends: seedFriends(), clans: seedClans() }),
    }),
    {
      name: "matchup-v1",
      version: 3,
      storage: createJSONStorage(() => safeStorage),
      // v1 → v2: lobbies changed shape, so reset them. v3: everyone can browse as a guest, and the
      // stock profile photo is gone. Keep whatever account/settings the person already had.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<State>;
        const next: Partial<State> = { ...p };
        if (version < 2) {
          next.lobbies = defaultLobbies();
          next.votes = {};
        }
        if (!p.user) next.user = guestUser();
        else if (p.user.avatar === av(1)) next.user = { ...p.user, avatar: "" };
        return next as State;
      },
      partialize: (s) => ({
        theme: s.theme,
        user: s.user,
        settings: s.settings,
        friends: s.friends,
        clans: s.clans,
        lobbies: s.lobbies,
        votes: s.votes,
        notifs: s.notifs,
        hiddenTemplates: s.hiddenTemplates,
      }),
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
