import { describe, expect, it } from "vitest";

import { averageCompatDetail, type Participant } from "@/lib/compat";
import { categoryBreakdown, sortByAffinity } from "@/lib/compat-map";
import type { Question } from "@/lib/questions";
import type { Answer } from "@/lib/types";

const cats = [
  { key: "A", label: "Alfa" },
  { key: "B", label: "Beta" },
  { key: "C", label: "Gamma" },
  { key: "D", label: "Delta" },
];
const q = (cat: string, n: number): Question => ({
  id: `${cat}-q${n}`,
  category: cat as Question["category"],
  text: `${cat}${n}`,
  custom: false,
});
const questions = ["A", "B", "C", "D"].flatMap((c) => [q(c, 0), q(c, 1)]);
const a = (value: number): Answer => ({ value, answered: true });

// Gaps chosen so A = 60%, B = 90%, C = no comparable answer, D = 60%.
const me: Participant = {
  answers: {
    "A-q0": a(50),
    "A-q1": a(50),
    "B-q0": a(50),
    "B-q1": a(50),
    "D-q0": a(10),
    "D-q1": a(10),
  },
};
const other: Participant = {
  answers: {
    "A-q0": a(90),
    "A-q1": a(90),
    "B-q0": a(60),
    "B-q1": a(60),
    "D-q0": a(50),
    "D-q1": a(50),
  },
};

describe("comparison chart bars", () => {
  it("are always sorted by affinity, unanswered categories last, ties in original order", () => {
    const bars = categoryBreakdown(cats, questions, [me, other]);
    expect(bars.map((b) => b.key)).toEqual(["B", "A", "D", "C"]);
    expect(bars.map((b) => b.detail?.score ?? null)).toEqual([90, 60, 60, null]);
  });

  it("each bar equals the category average used by the drawers", () => {
    const bars = categoryBreakdown(cats, questions, [me, other]);
    const a = bars.find((b) => b.key === "A")!;
    expect(a.detail).toEqual(averageCompatDetail(["A-q0", "A-q1"], [me, other]));
  });

  it("a category hidden by anyone gets no bar; a hidden question leaves its category average", () => {
    const hider: Participant = {
      ...other,
      hiddenCategories: ["B"],
      answers: { ...other.answers, "A-q1": { ...a(90), hidden: true }, "A-q0": a(70) },
    };
    const bars = categoryBreakdown(cats, questions, [me, hider]);
    expect(bars.map((b) => b.key)).not.toContain("B");
    expect(bars.find((b) => b.key === "A")!.detail?.score).toBe(80);
  });

  it("an extra bar (Erotismo) is merged into the same affinity order", () => {
    const merged = sortByAffinity([
      ...categoryBreakdown(cats, questions, [me, other]),
      { key: "erotismo", label: "Erotismo", detail: { score: 75, partialCount: 0, margin: 0 } },
    ]);
    expect(merged.map((b) => b.key)).toEqual(["B", "erotismo", "A", "D", "C"]);
  });
});
