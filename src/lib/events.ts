import type { Lobby } from "../data/mock";
import { useStore } from "../store/useStore";
import { isAdmin, isMember, myRole } from "./perms";

/**
 * Turns real changes into notifications. It watches the store (local simulation and server updates
 * both flow through it), compares the previous and next state, and reports things that happened
 * *to* the person — someone joined, everyone is ready, a decision was made, their role changed.
 * Their own actions never notify them.
 */
function diffLobby(id: string, prev: Lobby, next: Lobby) {
  const { pushNotif, user } = useStore.getState();
  const me = next.members.find((m) => m.id === "you");
  const myName = me && me.name !== "You" ? me.name : user.name;
  const link = { lobbyId: id };

  for (const m of next.members) {
    if (m.id === "you" || prev.members.some((x) => x.id === m.id)) continue;
    pushNotif({
      id: `join-${id}-${m.id}`,
      type: "group",
      avatar: m.avatar,
      title: `${m.fullName ?? m.name} joined`,
      highlight: next.name,
      body: `${next.members.length} people are in the lobby now.`,
      ...link,
    });
  }

  const allBefore = prev.members.length > 0 && prev.ready.length >= prev.members.length;
  const allNow = next.members.length > 1 && next.ready.length >= next.members.length;
  if (allNow && !allBefore) {
    pushNotif({ id: `ready-${id}-${Math.floor(Date.now() / 60000)}`, type: "ready", title: "Everyone is ready in", highlight: next.name, body: "Time to start voting.", ...link });
  }

  const roleBefore = myRole(prev);
  const roleNow = myRole(next);
  if (roleBefore && roleNow && roleBefore !== roleNow && (roleNow === "admin" || roleNow === "owner")) {
    pushNotif({
      id: `role-${id}-${roleNow}-${Math.floor(Date.now() / 4096)}`,
      type: "role",
      title: roleNow === "owner" ? "You're now the owner of" : "You're now an admin of",
      highlight: next.name,
      body: "You can manage members and settings.",
      ...link,
    });
  }

  if (!prev.decision && next.decision && next.decision.byName !== myName) {
    pushNotif({
      id: `decision-${id}-${next.decision.at}`,
      type: "decision",
      title: "The group picked",
      highlight: `${next.decision.emoji} ${next.decision.title}`,
      body: `${next.decision.likes} of ${next.decision.voters} said yes in ${next.name}.`,
      ...link,
    });
  }

  if (prev.phase !== "voting" && next.phase === "voting" && next.round === prev.round && !isAdmin(next)) {
    pushNotif({ id: `voting-${id}-${next.round}-${Math.floor(Date.now() / 60000)}`, type: "ready", title: "Voting has started in", highlight: next.name, body: "Swipe through the options — results appear once everyone finishes.", ...link });
  }

  if (next.round > prev.round && !isAdmin(next)) {
    pushNotif({ id: `runoff-${id}-${next.round}`, type: "decision", title: "Runoff round started in", highlight: next.name, body: "Only the top options are left — cast your vote.", ...link });
  }

  for (const it of next.items) {
    if (it.byId === "you" || prev.items.some((x) => x.id === it.id)) continue;
    pushNotif({ id: `item-${it.id}`, type: "item", title: `${it.by} added`, highlight: it.title, body: `to ${next.name}`, ...link });
  }
}

let stop: (() => void) | null = null;

export function startWatchers() {
  if (stop) return stop;
  const unsub = useStore.subscribe((s, p) => {
    if (s.lobbies !== p.lobbies) {
      for (const [id, next] of Object.entries(s.lobbies)) {
        const prev = p.lobbies[id];
        if (prev && isMember(prev) && isMember(next)) diffLobby(id, prev, next);
      }
    }
    if (s.friends !== p.friends) {
      for (const f of s.friends) {
        const was = p.friends.find((x) => x.id === f.id);
        if (was?.status === "pending" && f.status === "friend") {
          useStore.getState().pushNotif({ id: `fr-acc-${f.id}`, type: "friend", avatar: f.avatar, title: `${f.name} accepted your friend request`, body: "You can now invite them to lobbies.", to: "/groups?tab=friends" });
        } else if (!was && f.status === "incoming") {
          useStore.getState().pushNotif({ id: `fr-in-${f.id}`, type: "friend", avatar: f.avatar, title: `${f.name} sent you a friend request`, body: "Accept to invite each other to lobbies.", to: "/groups?tab=friends" });
        }
      }
    }
  });
  stop = () => {
    unsub();
    stop = null;
  };
  return stop;
}
