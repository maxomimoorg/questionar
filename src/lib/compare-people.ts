import { useMemo } from "react";

import type { Person } from "@/components/compare/CompareCategories";
import type { Participant } from "./compat";
import { resolveSnapshot } from "./protection";
import { resolveQuestionType } from "./questions";
import { useStore } from "./store";
import { handleOf, type Contact, type Question } from "./types";
import { useUnlocks } from "./unlocks";

/** A participant built from a person, protected sections included. */
export function participantOf(p: Person): Participant {
  return {
    answers: p.answers,
    hiddenCategories: p.hiddenCategories,
    customQuestions: p.customQuestions ?? [],
    ...(p.locked?.length ? { locked: p.locked, averages: p.averages ?? {} } : {}),
  };
}

/**
 * People, participants and the union of questions of a 2- or 3-way comparison. Each contact's
 * protected questionnaires are opened independently: unlocking B never unlocks C.
 */
export function useComparePeople(b?: string, c?: string) {
  const { state, questions } = useStore();
  const { unlocked } = useUnlocks();
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
      .map((x) => {
        const view = resolveSnapshot(x.snapshot, unlocked[x.handle]);
        return {
          handle: x.handle,
          name: x.name,
          answers: view.answers,
          hiddenCategories: view.hiddenCategories,
          customQuestions: view.customQuestions,
          locked: view.locked,
          averages: view.averages,
          mine: false,
        };
      }),
  ];

  const contactDefs = people.filter((p) => !p.mine).flatMap((p) => p.customQuestions ?? []);
  const defsKey = contactDefs.map((q) => `${q.id}:${q.type ?? ""}`).join("|");
  const allQuestions: Question[] = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, defsKey]);

  const participants: Participant[] = people.map(participantOf);

  return { contactB, contactC, people, participants, allQuestions };
}
