/**
 * Online backend (Supabase) sync engine.
 *
 * The UI keeps working against the local store exactly as before. This module:
 *   1. signs the person in (anonymous guest by default) and loads their lobbies / friends / clans,
 *   2. watches the store and turns every local change into database writes (an "outbox"),
 *   3. listens to realtime changes and re-loads whatever changed, applying it as a *remote* update
 *      so it is never echoed back to the server.
 *
 * Nothing here runs unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see config.ts).
 */
import type { Session } from "@supabase/supabase-js";
import type { Lobby } from "../data/mock";
import { voteKey } from "../lib/deck";
import { isMember, myRole } from "../lib/perms";
import { guestUser, isRemoteUpdate, net, runRemote, useStore, type User } from "../store/useStore";
import { sb } from "./client";
import { IS_BACKEND } from "./config";
import {
  bundleToLobby,
  clanFromJson,
  friendFromJson,
  itemEditable,
  itemRow,
  lobbyEditable,
  lobbyRow,
  type BundleJson,
  type ClanJson,
  type FriendJson,
} from "./mapping";
import { useBackend } from "./status";

let me = "";
let started = false;
let pending = 0;
let queue: Promise<void> = Promise.resolve();
const refreshIds = new Set<string>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let friendsTimer: ReturnType<typeof setTimeout> | undefined;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const state = () => useStore.getState();

function must<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message);
  return res;
}

/* ------------------------------------------------------------------ */
/* Outbox: local changes → server, one at a time and in order          */
/* ------------------------------------------------------------------ */
function enqueue(label: string, fn: () => Promise<void>, lobbyId?: string) {
  pending++;
  queue = queue.then(async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[sync] ${label} failed`, e);
      state().toast("Couldn't save that change — refreshing.", "warn");
      if (lobbyId) scheduleRefresh(lobbyId);
      else void loadAll();
    } finally {
      pending--;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Inbound: server → store                                             */
/* ------------------------------------------------------------------ */
async function fetchBundle(id: string): Promise<BundleJson | null> {
  const res = must(await sb().rpc("lobby_bundle", { l: id }));
  return (res.data as BundleJson | null) ?? null;
}

function scheduleRefresh(id: string) {
  refreshIds.add(id);
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(flushRefresh, 250);
}

async function flushRefresh() {
  if (pending > 0) {
    // wait for our own writes to land first so we never overwrite an optimistic change
    refreshTimer = setTimeout(flushRefresh, 300);
    return;
  }
  const ids = [...refreshIds];
  refreshIds.clear();
  for (const id of ids) {
    try {
      const b = await fetchBundle(id);
      if (!b) {
        runRemote(() =>
          useStore.setState((s) => {
            const lobbies = { ...s.lobbies };
            delete lobbies[id];
            return { lobbies };
          }),
        );
      } else applyBundle(b);
    } catch (e) {
      console.error("[sync] refresh failed", e);
    }
  }
}

function applyBundle(b: BundleJson) {
  const { lobby, myVotes, voteOrder } = bundleToLobby(b, me);
  runRemote(() =>
    useStore.setState((s) => ({
      lobbies: { ...s.lobbies, [lobby.id]: lobby },
      votes: { ...s.votes, [voteKey(lobby)]: { answers: myVotes, order: voteOrder } },
    })),
  );
}

async function loadFriendsAndClans() {
  const [f, c, inv] = await Promise.all([sb().rpc("my_friends"), sb().rpc("my_clans"), sb().rpc("my_invites")]);
  const friends = ((must(f).data as FriendJson[]) ?? []).map(friendFromJson);
  const clans = ((must(c).data as ClanJson[]) ?? []).map(clanFromJson);
  // keep optimistic "pending" placeholders that the server hasn't answered yet
  runRemote(() =>
    useStore.setState((s) => ({
      friends: [...friends, ...s.friends.filter((x) => x.id.startsWith("f-") && !friends.some((y) => y.handle.toLowerCase() === x.handle.toLowerCase()))],
      clans,
    })),
  );
  const invites = (must(inv).data as { invite_id: string; lobby_id: string; lobby_name: string; emoji: string; by_name: string }[]) ?? [];
  for (const i of invites) {
    state().pushNotif({ id: `inv-${i.invite_id}`, type: "invite", who: i.by_name, title: "invited you to", highlight: `${i.emoji} ${i.lobby_name}`, body: "Tap join to hop in.", lobbyId: i.lobby_id });
  }
}

/** Loads everything the person can see. Called on start, after sign-in/out, and every 30 s as a safety net. */
export async function loadAll() {
  if (!me) return;
  try {
    await queue;
    const res = must(await sb().rpc("my_lobby_bundles"));
    const bundles = (res.data as BundleJson[]) ?? [];
    const lobbies: Record<string, Lobby> = {};
    const votes: Record<string, { answers: Record<string, "like" | "nope">; order: string[] }> = {};
    for (const b of bundles) {
      const { lobby, myVotes, voteOrder } = bundleToLobby(b, me);
      lobbies[lobby.id] = lobby;
      votes[voteKey(lobby)] = { answers: myVotes, order: voteOrder };
    }
    runRemote(() => useStore.setState({ lobbies, votes }));
    await loadFriendsAndClans();
  } catch (e) {
    console.error("[sync] loadAll failed", e);
  }
}

function scheduleFriendsRefresh() {
  clearTimeout(friendsTimer);
  friendsTimer = setTimeout(() => void loadFriendsAndClans().catch((e) => console.error(e)), 300);
}

/* ------------------------------------------------------------------ */
/* Outbound diffing                                                    */
/* ------------------------------------------------------------------ */
const nick = (l: Lobby) => {
  const mine = l.members.find((m) => m.id === "you");
  return mine && mine.name !== "You" ? mine.name : state().user.name || "Guest";
};

function createLobbyOnline(l: Lobby) {
  enqueue(
    "create lobby",
    async () => {
      let code = l.code;
      let res = await sb().from("lobbies").insert({ id: l.id, owner_id: me, ...lobbyRow(l) });
      if (res.error?.code === "23505") {
        // 6-digit code collided with another lobby — pick a new one
        code = String(Math.floor(100000 + Math.random() * 900000));
        res = await sb().from("lobbies").insert({ id: l.id, owner_id: me, ...lobbyRow({ ...l, code }) });
        runRemote(() => useStore.setState((s) => (s.lobbies[l.id] ? { lobbies: { ...s.lobbies, [l.id]: { ...s.lobbies[l.id], code } } } : s)));
      }
      must(res);
      must(await sb().from("lobby_members").insert({ lobby_id: l.id, user_id: me, nickname: nick(l), role: "owner", ready: l.ready.includes("you") }));
      if (l.items.length) must(await sb().from("lobby_items").insert(l.items.map((i) => itemRow(l.id, i, me))));
      if (l.invites.length) must(await sb().from("lobby_invites").insert(l.invites.map((i) => ({ id: i.id, lobby_id: l.id, handle: i.to, invited_by: me }))));
    },
    l.id,
  );
}

function diffOne(prev: Lobby, next: Lobby) {
  const id = next.id;

  if (lobbyEditable(prev) !== lobbyEditable(next)) {
    enqueue("update lobby", async () => void must(await sb().from("lobbies").update(lobbyRow(next)).eq("id", id)), id);
  }

  // roles first (an owner handing over must happen before they leave)
  const roleChanges = next.members.filter((m) => {
    const before = prev.members.find((x) => x.id === m.id);
    return before && before.role !== m.role;
  });
  roleChanges.sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  for (const m of roleChanges) {
    const uid = m.id === "you" ? me : m.id;
    if (isUuid(uid)) enqueue("change role", async () => void must(await sb().from("lobby_members").update({ role: m.role }).eq("lobby_id", id).eq("user_id", uid)), id);
  }

  // my own nickname / ready flag
  const pm = prev.members.find((m) => m.id === "you");
  const nm = next.members.find((m) => m.id === "you");
  if (pm && nm) {
    const patch: { nickname?: string; ready?: boolean } = {};
    if (nm.name !== pm.name && nm.name !== "You") patch.nickname = nm.name;
    if (prev.ready.includes("you") !== next.ready.includes("you")) patch.ready = next.ready.includes("you");
    if (Object.keys(patch).length) enqueue("update me", async () => void must(await sb().from("lobby_members").update(patch).eq("lobby_id", id).eq("user_id", me)), id);
  }

  // invites
  for (const i of next.invites) {
    if (!prev.invites.some((x) => x.id === i.id)) {
      enqueue("invite", async () => void must(await sb().from("lobby_invites").insert({ id: i.id, lobby_id: id, handle: i.to, invited_by: me })), id);
    }
  }
  for (const i of prev.invites) {
    if (!next.invites.some((x) => x.id === i.id)) enqueue("cancel invite", async () => void must(await sb().from("lobby_invites").delete().eq("id", i.id)), id);
  }

  // options
  for (const it of next.items) {
    const before = prev.items.find((x) => x.id === it.id);
    if (!before) enqueue("add option", async () => void must(await sb().from("lobby_items").insert(itemRow(id, it, me))), id);
    else if (itemEditable(before) !== itemEditable(it)) {
      const { title, kind, emoji, image, note, price, url, pos } = itemRow(id, it, me);
      enqueue("edit option", async () => void must(await sb().from("lobby_items").update({ title, kind, emoji, image, note, price, url, pos }).eq("id", it.id)), id);
    }
  }
  for (const it of prev.items) {
    if (!next.items.some((x) => x.id === it.id)) enqueue("remove option", async () => void must(await sb().from("lobby_items").delete().eq("id", it.id)), id);
  }

  // chat (my messages only)
  for (const c of next.chat) {
    if (c.mine && !prev.chat.some((x) => x.id === c.id)) {
      enqueue("send message", async () => void must(await sb().from("lobby_messages").insert({ id: c.id, lobby_id: id, user_id: me, from_name: nick(next), body: c.text })), id);
    }
  }

  // people removed, and me leaving — last, after any ownership hand-over
  for (const m of prev.members) {
    if (next.members.some((x) => x.id === m.id)) continue;
    const uid = m.id === "you" ? me : m.id;
    if (isUuid(uid)) enqueue("remove member", async () => void must(await sb().from("lobby_members").delete().eq("lobby_id", id).eq("user_id", uid)), id);
  }
}

function diffLobbies(prev: Record<string, Lobby>, next: Record<string, Lobby>) {
  for (const id of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const a = prev[id];
    const b = next[id];
    if (a === b) continue;
    if (!a && b) {
      if (isMember(b) && myRole(b) === "owner") createLobbyOnline(b);
    } else if (a && !b) {
      if (!isMember(a)) continue;
      if (myRole(a) === "owner") enqueue("delete lobby", async () => void must(await sb().from("lobbies").delete().eq("id", id)));
      else enqueue("leave lobby", async () => void must(await sb().from("lobby_members").delete().eq("lobby_id", id).eq("user_id", me)));
    } else if (a && b && isMember(a)) diffOne(a, b);
  }
}

type VoteMap = Record<string, { answers: Record<string, "like" | "nope"> }>;
function diffVotes(prev: VoteMap, next: VoteMap, lobbies: Record<string, Lobby>) {
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const [lobbyId, r] = key.split("#");
    const round = r ? Number(r) : 1;
    if (!lobbies[lobbyId] || !isMember(lobbies[lobbyId])) continue;
    const a = prev[key]?.answers ?? {};
    const b = next[key]?.answers ?? {};
    const upserts = Object.entries(b)
      .filter(([item, choice]) => a[item] !== choice)
      .map(([item, choice]) => ({ lobby_id: lobbyId, user_id: me, round, item_id: item, choice, updated_at: new Date().toISOString() }));
    const removed = Object.keys(a).filter((item) => !(item in b));
    if (upserts.length) {
      enqueue("save votes", async () => void must(await sb().from("lobby_votes").upsert(upserts, { onConflict: "lobby_id,user_id,round,item_id" })), lobbyId);
    }
    if (removed.length) {
      enqueue("undo votes", async () => void must(await sb().from("lobby_votes").delete().eq("lobby_id", lobbyId).eq("user_id", me).eq("round", round).in("item_id", removed)), lobbyId);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Profile, friends, clans (explicit calls from the store)             */
/* ------------------------------------------------------------------ */
function registerHooks() {
  net.profileSave = (u: User) => {
    if (!me) return;
    enqueue("save profile", async () => void must(await sb().from("profiles").update({ name: u.name, bio: u.bio, avatar: u.avatar }).eq("id", me)));
  };

  net.friendRequest = (localId, handle) => {
    enqueue("friend request", async () => {
      const res = must(await sb().rpc("send_friend_request", { q: handle }));
      const r = res.data as string;
      if (r === "not_found" || r === "self") {
        runRemote(() => useStore.setState((s) => ({ friends: s.friends.filter((f) => f.id !== localId) })));
        state().toast(r === "self" ? "That's you!" : "No one found with that email or username.", "warn");
      } else if (r === "duplicate") {
        runRemote(() => useStore.setState((s) => ({ friends: s.friends.filter((f) => f.id !== localId) })));
        state().toast("You're already friends, or a request is pending.", "info");
      } else {
        runRemote(() => useStore.setState((s) => ({ friends: s.friends.filter((f) => f.id !== localId) })));
        await loadFriendsAndClans();
      }
    });
  };

  net.friendRespond = (f, accept) => {
    enqueue("friend respond", async () => {
      if (accept) must(await sb().from("friendships").update({ status: "accepted" }).eq("requester", f.id).eq("addressee", me));
      else must(await sb().from("friendships").delete().eq("requester", f.id).eq("addressee", me));
      await loadFriendsAndClans();
    });
  };

  net.friendRemove = (f) => {
    if (!isUuid(f.id)) return;
    enqueue("remove friend", async () => {
      must(await sb().from("friendships").delete().or(`and(requester.eq.${me},addressee.eq.${f.id}),and(requester.eq.${f.id},addressee.eq.${me})`));
    });
  };

  net.clanSave = (clan) => {
    enqueue("save clan", async () => {
      must(await sb().from("clans").upsert({ id: clan.id, owner_id: me, name: clan.name, emoji: clan.emoji, description: clan.description }, { onConflict: "id" }));
      must(await sb().from("clan_members").delete().eq("clan_id", clan.id));
      const rows = clan.memberIds.filter(isUuid).map((user_id) => ({ clan_id: clan.id, user_id }));
      if (rows.length) must(await sb().from("clan_members").insert(rows));
    });
  };

  net.clanDelete = (id) => {
    enqueue("delete clan", async () => void must(await sb().from("clans").delete().eq("id", id)));
  };

  net.refreshLobby = (id) => scheduleRefresh(id);
}

/* ------------------------------------------------------------------ */
/* Session, profile, realtime                                          */
/* ------------------------------------------------------------------ */
async function ensureProfile(session: Session): Promise<User> {
  const uid = session.user.id;
  const meta = (session.user.user_metadata ?? {}) as { name?: string };
  const guest = !!session.user.is_anonymous;
  let { data: p } = await sb().from("profiles").select("name, handle, bio, avatar").eq("id", uid).maybeSingle();
  if (!p) {
    const name = meta.name || (guest ? "Guest" : (session.user.email?.split("@")[0] ?? "Player"));
    must(await sb().from("profiles").insert({ id: uid, name }));
    p = { name, handle: null, bio: "", avatar: "" };
  }
  if (!guest && session.user.email) {
    await sb().from("private_emails").upsert({ user_id: uid, email: session.user.email }, { onConflict: "user_id" });
    if (!p.handle) {
      const base = (session.user.email.split("@")[0] ?? "player").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "player";
      for (const candidate of [base, `${base}${Math.floor(100 + Math.random() * 900)}`, `${base}${Math.floor(1000 + Math.random() * 9000)}`]) {
        const r = await sb().from("profiles").update({ handle: candidate }).eq("id", uid);
        if (!r.error) {
          p.handle = candidate;
          break;
        }
      }
    }
  }
  const user = guest ? { ...guestUser(), name: p.name || "Guest" } : { name: p.name, email: session.user.email ?? "", bio: p.bio ?? "", avatar: p.avatar ?? "" };
  return { ...user, id: uid, guest, handle: p.handle ?? undefined } as User;
}

async function afterAuth(session: Session) {
  me = session.user.id;
  const user = await ensureProfile(session);
  useStore.setState({ user });
  await loadAll();

  if (started) return;
  started = true;
  registerHooks();

  // outbox: every local change becomes a database write
  useStore.subscribe((s, p) => {
    if (isRemoteUpdate() || !me) return;
    if (s.lobbies !== p.lobbies) diffLobbies(p.lobbies, s.lobbies);
    if (s.votes !== p.votes) diffVotes(p.votes, s.votes, s.lobbies);
  });

  // inbox: realtime
  const ch = sb().channel("matchup-changes");
  for (const table of ["lobbies", "lobby_members", "lobby_invites", "lobby_items", "lobby_messages", "lobby_votes"]) {
    ch.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      const row = ((payload.new && Object.keys(payload.new).length ? payload.new : payload.old) ?? {}) as { id?: string; lobby_id?: string };
      const lobbyId = table === "lobbies" ? row.id : row.lobby_id;
      if (lobbyId) scheduleRefresh(lobbyId);
      else void loadAll();
      if (table === "lobby_invites") scheduleFriendsRefresh();
    });
  }
  for (const table of ["friendships", "clans", "clan_members"]) {
    ch.on("postgres_changes", { event: "*", schema: "public", table }, () => scheduleFriendsRefresh());
  }
  ch.subscribe();

  // safety net if realtime is off or a message is missed
  const refreshAll = () => {
    if (document.visibilityState === "visible" && pending === 0) void loadAll();
  };
  setInterval(refreshAll, 30_000);
  document.addEventListener("visibilitychange", refreshAll);

  sb().auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY") {
      useBackend.setState({ recovery: true });
    } else if (event === "SIGNED_OUT") {
      me = "";
    } else if (s && (s.user.id !== me || event === "USER_UPDATED")) {
      if (me && s.user.id !== me) clearLocalData();
      void afterAuth(s).catch((e) => console.error("[auth] refresh failed", e));
    }
  });
}

/** Signs in (as an anonymous guest if nobody is signed in) and loads the person's data. */
let bootPromise: Promise<void> | null = null;
export function bootBackend(force = false): Promise<void> {
  if (!IS_BACKEND) return Promise.resolve();
  if (!bootPromise || force) bootPromise = doBoot();
  return bootPromise;
}

async function doBoot() {
  const set = useBackend.setState;
  set({ phase: "booting", error: "" });
  try {
    let { data } = await sb().auth.getSession();
    if (!data.session) {
      const r = await sb().auth.signInAnonymously();
      if (r.error) {
        throw new Error(
          /anonymous/i.test(r.error.message)
            ? "Guest sign-in is turned off in Supabase. Enable Authentication → Sign In / Providers → Anonymous sign-ins."
            : r.error.message,
        );
      }
      data = { session: r.data.session };
    }
    if (!data.session) throw new Error("Couldn't start a session.");
    await afterAuth(data.session);
    useStore.setState({ booted: true });
    set({ phase: "ready" });
  } catch (e) {
    console.error("[boot]", e);
    bootPromise = null;
    set({ phase: "error", error: e instanceof Error ? e.message : "Couldn't reach the backend." });
  }
}

/** Wipes the on-screen data of the previous person (used on sign-out / account switch). */
export function clearLocalData() {
  runRemote(() => useStore.setState({ lobbies: {}, votes: {}, friends: [], clans: [], notifs: [] }));
}

/** Waits until every queued write has reached the server. */
export async function flushWrites() {
  await queue;
}
