// Compatibility maths: base formula plus the interpolation curves for critical questions.

import type { Answer } from "./types";

type Point = { gap: number; compat: number };

const CURVE_ONE: Point[] = [
  { gap: 0, compat: 110 },
  { gap: 5, compat: 100 },
  { gap: 55, compat: 25 },
  { gap: 75, compat: 0 },
  { gap: 100, compat: -25 },
];

const CURVE_TWO: Point[] = [
  { gap: 0, compat: 120 },
  { gap: 5, compat: 100 },
  { gap: 55, compat: 20 },
  { gap: 75, compat: -5 },
  { gap: 100, compat: -30 },
];

const CURVE_THREE: Point[] = [
  { gap: 0, compat: 130 },
  { gap: 5, compat: 100 },
  { gap: 55, compat: 15 },
  { gap: 75, compat: -10 },
  { gap: 100, compat: -40 },
];

function interpolate(points: Point[], gap: number): number {
  const g = Math.min(100, Math.max(0, gap));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (g >= a.gap && g <= b.gap) {
      const t = (g - a.gap) / (b.gap - a.gap);
      return Math.round(a.compat + (b.compat - a.compat) * t);
    }
  }
  return points[points.length - 1]!.compat;
}

/** Compatibility of a single question between two answers, given how many people flagged it critical. */
export function questionCompat(a: number, b: number, criticalCount: number): number {
  const gap = Math.abs(a - b);
  if (criticalCount <= 0) return 100 - gap;
  if (criticalCount === 1) return interpolate(CURVE_ONE, gap);
  if (criticalCount === 2) return interpolate(CURVE_TWO, gap);
  return interpolate(CURVE_THREE, gap);
}

export type Participant = { answers: Record<string, Answer> };

/** Average pairwise compatibility for one question across 2 or 3 participants. */
export function multiCompat(
  questionId: string,
  participants: Participant[],
): number | null {
  const rows = participants.map((p) => p.answers[questionId]);
  if (rows.some((r) => !r || !r.answered || r.hidden)) return null;
  const criticalCount = rows.filter((r) => r!.critical).length;
  const scores: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      scores.push(questionCompat(rows[i]!.value, rows[j]!.value, criticalCount));
    }
  }
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

/** Average over a list of question ids; null when nothing comparable. */
export function averageCompat(
  questionIds: string[],
  participants: Participant[],
): number | null {
  const values = questionIds
    .map((id) => multiCompat(id, participants))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
