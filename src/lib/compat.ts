// Compatibility maths: base formula plus the interpolation curves for critical questions.
// Similarity questions compare the two answers directly; reciprocal questions compare
// crosswise what one person likes to give ("Fare") with what the other likes to receive
// ("Ricevere"), with exactly the same curves. When a side has no answer yet, only the
// computable flows count and the result is flagged as a partial estimate.

import {
  categoryOfId,
  resolveQuestionType,
  sectionOfCategory,
  type ProtectedSection,
  type QuestionDefinition,
  type QuestionType,
} from "./questions";
import { categoryAverages } from "./protection";
import {
  giveOf,
  receiveOf,
  type Answer,
  type CategoryAggregate,
  type CategoryAverages,
} from "./types";

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

/**
 * `hiddenCategories`: a question in one of these is left out, exactly like a hidden answer.
 * `customQuestions`: the participant's custom question definitions; a custom question is
 * compared as Fare/Ricevere when any participant's definition is Complementare.
 */
export type Participant = {
  answers: Record<string, Answer>;
  hiddenCategories?: string[];
  customQuestions?: QuestionDefinition[];
  /** Password-protected sections not unlocked by the viewer: only `averages` are known there. */
  locked?: ProtectedSection[];
  /** Clear per-category aggregates in the locked sections; old snapshots have scalar means. */
  averages?: CategoryAverages;
};

const isLockedFor = (p: Participant, category: string) =>
  Boolean(p.locked?.length && p.locked.includes(sectionOfCategory(category)));

/** Comparison mode of a question among these participants (defaults keep their built-in type). */
export function typeAmong(questionId: string, participants: Participant[]): QuestionType {
  return resolveQuestionType(
    questionId,
    participants.flatMap((p) => p.customQuestions ?? []),
  );
}

/**
 * Average pairwise compatibility for one question across 2 or 3 participants. Pairs whose
 * reciprocal flows cannot be computed are left out of the score, make the result partial and
 * widen its margin with their full possible range.
 */
export function multiCompatDetail(
  questionId: string,
  participants: Participant[],
  type: QuestionType = typeAmong(questionId, participants),
): CompatResult | null {
  const rows = participants.map((p) => p.answers[questionId]);
  if (rows.some((r) => !r || !r.answered || r.hidden)) return null;
  const category = categoryOfId(questionId);
  if (participants.some((p) => p.hiddenCategories?.includes(category))) return null;
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
  type: QuestionType = typeAmong(questionId, participants),
): number | null {
  return multiCompatDetail(questionId, participants, type)?.score ?? null;
}

export type AverageResult = {
  score: number;
  /** How many of the averaged questions are partial estimates. */
  partialCount: number;
  /** Worst-case error of the average: mean of the per-question margins. */
  margin: number;
  /**
   * True when some category was estimated from the clear per-category means of a
   * password-protected questionnaire instead of the single answers.
   */
  estimated?: boolean;
};

type EstimateStats = Omit<CategoryAggregate, "stdDev"> & { stdDev: number | null };

/** Legacy scalar means behave exactly as before, but carry no dispersion information. */
function estimateStats(raw: number | CategoryAggregate | undefined): EstimateStats | undefined {
  if (typeof raw === "number") {
    return { mean: raw, simMean: raw, giveMean: raw, recvMean: raw, stdDev: null };
  }
  return raw;
}

function participantStats(
  p: Participant,
  category: string,
  ids: string[],
  types: Map<string, QuestionType>,
): EstimateStats | undefined {
  if (isLockedFor(p, category)) return estimateStats(p.averages?.[category]);
  const definitions = ids.map((id) => ({ id, category, type: types.get(id) }));
  const aggregate = categoryAverages(
    p.answers,
    definitions,
    p.hiddenCategories ?? [],
    sectionOfCategory(category),
  )[category];
  return estimateStats(aggregate);
}

/**
 * Expected absolute gap of two distributions, using the normal-distribution identity at gap 0
 * and a smooth RMS approximation elsewhere. Without standard deviations this is the old 100−gap.
 */
function dispersedCompat(a: number, b: number, stdA: number | null, stdB: number | null): number {
  const gap = Math.abs(a - b);
  if (stdA === null || stdB === null) return 100 - Math.round(gap);
  const dispersion = (2 / Math.PI) * (stdA ** 2 + stdB ** 2);
  return 100 - Math.round(Math.min(100, Math.sqrt(gap ** 2 + dispersion)));
}

/** Every locked estimate has honest uncertainty, even when all visible votes coincide. */
function estimateMargin(stdA: number | null, stdB: number | null): number {
  if (stdA === null || stdB === null) return 12;
  return Math.max(12, Math.round(Math.sqrt(stdA ** 2 + stdB ** 2) / 2));
}

/** One pair estimated from role means, with reciprocal flows compared crosswise. */
function estimatedPair(
  ids: string[],
  types: Map<string, QuestionType>,
  a: EstimateStats,
  b: EstimateStats,
): { score: number; margin: number } | null {
  const parts: { score: number; weight: number; margin: number }[] = [];
  const similarityCount = ids.filter((id) => types.get(id) === "similarity").length;
  const reciprocalCount = ids.length - similarityCount;
  const baseMargin = estimateMargin(a.stdDev, b.stdDev);

  const similarityPart = (weight: number) => {
    if (!weight || a.simMean === null || b.simMean === null) return null;
    return {
      score: dispersedCompat(a.simMean, b.simMean, a.stdDev, b.stdDev),
      weight,
      margin: baseMargin,
    };
  };

  const reciprocalPart = (weight: number, singleValueFallback = false) => {
    if (!weight) return null;
    // A locked twin custom question can hide that it is Complementare. The other person's
    // Normale answer then plays the same single-value role as in pairRange's legacy fallback.
    const aGive = a.giveMean ?? (singleValueFallback ? a.simMean : null);
    const aReceive = a.recvMean ?? (singleValueFallback ? a.simMean : null);
    const bGive = b.giveMean ?? (singleValueFallback ? b.simMean : null);
    const bReceive = b.recvMean ?? (singleValueFallback ? b.simMean : null);
    const flows = [
      aGive !== null && bReceive !== null
        ? dispersedCompat(aGive, bReceive, a.stdDev, b.stdDev)
        : null,
      bGive !== null && aReceive !== null
        ? dispersedCompat(bGive, aReceive, a.stdDev, b.stdDev)
        : null,
    ];
    const known = flows.filter((value): value is number => value !== null);
    if (!known.length) return null;
    const score = mean(known);
    let margin = baseMargin;
    if (known.length === 1) {
      // The unknown direction can still contribute any score from 0 to 100.
      margin = Math.max(margin, withMargin(score, score / 2, (score + 100) / 2));
    }
    return { score, weight, margin };
  };

  const similarity = similarityPart(similarityCount);
  const reciprocal = reciprocalPart(reciprocalCount);
  if (similarity) parts.push(similarity);
  else if (similarityCount && !reciprocalCount) {
    const twinCustom = reciprocalPart(similarityCount, true);
    if (twinCustom) parts.push(twinCustom);
  }
  if (reciprocal) parts.push(reciprocal);

  if (!parts.length) return null;
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  return {
    score: Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weight),
    margin: Math.round(parts.reduce((sum, part) => sum + part.margin * part.weight, 0) / weight),
  };
}

/**
 * Category with a locked participant: readable pairs retain their exact per-question maths;
 * other pairs use separate similarity/Fare/Ricevere means and statistical dispersion. Scores
 * and margins are averaged over comparable pairs; weight approximates the category's length.
 */
function lockedCategoryEstimate(
  category: string,
  ids: string[],
  participants: Participant[],
): { score: number; weight: number; margin: number; partialCount: number } | null {
  if (participants.some((p) => p.hiddenCategories?.includes(category))) return null;
  const types = new Map(ids.map((id) => [id, typeAmong(id, participants)]));
  const pairs: { score: number; margin: number; partialCount: number }[] = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i]!;
      const b = participants[j]!;
      if (!isLockedFor(a, category) && !isLockedFor(b, category)) {
        const exact = plainAverage(ids, [a, b]);
        if (exact)
          pairs.push({
            score: exact.score,
            margin: exact.margin,
            partialCount: exact.partialCount,
          });
        continue;
      }
      const statsA = participantStats(a, category, ids, types);
      const statsB = participantStats(b, category, ids, types);
      const estimated = statsA && statsB ? estimatedPair(ids, types, statsA, statsB) : null;
      if (estimated) pairs.push({ ...estimated, partialCount: 0 });
    }
  }
  if (!pairs.length) return null;
  const readable = participants.filter((p) => !isLockedFor(p, category));
  const weight = ids.filter((id) =>
    readable.every((p) => p.answers[id]?.answered && !p.answers[id]?.hidden),
  ).length;
  return {
    score: mean(pairs.map((pair) => pair.score)),
    weight: Math.max(1, weight),
    margin: mean(pairs.map((pair) => pair.margin)),
    partialCount: pairs.reduce((sum, pair) => sum + pair.partialCount, 0),
  };
}

/**
 * Average over a list of question ids, partial estimates included; null when nothing comparable.
 * Categories where a participant's questionnaire is still password-protected are estimated
 * from the clear category means and weighted by their number of questions.
 */
export function averageCompatDetail(
  questionIds: string[],
  participants: Participant[],
): AverageResult | null {
  if (!participants.some((p) => p.locked?.length)) return plainAverage(questionIds, participants);
  const byCategory = new Map<string, string[]>();
  for (const id of questionIds) {
    const cat = categoryOfId(id);
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), id]);
  }
  const parts: { score: number; weight: number; margin: number; partialCount: number }[] = [];
  let estimated = false;
  for (const [cat, ids] of byCategory) {
    if (participants.some((p) => isLockedFor(p, cat))) {
      const est = lockedCategoryEstimate(cat, ids, participants);
      if (est) {
        parts.push(est);
        estimated = true;
      }
      continue;
    }
    for (const id of ids) {
      const r = multiCompatDetail(id, participants);
      if (r)
        parts.push({
          score: r.score,
          weight: 1,
          margin: r.margin,
          partialCount: r.partial ? 1 : 0,
        });
    }
  }
  if (parts.length === 0) return null;
  const total = parts.reduce((s, p) => s + p.weight, 0);
  return {
    score: Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / total),
    partialCount: parts.reduce((sum, p) => sum + p.partialCount, 0),
    margin: Math.round(parts.reduce((s, p) => s + p.margin * p.weight, 0) / total),
    ...(estimated ? { estimated: true } : {}),
  };
}

/** Plain per-question average (no protected sections involved). */
function plainAverage(questionIds: string[], participants: Participant[]): AverageResult | null {
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
export function formatCompat(result: { score: number; estimated?: boolean } | null): string {
  if (!result) return "–";
  return `${result.estimated ? "≈" : ""}${result.score}%`;
}

/** Short note under a total partly estimated from password-protected category means. */
export function estimateNote(result: AverageResult | null): string | null {
  if (!result?.estimated) return null;
  return "≈ Stima dalle medie per categoria: i dettagli protetti da password non sono ancora sbloccati.";
}

/** Uncoloured error margin of an estimate, e.g. "±23%"; empty for exact scores. */
export function formatMargin(result: { margin?: number } | null): string {
  return result && (result.margin ?? 0) > 0 ? `±${result.margin}%` : "";
}

/** Short note under a total that includes partial Fare/Ricevere estimates. */
export function partialNote(result: AverageResult | null): string | null {
  if (!result || result.partialCount === 0) return null;
  return result.partialCount === 1
    ? "Stima: include 1 domanda con risposta parziale (± è il margine d'errore)."
    : `Stima: include ${result.partialCount} domande con risposta parziale (± è il margine d'errore).`;
}
