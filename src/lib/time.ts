/** "2M AGO" / "3H AGO" / "YESTERDAY" — matches the notification design's small caps timestamps. */
export function timeAgo(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "JUST NOW";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}M AGO`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.round(h / 24);
  return d === 1 ? "YESTERDAY" : `${d}D AGO`;
}
