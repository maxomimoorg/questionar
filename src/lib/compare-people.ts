import { useMemo } from "react";

import type { Person } from "@/components/compare/CompareCategories";
import type { Participant } from "./compat";
import { useStore } from "./store";
import { handleOf, type Contact, type Question } from "./types";

/** People, participants and the union of questions of a 2- or 3-way comparison. */
export function useComparePeople(b: string, c?: string) {
  const { state, questions } = useStore();
  const contactB: Contact | undefined = state.contacts.find((x) => x.handle === b);
  const contactC: Contact | undefined = c ? state.contacts.find((x) => x.handle === c) : undefined;

  const people: Person[] = [
    {
      handle: handleOf(state.identity),
      name: "io",
      answers: state.answers,
      hiddenCategories: state.hiddenCategories,
      mine: true,
    },
    ...[contactB, contactC]
      .filter((x): x is Contact => Boolean(x))
      .map((x) => ({
        handle: x.handle,
        name: x.name,
        answers: x.snapshot?.answers ?? {},
        hiddenCategories: x.snapshot?.hiddenCategories ?? [],
        mine: false,
      })),
  ];

  const allQuestions: Question[] = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) map.set(q.id, q);
    for (const contact of [contactB, contactC]) {
      for (const q of contact?.snapshot?.customQuestions ?? []) {
        if (!map.has(q.id)) map.set(q.id, { ...q, custom: true });
      }
    }
    return [...map.values()];
  }, [questions, contactB, contactC]);

  const participants: Participant[] = people.map((p) => ({
    answers: p.answers,
    hiddenCategories: p.hiddenCategories,
  }));

  return { contactB, contactC, people, participants, allQuestions };
}
