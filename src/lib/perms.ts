import type { Lobby, LobbyItem, Role } from "../data/mock";

export const myRole = (l?: Lobby): Role | null => l?.members.find((m) => m.id === "you")?.role ?? null;
export const isMember = (l?: Lobby) => myRole(l) !== null;
export const isAdmin = (l?: Lobby) => {
  const r = myRole(l);
  return r === "owner" || r === "admin";
};
export const isOwner = (l?: Lobby) => myRole(l) === "owner";
export const canAddItems = (l?: Lobby) => !!l && isMember(l) && !l.locked && (isAdmin(l) || l.allowFriends);
export const canEditItem = (l: Lobby | undefined, item: LobbyItem) => !!l && !l.locked && (isAdmin(l) || item.byId === "you");
export const roleLabel = (r: Role) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");
