// Dynamic colour gradation used by every percentage figure and slider track.
// 0% red -> 25% orange -> 50% yellow -> 75% green -> 100% turquoise.
// Negative values fade from dark red to violet.

type RGB = [number, number, number];

const POSITIVE_STOPS: { at: number; rgb: RGB }[] = [
  { at: 0, rgb: [226, 62, 62] },
  { at: 25, rgb: [235, 141, 52] },
  { at: 50, rgb: [231, 200, 60] },
  { at: 75, rgb: [104, 197, 96] },
  { at: 100, rgb: [52, 200, 196] },
];

const NEGATIVE_STOPS: { at: number; rgb: RGB }[] = [
  { at: 0, rgb: [150, 26, 26] },
  { at: -40, rgb: [124, 32, 140] },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export function percentColor(value: number): string {
  const stops = value < 0 ? NEGATIVE_STOPS : POSITIVE_STOPS;
  const v = value < 0 ? Math.max(value, -40) : Math.min(Math.max(value, 0), 100);

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    const inRange = value < 0 ? v <= a.at && v >= b.at : v >= a.at && v <= b.at;
    if (inRange) {
      const span = b.at - a.at;
      const t = span === 0 ? 0 : (v - a.at) / span;
      const [r, g, bl] = mix(a.rgb, b.rgb, t);
      return `rgb(${r} ${g} ${bl})`;
    }
  }
  const last = stops[stops.length - 1]!.rgb;
  return `rgb(${last[0]} ${last[1]} ${last[2]})`;
}

export function thumbGlyph(value: number): "check" | "cross" | "question" {
  if (value > 74) return "check";
  if (value < 26) return "cross";
  return "question";
}
