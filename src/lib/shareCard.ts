import type { LobbyItem } from "../data/mock";
import { KIND_META } from "./catalog";

interface CardInput {
  item: Pick<LobbyItem, "title" | "emoji" | "image" | "kind">;
  lobbyName: string;
  headline: string;
  detail: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…");
  }
  return lines;
}

/** Draws a shareable 1080×1350 result card and returns it as a PNG data URL. */
export async function makeShareImage({ item, lobbyName, headline, detail }: CardInput): Promise<string> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const tint = KIND_META[item.kind];
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, tint.from);
  bg.addColorStop(1, tint.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // card
  const cx = 90;
  const cy = 150;
  const cw = W - 180;
  const ch = 1010;
  ctx.save();
  ctx.shadowColor = "rgba(40,30,70,0.18)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cx, cy, cw, ch, 56);
  ctx.fill();
  ctx.restore();

  // hero area
  const hh = 560;
  ctx.save();
  roundRect(ctx, cx, cy, cw, ch, 56);
  ctx.clip();
  let drewPhoto = false;
  if (item.image) {
    try {
      const img = await loadImage(item.image);
      const scale = Math.max(cw / img.width, hh / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, cx + (cw - w) / 2, cy + (hh - h) / 2, w, h);
      drewPhoto = true;
    } catch {
      /* fall back to the emoji tile */
    }
  }
  if (!drewPhoto) {
    const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + hh);
    g.addColorStop(0, tint.from);
    g.addColorStop(1, tint.to);
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, cw, hh);
    ctx.font = "260px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(item.emoji, cx + cw / 2, cy + hh / 2 + 10);
  }
  ctx.restore();

  // text
  const font = "Poppins, 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#b12b37";
  ctx.font = `600 30px ${font}`;
  ctx.fillText(headline.toUpperCase(), cx + 56, cy + hh + 90);

  ctx.fillStyle = "#1a1a1f";
  ctx.font = `300 76px ${font}`;
  const lines = wrap(ctx, item.title, cw - 112, 2);
  lines.forEach((l, i) => ctx.fillText(l, cx + 56, cy + hh + 190 + i * 88));

  ctx.fillStyle = "#4e4448";
  ctx.font = `400 34px ${font}`;
  ctx.fillText(detail, cx + 56, cy + hh + 190 + lines.length * 88 + 30);

  // footer
  ctx.fillStyle = "#2d3a80";
  ctx.font = `400 44px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("Matchup", W / 2, H - 100);
  ctx.fillStyle = "#756b70";
  ctx.font = `400 28px ${font}`;
  ctx.fillText(lobbyName, W / 2, H - 56);

  return canvas.toDataURL("image/png");
}
