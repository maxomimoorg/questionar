/**
 * The QR library only understands hex colours, while the theme uses CSS tokens (some in oklch).
 * The browser canvas resolves any CSS colour, so one painted pixel gives us its exact hex value.
 */
export function cssTokenToHex(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = raw; // an unparsable value leaves the fallback in place
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

/** High-contrast structural ink on the card surface, following the current day/night theme. */
export function qrColors(): { dark: string; light: string } {
  return {
    dark: cssTokenToHex("--qr-ink", "#2F5257"),
    light: cssTokenToHex("--qr-paper", "#FFFFFF"),
  };
}
