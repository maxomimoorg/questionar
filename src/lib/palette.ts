// The nine original brand colours. Single source of truth for bio text colours,
// background tint and highlighted elements.
export const PALETTE: { label: string; hex: string }[] = [
  { label: "Rosso", hex: "#ff3131" },
  { label: "Arancione", hex: "#ff751f" },
  { label: "Giallo", hex: "#ffde59" },
  { label: "Verde", hex: "#7ed957" },
  { label: "Azzurro", hex: "#0cc0df" },
  { label: "Turchese", hex: "#0097b2" },
  { label: "Blu", hex: "#004aad" },
  { label: "Viola", hex: "#cb6ce6" },
  { label: "Rosa", hex: "#ff66c4" },
];

export const DEFAULT_THEME_COLOR = "#ff3131";

/** Returns the palette hex if valid, otherwise the default red. */
export function validPaletteColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_THEME_COLOR;
  const v = value.toLowerCase();
  return PALETTE.some((p) => p.hex === v) ? v : DEFAULT_THEME_COLOR;
}

/** Black or white text, whichever contrasts best with the given hex. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
}
