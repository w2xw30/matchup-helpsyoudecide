import jsQR from "jsqr";

export type ScanTarget = { kind: "id"; value: string } | { kind: "code"; value: string };

/** Understands our invite URLs (…/join/<id> or …/lobby/<id>) and bare 6-digit session codes. */
export function parseScan(text: string): ScanTarget | null {
  const t = text.trim();
  const m = t.match(/(?:\/join|\/lobby)\/([a-z0-9-]+)/i);
  if (m) return { kind: "id", value: m[1] };
  const digits = t.replace(/\D/g, "");
  if (/^\d{6}$/.test(t) || (digits.length === 6 && /^[\d\s-]+$/.test(t))) return { kind: "code", value: digits };
  return null;
}

/** Decodes a QR code from raw pixels, or returns null. */
export function decodeQr(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Decodes a QR code from an image file (used for the "scan from a photo" fallback). */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  return decodeQr(img.data, w, h);
}
