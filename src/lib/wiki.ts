import { KIND_META, guessVisual, type ItemKind, type LobbyKind } from "./catalog";

export interface Suggestion {
  title: string;
  desc?: string;
  image?: string;
  emoji: string;
  kind: ItemKind;
  source: "catalog" | "wiki";
}

const HINT: Partial<Record<LobbyKind, string>> = { movie: " film", game: " game" };
const cache = new Map<string, Suggestion[]>();

const clean = (t: string) => t.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();

/**
 * Image + description suggestions for a free-text query.
 * Provider is Wikipedia's public search API (no key, CORS-enabled). Swap this function for a
 * server endpoint (Places / TMDB / IGDB / Unsplash) once there is a backend.
 */
export async function searchSuggestions(query: string, lobbyKind: LobbyKind, signal?: AbortSignal): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `${lobbyKind}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fallback: ItemKind = lobbyKind === "mixed" ? "other" : lobbyKind;
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=7&redirects=1" +
    `&gsrsearch=${encodeURIComponent(q + (HINT[lobbyKind] ?? ""))}&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=640`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Suggestion lookup failed (${res.status})`);
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { index: number; title: string; description?: string; thumbnail?: { source: string } }> };
  };
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);

  const out: Suggestion[] = [];
  for (const p of pages) {
    const desc = p.description ?? "";
    if (/disambiguation|Topics referred|^List of|^History of|^Index of/i.test(`${p.title} ${desc}`)) continue;
    const title = clean(p.title);
    if (!title || out.some((o) => o.title.toLowerCase() === title.toLowerCase())) continue;
    const v = guessVisual(`${title} ${desc}`, fallback);
    const thumb = p.thumbnail?.source;
    out.push({
      title,
      desc: desc || undefined,
      image: thumb && !/\.svg/i.test(thumb) ? thumb : undefined,
      emoji: v.matched ? v.emoji : KIND_META[v.kind].emoji,
      kind: v.kind,
      source: "wiki",
    });
    if (out.length >= 5) break;
  }
  cache.set(key, out);
  return out;
}
