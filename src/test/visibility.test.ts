import { describe, expect, it } from "vitest";

import { averageCompatDetail, multiCompatDetail } from "@/lib/compat";
import { isReciprocal, type Question } from "@/lib/questions";
import { sanitizeSnapshot, type Answer } from "@/lib/types";
import {
  completionLabel,
  completionOf,
  expandAllAction,
  hiddenSection,
  isEffectivelyHidden,
  toggleCategory,
} from "@/lib/visibility";

const qs: Question[] = Array.from({ length: 13 }, (_, i) => ({
  id: `A-q${i}`,
  category: "A",
  text: `q${i}`,
  custom: false,
}));
const done: Answer = { value: 70, answered: true };

describe("completion counts", () => {
  it("0/13 with no answers, 3/13 with three", () => {
    expect(completionLabel(completionOf(qs, { answers: {} }, () => false))).toBe("0/13");
    const answers = { "A-q0": done, "A-q1": done, "A-q2": done };
    expect(completionLabel(completionOf(qs, { answers }, () => false))).toBe("3/13");
  });

  it("hiding an unanswered question gives 3/12, then an answered one 2/11", () => {
    const answers: Record<string, Answer> = {
      "A-q0": done, "A-q1": done, "A-q2": done,
      "A-q5": { value: 50, answered: false, hidden: true },
    };
    expect(completionLabel(completionOf(qs, { answers }, () => false))).toBe("3/12");
    answers["A-q0"] = { ...done, hidden: true };
    expect(completionLabel(completionOf(qs, { answers }, () => false))).toBe("2/11");
  });

  it("all visible complete shows 11 ✓; nothing visible shows no check", () => {
    const answers: Record<string, Answer> = {};
    qs.forEach((q, i) => (answers[q.id] = i < 2 ? { value: 50, answered: false, hidden: true } : done));
    expect(completionLabel(completionOf(qs, { answers }, () => false))).toBe("11 ✓");
    expect(completionLabel({ done: 0, total: 0 })).toBe("0");
  });

  it("a partial Fare/Ricevere answer is not complete", () => {
    const q = [qs[0]!];
    const partial = { "A-q0": { value: 60, answered: true, giveValue: 60 } };
    expect(completionLabel(completionOf(q, { answers: partial }, () => true))).toBe("0/1");
    const full = { "A-q0": { value: 60, answered: true, giveValue: 60, receiveValue: 60 } };
    expect(completionLabel(completionOf(q, { answers: full }, () => true))).toBe("1 ✓");
    expect(isReciprocal({ id: "A-q0" })).toBe(false);
  });
});

describe("category and question hiding", () => {
  it("hiding/restoring a category leaves individual flags untouched", () => {
    const answers = { "A-q1": { ...done, hidden: true } };
    let hiddenCategories = toggleCategory([], "A");
    expect(isEffectivelyHidden({ answers, hiddenCategories }, "A-q0")).toBe(true);
    hiddenCategories = toggleCategory(hiddenCategories, "A");
    expect(hiddenCategories).toEqual([]);
    expect(isEffectivelyHidden({ answers, hiddenCategories }, "A-q0")).toBe(false);
    expect(isEffectivelyHidden({ answers, hiddenCategories }, "A-q1")).toBe(true);
    expect(answers["A-q1"].hidden).toBe(true);
  });

  it("restoring a question while its category is hidden keeps it in the category group", () => {
    const cats = [{ key: "A", label: "Cat A" }];
    const before = hiddenSection(cats, qs, { answers: { "A-q1": { ...done, hidden: true } }, hiddenCategories: ["A"] });
    expect(before.individual.map((q) => q.id)).toEqual(["A-q1"]);
    expect(before.groups[0]!.questions.some((q) => q.id === "A-q1")).toBe(false);
    const after = hiddenSection(cats, qs, { answers: { "A-q1": { ...done, hidden: false } }, hiddenCategories: ["A"] });
    expect(after.individual).toEqual([]);
    expect(after.groups[0]!.questions.some((q) => q.id === "A-q1")).toBe(true);
    expect(isEffectivelyHidden({ answers: {}, hiddenCategories: ["A"] }, "A-q1")).toBe(true);
  });
});

describe("comparisons", () => {
  it("a category hidden by one participant is left out of compatibility", () => {
    const a = { answers: { "A-q0": done, "B-x": done } };
    const b = { answers: { "A-q0": { value: 0, answered: true }, "B-x": done }, hiddenCategories: ["A"] };
    expect(multiCompatDetail("A-q0", [a, b])).toBeNull();
    expect(averageCompatDetail(["A-q0", "B-x"], [a, b])?.score).toBe(100);
  });

  it("Erotismo questions count once in the overall average", () => {
    const a = { answers: { "A-q0": { value: 100, answered: true }, "XA-y": { value: 0, answered: true } } };
    const b = { answers: { "A-q0": { value: 100, answered: true }, "XA-y": { value: 100, answered: true } } };
    // A: 100, XA: 0 → mean 50 (not weighted twice).
    expect(averageCompatDetail(["A-q0", "XA-y"], [a, b])?.score).toBe(50);
  });

  it("hidden categories survive snapshot sanitising; junk is dropped", () => {
    const snap = sanitizeSnapshot({
      name: "n", bio: "", answers: {}, customQuestions: [], updatedAt: 1,
      hiddenCategories: ["A", "XA", "A", "<script>", 3] as unknown as string[],
    });
    expect(snap.hiddenCategories).toEqual(["A", "XA"]);
  });
});

describe("expand / collapse all", () => {
  it("mixed or all closed → expand; all open → collapse", () => {
    expect(expandAllAction([true, false])).toBe("expand");
    expect(expandAllAction([false, false])).toBe("expand");
    expect(expandAllAction([true, true])).toBe("collapse");
  });
});
