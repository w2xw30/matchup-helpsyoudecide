import { useEffect, useState } from "react";
import { sb } from "./client";
import { IS_BACKEND } from "./config";
import { flushWrites, loadAll } from "./sync";

export interface LobbyPreview {
  id: string;
  name: string;
  emoji: string;
  description: string;
  kind: string;
  member_count: number;
  max_members: number;
  link_access: boolean;
  is_member: boolean;
}

/** Public info about a lobby, shown on the invite page before someone has joined. */
export async function previewLobby(id: string): Promise<LobbyPreview | null> {
  const { data, error } = await sb().rpc("lobby_preview", { l: id });
  if (error) throw new Error(error.message);
  return (data as LobbyPreview | null) ?? null;
}

/** Turns a 6-digit session code into a lobby id (null when it doesn't match a joinable lobby). */
export async function lobbyIdForCode(code: string): Promise<string | null> {
  const { data, error } = await sb().rpc("lobby_id_for_code", { c: code });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export type JoinResult = "ok" | "full" | "closed" | "not_found" | "error";

/** Joins a lobby with a nickname, then loads it into the app. */
export async function joinOnline(id: string, nickname: string): Promise<JoinResult> {
  await flushWrites();
  const { data, error } = await sb().rpc("join_lobby", { l: id, nick: nickname });
  if (error) return "error";
  const r = data as string;
  if (r === "ok") {
    await loadAll();
    return "ok";
  }
  return r === "full" || r === "closed" || r === "not_found" ? r : "error";
}

/** Loads the invite preview when the lobby isn't already in the local store. Not used in local mode. */
export function useLobbyPreview(id: string, skip: boolean) {
  const [state, setState] = useState<{ id: string; status: "loading" | "ready" | "missing" | "error"; preview: LobbyPreview | null }>({ id, status: "loading", preview: null });
  useEffect(() => {
    if (!IS_BACKEND || skip) return;
    let live = true;
    previewLobby(id)
      .then((p) => live && setState({ id, status: p ? "ready" : "missing", preview: p }))
      .catch(() => live && setState({ id, status: "error", preview: null }));
    return () => {
      live = false;
    };
  }, [id, skip]);
  return state.id === id ? state : { id, status: "loading" as const, preview: null };
}
