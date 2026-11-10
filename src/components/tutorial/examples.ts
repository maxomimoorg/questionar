import {
  ALL_CATEGORIES,
  DEFAULT_QUESTIONS,
  EROTISMO_CATEGORIES,
  type AnyCategoryKey,
  type QuestionType,
} from "@/lib/questions";

/**
 * Real questions and categories quoted by the tutorial demos. Every entry must exist in
 * src/lib/questions.ts with the stated type: src/test/info-modal.test.tsx checks it, so a
 * reworded or moved question is caught instead of the tutorial showing invented examples.
 */
export const TUTORIAL_QUESTIONS = {
  slider: { category: "B", text: "Vedersi con una certa frequenza", type: "similarity" },
  comment: { category: "A", text: "Convivenza", type: "similarity" },
  critical: { category: "A", text: "Matrimonio", type: "similarity" },
  similarity: { category: "B", text: "Programmare delle vacanze di coppia", type: "similarity" },
  reciprocal: { category: "F", text: "Contatto fisico", type: "reciprocal" },
  hidden: { category: "A", text: "Procreazione", type: "similarity" },
} as const satisfies Record<string, { category: AnyCategoryKey; text: string; type: QuestionType }>;

export type TutorialQuestionKey = keyof typeof TUTORIAL_QUESTIONS;

/** Categories shown with their real names (and real question counts where relevant). */
export const TUTORIAL_MAP_CATEGORIES: AnyCategoryKey[] = ["A", "E", "I"];
export const TUTORIAL_LIST_CATEGORIES: AnyCategoryKey[] = ["A", "B", "C"];
/** Category a custom question is filed under in the "Domande personalizzate" demo. */
export const TUTORIAL_CUSTOM_CATEGORY: AnyCategoryKey = "B";

export function categoryLabel(key: AnyCategoryKey): string {
  return ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Number of default questions in a category, as shown by the questionnaire counters. */
export function categoryQuestionCount(key: AnyCategoryKey): number {
  return DEFAULT_QUESTIONS.filter((q) => q.category === key).length;
}

export function findTutorialQuestion(key: TutorialQuestionKey) {
  const ref = TUTORIAL_QUESTIONS[key];
  return DEFAULT_QUESTIONS.find((q) => q.category === ref.category && q.text === ref.text);
}

export const EROTISMO_CATEGORY_LABELS = EROTISMO_CATEGORIES.map((c) => c.label);
