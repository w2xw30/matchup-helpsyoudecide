import type { Lobby, LobbyItem, Role } from "../data/mock";

export const myRole = (l?: Lobby): Role | null => l?.members.find((m) => m.id === "you")?.role ?? null;
export const isMember = (l?: Lobby) => myRole(l) !== null;
export const isAdmin = (l?: Lobby) => {
  const r = myRole(l);
  return r === "owner" || r === "admin";
};
export const isOwner = (l?: Lobby) => myRole(l) === "owner";
/** Options can't change while voting is open, so everyone votes on the same deck. */
export const canAddItems = (l?: Lobby) => !!l && isMember(l) && !l.locked && l.phase !== "voting" && (isAdmin(l) || l.allowFriends);
export const canEditItem = (l: Lobby | undefined, item: LobbyItem) => !!l && !l.locked && l.phase !== "voting" && (isAdmin(l) || item.byId === "you");
export const roleLabel = (r: Role) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");
