// Visibility and completion rules shared by the main questionnaire and Erotismo.
// A question has two independent hiding states: its own `answer.hidden` flag and the hidden
// state of its category. Hiding/restoring a category never touches the per-question flag.

import { categoryOfId, type Question } from "./questions";
import { giveOf, isPartialAnswer, receiveOf, type Answer } from "./types";

export { sanitizeHiddenCategories } from "./types";

export type Visibility = {
  answers: Record<string, Answer>;
  hiddenCategories?: string[];
};

export function isCategoryHidden(v: Visibility, category: string): boolean {
  return (v.hiddenCategories ?? []).includes(category);
}

export function isIndividuallyHidden(v: Visibility, id: string): boolean {
  return v.answers[id]?.hidden === true;
}

/** Hidden by its own flag or by its category. */
export function isEffectivelyHidden(v: Visibility, id: string): boolean {
  return isIndividuallyHidden(v, id) || isCategoryHidden(v, categoryOfId(id));
}

/** Complete = answered, and for Fare/Ricevere both sides known. Partial answers do not count. */
export function isComplete(question: Pick<Question, "id">, answer: Answer | undefined, reciprocal: boolean): boolean {
  if (!answer?.answered) return false;
  if (!reciprocal) return true;
  return !isPartialAnswer(answer) && giveOf(answer) !== undefined && receiveOf(answer) !== undefined;
}

export type Completion = { done: number; total: number };

/** Completion over the questions that are visible (not hidden individually; category assumed visible). */
export function completionOf(
  questions: Question[],
  v: Visibility,
  isReciprocal: (q: Question) => boolean,
): Completion {
  const visible = questions.filter((q) => !isIndividuallyHidden(v, q.id));
  return {
    done: visible.filter((q) => isComplete(q, v.answers[q.id], isReciprocal(q))).length,
    total: visible.length,
  };
}

/** "3/13", or "11 ✓" when all visible questions are complete; "0" when nothing is visible. */
export function completionLabel({ done, total }: Completion): string {
  if (total === 0) return "0";
  if (done >= total) return `${total} ✓`;
  return `${done}/${total}`;
}

export function toggleCategory(hidden: string[] | undefined, category: string): string[] {
  const list = hidden ?? [];
  return list.includes(category) ? list.filter((c) => c !== category) : [...list, category];
}

export type HiddenSection = {
  /** Hidden categories, each with the questions not individually hidden. */
  groups: { key: string; label: string; questions: Question[] }[];
  /** Questions hidden one by one, whatever their category state. */
  individual: Question[];
};

export function hiddenSection(
  categories: { key: string; label: string }[],
  questions: Question[],
  v: Visibility,
): HiddenSection {
  const keys = new Set(categories.map((c) => c.key));
  const scoped = questions.filter((q) => keys.has(q.category));
  return {
    groups: categories
      .filter((c) => isCategoryHidden(v, c.key))
      .map((c) => ({
        ...c,
        questions: scoped.filter((q) => q.category === c.key && !isIndividuallyHidden(v, q.id)),
      })),
    individual: scoped.filter((q) => isIndividuallyHidden(v, q.id)),
  };
}

/** Next state of the global "Espandi tutte / Comprimi tutte" control. */
export function expandAllAction(openStates: boolean[]): "expand" | "collapse" {
  return openStates.length > 0 && openStates.every(Boolean) ? "collapse" : "expand";
}
