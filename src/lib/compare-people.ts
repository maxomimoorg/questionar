import { useMemo } from "react";

import type { Person } from "@/components/compare/CompareCategories";
import type { Participant } from "./compat";
import { resolveQuestionType } from "./questions";
import { useStore } from "./store";
import { handleOf, type Contact, type Question } from "./types";

/** People, participants and the union of questions of a 2- or 3-way comparison. */
export function useComparePeople(b?: string, c?: string) {
  const { state, questions } = useStore();
  const contactB: Contact | undefined = b ? state.contacts.find((x) => x.handle === b) : undefined;
  const contactC: Contact | undefined = c ? state.contacts.find((x) => x.handle === c) : undefined;

  const people: Person[] = [
    {
      handle: handleOf(state.identity),
      name: "io",
      answers: state.answers,
      hiddenCategories: state.hiddenCategories,
      customQuestions: state.customQuestions,
      mine: true,
    },
    ...[contactB, contactC]
      .filter((x): x is Contact => Boolean(x))
      .map((x) => ({
        handle: x.handle,
        name: x.name,
        answers: x.snapshot?.answers ?? {},
        hiddenCategories: x.snapshot?.hiddenCategories ?? [],
        customQuestions: x.snapshot?.customQuestions ?? [],
        mine: false,
      })),
  ];

  const allQuestions: Question[] = useMemo(() => {
    const contactDefs = [contactB, contactC].flatMap((x) => x?.snapshot?.customQuestions ?? []);
    const definitions = [...questions.filter((q) => q.custom), ...contactDefs];
    const map = new Map<string, Question>();
    for (const q of questions) map.set(q.id, q);
    for (const q of contactDefs) {
      if (!map.has(q.id)) map.set(q.id, { ...q, custom: true });
    }
    // Twin custom questions share one comparison mode, the same one used by the totals.
    return [...map.values()].map((q) =>
      q.custom ? { ...q, type: resolveQuestionType(q.id, definitions) } : q,
    );
  }, [questions, contactB, contactC]);

  const participants: Participant[] = people.map((p) => ({
    answers: p.answers,
    hiddenCategories: p.hiddenCategories,
    customQuestions: p.customQuestions ?? [],
  }));

  return { contactB, contactC, people, participants, allQuestions };
}
