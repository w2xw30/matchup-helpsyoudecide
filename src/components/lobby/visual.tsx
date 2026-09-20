import { useState, type CSSProperties } from "react";
import { KIND_META, type ItemKind } from "../../lib/catalog";
import type { LobbyItem } from "../../data/mock";

type Visual = Pick<LobbyItem, "image" | "emoji" | "kind" | "title">;

const tint = (kind: ItemKind): CSSProperties => ({
  background: `linear-gradient(135deg, ${KIND_META[kind].from}, ${KIND_META[kind].to})`,
});

/** Small square/round thumbnail: the photo if there is one (and it loads), otherwise the emoji on a category tint. */
export function ItemThumb({ item, size = 40, round = true }: { item: Visual; size?: number; round?: boolean }) {
  const [bad, setBad] = useState(false);
  const radius = round ? "50%" : Math.round(size * 0.28);
  return (
    <span className="thumb" style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.52, ...tint(item.kind) }} aria-hidden>
      {item.image && !bad ? <img src={item.image} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} draggable={false} /> : item.emoji}
    </span>
  );
}

/** Large hero art used on swipe cards. */
export function ItemArt({ item }: { item: Visual }) {
  const [bad, setBad] = useState(false);
  if (item.image && !bad) {
    return <img src={item.image} alt={item.title} referrerPolicy="no-referrer" onError={() => setBad(true)} draggable={false} />;
  }
  return (
    <div className="item-art" style={tint(item.kind)} role="img" aria-label={item.title}>
      <span>{item.emoji}</span>
    </div>
  );
}
