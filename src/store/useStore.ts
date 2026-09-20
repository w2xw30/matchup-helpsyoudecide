import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_LOBBY_ID,
  av,
  defaultLobbies,
  newCode,
  seedNotifs,
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

interface State {
  theme: Theme;
  user: User | null;
  settings: Settings;
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

const defaultUser = (name = "Alex Rivera", email = "alex@example.com"): User => ({
  name,
  email,
  bio: "Daytime party enthusiast and poll creator. Let's find the best spots in the city! 🙌",
  avatar: av(1),
});

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
      user: null,
      settings: defaultSettings(),
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
            s.user && s.user.email === email && !name
              ? s.user
              : defaultUser(name ?? (email === "alex@example.com" ? "Alex Rivera" : prettyName(email)), email),
        })),
      logout: () => set({ user: null }),
      deleteAccount: () =>
        set({
          user: null,
          settings: defaultSettings(),
          lobbies: defaultLobbies(),
          votes: {},
          notifs: seedNotifs(),
          hiddenTemplates: [],
        }),
      updateProfile: (p) => set((s) => (s.user ? { user: { ...s.user, ...p } } : s)),
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),

      toast: (message, tone = "success") => {
        const id = toastSeq++;
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
        setTimeout(() => get().dismissToast(id), 2800);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

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
          invites: [],
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
        const name = handleToName(inv.to);
        const member: Member = {
          id: `m-${rid()}${rid()}`,
          name,
          fullName: inv.to.includes("@") ? inv.to : undefined,
          avatar: POOL[hash(name) % POOL.length],
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
      resetDemo: () => set({ lobbies: defaultLobbies(), votes: {}, notifs: seedNotifs(), hiddenTemplates: [] }),
    }),
    {
      name: "matchup-v1",
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      // v1 stored lobbies in an older shape (no roles / rich items). Keep the account, reset lobby data.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...p, lobbies: defaultLobbies(), votes: {} } as State;
      },
      partialize: (s) => ({
        theme: s.theme,
        user: s.user,
        settings: s.settings,
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
