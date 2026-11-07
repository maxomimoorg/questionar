// Compatibility maths: base formula plus the interpolation curves for critical questions.
// Similarity questions compare the two answers directly; reciprocal questions compare
// crosswise what one person likes to give ("Fare") with what the other likes to receive
// ("Ricevere"), with exactly the same curves. When a side has no answer yet, only the
// computable flows count and the result is flagged as a partial estimate.

import { questionType, type QuestionType } from "./questions";
import { giveOf, receiveOf, type Answer } from "./types";

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

const mean = (values: number[]) => Math.round(values.reduce((s, v) => s + v, 0) / values.length);

/** Compatibility of a single question between two answers, given how many people flagged it critical. */
export function questionCompat(a: number, b: number, criticalCount: number): number {
  const gap = Math.abs(a - b);
  if (criticalCount <= 0) return 100 - gap;
  if (criticalCount === 1) return interpolate(CURVE_ONE, gap);
  if (criticalCount === 2) return interpolate(CURVE_TWO, gap);
  return interpolate(CURVE_THREE, gap);
}

/**
 * A score plus whether it is only an estimate because some Fare/Ricevere side is missing.
 * `margin` is the worst-case error in points: how far the true score could move once every
 * missing side is answered (0 for complete answers).
 */
export type CompatResult = { score: number; partial: boolean; margin: number };

export type ReciprocalFlows = {
  /** What A likes to give vs what B likes to receive; null when one of the two is unanswered. */
  aToB: number | null;
  /** What B likes to give vs what A likes to receive; null when one of the two is unanswered. */
  bToA: number | null;
  /** Rounded mean of the known flows; null when no flow can be computed. */
  score: number | null;
  /** True when only one of the two flows is known: the score is an estimate. */
  partial: boolean;
  /** Worst-case error of the estimate, in points (0 when both flows are known). */
  margin: number;
};

/** One direction of a reciprocal question: giver's Fare vs receiver's Ricevere. */
export function flowCompat(giver: Answer, receiver: Answer, criticalCount: number): number | null {
  const give = giveOf(giver);
  const receive = receiveOf(receiver);
  if (give === undefined || receive === undefined) return null;
  return questionCompat(give, receive, criticalCount);
}

/** Lowest and highest score a single unknown flow could still reach (gap 100 / gap 0). */
function flowRange(criticalCount: number): [number, number] {
  return [questionCompat(0, 100, criticalCount), questionCompat(0, 0, criticalCount)];
}

/** Score of the known values plus worst-case margin against the possible [low, high] range. */
function withMargin(score: number, low: number, high: number): number {
  return Math.round(Math.max(score - low, high - score, 0));
}

type Range = { score: number | null; low: number; high: number };

function pairRange(a: Answer, b: Answer, criticalCount: number, type: QuestionType): Range {
  if (type !== "reciprocal") {
    const s = questionCompat(a.value, b.value, criticalCount);
    return { score: s, low: s, high: s };
  }
  const [lo, hi] = flowRange(criticalCount);
  const flows = [flowCompat(a, b, criticalCount), flowCompat(b, a, criticalCount)];
  const known = flows.filter((v): v is number => v !== null);
  const lows = flows.map((v) => v ?? lo);
  const highs = flows.map((v) => v ?? hi);
  return {
    score: known.length === 0 ? null : mean(known),
    low: lows.reduce((x, y) => x + y, 0) / 2,
    high: highs.reduce((x, y) => x + y, 0) / 2,
  };
}

/** Crosswise comparison of a reciprocal question between two answers. */
export function reciprocalFlows(a: Answer, b: Answer, criticalCount: number): ReciprocalFlows {
  const aToB = flowCompat(a, b, criticalCount);
  const bToA = flowCompat(b, a, criticalCount);
  const known = [aToB, bToA].filter((v): v is number => v !== null);
  const range = pairRange(a, b, criticalCount, "reciprocal");
  const score = known.length === 0 ? null : mean(known);
  return {
    aToB,
    bToA,
    score,
    partial: known.length === 1,
    margin: score === null || known.length === 2 ? 0 : withMargin(score, range.low, range.high),
  };
}

/** Compatibility of one question between two answers, according to its type. */
export function pairCompatDetail(
  a: Answer,
  b: Answer,
  criticalCount: number,
  type: QuestionType,
): CompatResult | null {
  const r = pairRange(a, b, criticalCount, type);
  if (r.score === null) return null;
  const margin = withMargin(r.score, r.low, r.high);
  return { score: r.score, partial: margin > 0, margin };
}

/** Score-only version of pairCompatDetail (null when nothing can be compared). */
export function pairCompat(
  a: Answer,
  b: Answer,
  criticalCount: number,
  type: QuestionType,
): number | null {
  return pairCompatDetail(a, b, criticalCount, type)?.score ?? null;
}

export type Participant = { answers: Record<string, Answer> };

/**
 * Average pairwise compatibility for one question across 2 or 3 participants. Pairs whose
 * reciprocal flows cannot be computed are left out of the score, make the result partial and
 * widen its margin with their full possible range.
 */
export function multiCompatDetail(
  questionId: string,
  participants: Participant[],
  type: QuestionType = questionType(questionId),
): CompatResult | null {
  const rows = participants.map((p) => p.answers[questionId]);
  if (rows.some((r) => !r || !r.answered || r.hidden)) return null;
  const criticalCount = rows.filter((r) => r!.critical).length;
  const ranges: Range[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      ranges.push(pairRange(rows[i]!, rows[j]!, criticalCount, type));
    }
  }
  const scores = ranges.map((r) => r.score).filter((v): v is number => v !== null);
  if (scores.length === 0) return null;
  const score = mean(scores);
  const low = ranges.reduce((s, r) => s + r.low, 0) / ranges.length;
  const high = ranges.reduce((s, r) => s + r.high, 0) / ranges.length;
  const margin = withMargin(score, low, high);
  return { score, partial: margin > 0 || scores.length < ranges.length, margin };
}

/** Score-only version of multiCompatDetail. */
export function multiCompat(
  questionId: string,
  participants: Participant[],
  type: QuestionType = questionType(questionId),
): number | null {
  return multiCompatDetail(questionId, participants, type)?.score ?? null;
}

export type AverageResult = {
  score: number;
  /** How many of the averaged questions are partial estimates. */
  partialCount: number;
  /** Worst-case error of the average: mean of the per-question margins. */
  margin: number;
};

/** Average over a list of question ids, partial estimates included; null when nothing comparable. */
export function averageCompatDetail(
  questionIds: string[],
  participants: Participant[],
): AverageResult | null {
  const results = questionIds
    .map((id) => multiCompatDetail(id, participants))
    .filter((v): v is CompatResult => v !== null);
  if (results.length === 0) return null;
  return {
    score: mean(results.map((r) => r.score)),
    partialCount: results.filter((r) => r.partial).length,
    margin: mean(results.map((r) => r.margin)),
  };
}

/** Score-only version of averageCompatDetail. */
export function averageCompat(questionIds: string[], participants: Participant[]): number | null {
  return averageCompatDetail(questionIds, participants)?.score ?? null;
}

/** Display text for a score (the coloured part); the margin is shown apart by formatMargin. */
export function formatCompat(result: { score: number } | null): string {
  return result ? `${result.score}%` : "–";
}

/** Uncoloured error margin of an estimate, e.g. "±23%"; empty for exact scores. */
export function formatMargin(result: { margin?: number } | null): string {
  return result && (result.margin ?? 0) > 0 ? `±${result.margin}%` : "";
}
