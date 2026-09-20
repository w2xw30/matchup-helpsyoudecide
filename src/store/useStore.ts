import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_LOBBY_ID,
  av,
  defaultLobbies,
  makeLobby,
  seedNotifs,
  type ItemKind,
  type Lobby,
  type Notif,
  type Template,
} from "../data/mock";

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

  ensureLobby: (id: string) => Lobby;
  createLobbyFromTemplate: (tpl: Template) => string;
  joinLobby: (id: string, nickname?: string) => void;
  addItem: (lobbyId: string, title: string, kind?: ItemKind) => boolean;
  addItems: (lobbyId: string, titles: string[], kind: ItemKind) => number;
  removeItem: (lobbyId: string, itemId: string) => void;
  setControl: (lobbyId: string, patch: Partial<Pick<Lobby, "deadline" | "requiredMatch" | "allowFriends">>) => void;
  toggleReady: (lobbyId: string, memberId?: string) => void;
  setMemberStatus: (lobbyId: string, memberId: string, ready: boolean) => void;
  sendChat: (lobbyId: string, text: string) => void;

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
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const rid = () => Math.random().toString(36).slice(2, 6);

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
          user: s.user && s.user.email === email && !name ? s.user : defaultUser(name ?? (email === "alex@example.com" ? "Alex Rivera" : prettyName(email)), email),
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

      ensureLobby: (id) => {
        const existing = get().lobbies[id];
        if (existing) return existing;
        const lobby = makeLobby({ id, name: "Friday Night Social", invitedName: "The Friday Hangout" });
        set((s) => ({ lobbies: { ...s.lobbies, [id]: lobby } }));
        return lobby;
      },
      createLobbyFromTemplate: (tpl) => {
        const id = `${slug(tpl.title)}-${rid()}`;
        const lobby = makeLobby({
          id,
          name: tpl.title,
          invitedName: tpl.title,
          category: tpl.category,
          code: String(Math.floor(100000 + Math.random() * 900000)),
          items: tpl.items.map((t, i) => ({ id: `${id}-${i}`, title: t, by: "You", kind: tpl.kind, mine: true })),
          ready: ["you"],
          chat: [],
        });
        set((s) => ({ lobbies: { ...s.lobbies, [id]: lobby } }));
        return id;
      },
      joinLobby: (id, nickname) => {
        get().ensureLobby(id);
        if (nickname) {
          set((s) => {
            const l = s.lobbies[id];
            const squad = l.squad.map((m) => (m.id === "you" ? { ...m, name: nickname } : m));
            return { lobbies: { ...s.lobbies, [id]: { ...l, squad } } };
          });
        }
      },
      addItem: (lobbyId, title, kind = "other") => {
        const clean = title.trim();
        if (!clean) return false;
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l) return s;
          const item = { id: `${lobbyId}-${Date.now()}-${rid()}`, title: clean, by: "You", kind, mine: true };
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, items: [item, ...l.items] } } };
        });
        return true;
      },
      addItems: (lobbyId, titles, kind) => {
        let added = 0;
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l) return s;
          const have = new Set(l.items.map((i) => i.title.toLowerCase()));
          const fresh = titles
            .filter((t) => !have.has(t.toLowerCase()))
            .map((t) => ({ id: `${lobbyId}-${Date.now()}-${rid()}`, title: t, by: "You", kind, mine: true }));
          added = fresh.length;
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, items: [...fresh, ...l.items] } } };
        });
        return added;
      },
      removeItem: (lobbyId, itemId) =>
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l) return s;
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, items: l.items.filter((i) => i.id !== itemId) } } };
        }),
      setControl: (lobbyId, patch) =>
        set((s) => {
          const l = s.lobbies[lobbyId];
          return l ? { lobbies: { ...s.lobbies, [lobbyId]: { ...l, ...patch } } } : s;
        }),
      toggleReady: (lobbyId, memberId = "you") =>
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l) return s;
          const ready = l.ready.includes(memberId) ? l.ready.filter((m) => m !== memberId) : [...l.ready, memberId];
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, ready } } };
        }),
      setMemberStatus: (lobbyId, memberId, ready) =>
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l || l.ready.includes(memberId) === ready) return s;
          const list = ready ? [...l.ready, memberId] : l.ready.filter((m) => m !== memberId);
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, ready: list } } };
        }),
      sendChat: (lobbyId, text) => {
        const clean = text.trim();
        if (!clean) return;
        set((s) => {
          const l = s.lobbies[lobbyId];
          if (!l) return s;
          const msg = { id: `c-${Date.now()}`, from: "You", text: clean, mine: true };
          return { lobbies: { ...s.lobbies, [lobbyId]: { ...l, chat: [...l.chat, msg] } } };
        });
      },

      castVote: (sessionId, cardId, choice) =>
        set((s) => {
          const v = s.votes[sessionId] ?? { answers: {}, order: [] };
          return {
            votes: {
              ...s.votes,
              [sessionId]: {
                answers: { ...v.answers, [cardId]: choice },
                order: [...v.order.filter((c) => c !== cardId), cardId],
              },
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
      resetDemo: () =>
        set({
          lobbies: defaultLobbies(),
          votes: {},
          notifs: seedNotifs(),
          hiddenTemplates: [],
        }),
    }),
    {
      name: "matchup-v1",
      version: 1,
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
