// Per-category breakdown shown by the comparison chart (ring + bars).
// Uses exactly the same visibility rule and maths as the comparison drawers, so every bar
// matches the percentage on its category header.

import { averageCompatDetail, type AverageResult, type Participant } from "./compat";
import type { Answer, Question } from "./types";

type Visible = { answers: Record<string, Answer>; hiddenCategories?: string[] };

/** A question is compared only when nobody hid it, individually or through its category. */
export function visibleToAll(q: Question, people: Visible[]): boolean {
  return people.every(
    (p) => !p.answers[q.id]?.hidden && !(p.hiddenCategories ?? []).includes(q.category),
  );
}

export type CategoryBar = { key: string; label: string; detail: AverageResult | null };

/**
 * One bar per category that has at least one visible question, always sorted by affinity:
 * highest score first, categories without comparable answers last, ties in original order.
 */
export function categoryBreakdown(
  categories: { key: string; label: string }[],
  allQuestions: Question[],
  participants: Participant[],
): CategoryBar[] {
  const bars = categories
    .map((cat) => {
      const ids = allQuestions
        .filter((q) => q.category === cat.key && visibleToAll(q, participants))
        .map((q) => q.id);
      return {
        ids,
        bar: { key: cat.key, label: cat.label, detail: averageCompatDetail(ids, participants) },
      };
    })
    .filter((x) => x.ids.length > 0)
    .map((x) => x.bar);
  return sortByAffinity(bars);
}

/** Highest score first, bars without a score last; stable, so ties keep their order. */
export function sortByAffinity<T extends { detail: { score: number } | null }>(bars: T[]): T[] {
  return [...bars].sort((x, y) => {
    const a = x.detail?.score ?? null;
    const b = y.detail?.score ?? null;
    if (a === null || b === null) return a === null ? (b === null ? 0 : 1) : -1;
    return b - a;
  });
}
