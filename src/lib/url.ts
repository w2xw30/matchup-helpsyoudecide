import type { Lobby } from "../data/mock";

export const inviteUrl = (lobby: Lobby) => `${window.location.origin}/join/${lobby.id}`;
export const inviteDisplay = (lobby: Lobby) => `${window.location.host}/join/${lobby.id}`;
