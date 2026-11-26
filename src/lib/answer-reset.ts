import type { Answer } from "./types";

/**
 * Answer brought back to the never-answered state: value, sides, comment and critical flag are
 * cleared; only the per-question `hidden` flag (a visibility choice, not an answer) is kept.
 */
export function clearedAnswer(prev: Answer | undefined): Answer {
  return { value: 50, answered: false, ...(prev?.hidden ? { hidden: true } : {}) };
}

/** Clears every listed answer at once (one question or a whole category). */
export function clearAnswers(
  answers: Record<string, Answer>,
  ids: string[],
): Record<string, Answer> {
  const next = { ...answers };
  for (const id of ids) if (next[id]) next[id] = clearedAnswer(next[id]);
  return next;
}
