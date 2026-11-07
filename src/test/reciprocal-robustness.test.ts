import { describe, expect, it } from "vitest";
import { averageCompatDetail, formatCompat, formatMargin, multiCompatDetail } from "@/lib/compat";
import { questionType } from "@/lib/questions";
import { sanitizeAnswers, type Answer } from "@/lib/types";

const R = "F-contattofisico";
const two = (a: Answer, b: Answer) => [{ answers: { [R]: a } }, { answers: { [R]: b } }];
const full = (g: number, r: number, extra: Partial<Answer> = {}): Answer => ({
  value: Math.round((g + r) / 2), answered: true, giveValue: g, receiveValue: r, ...extra,
});

describe("reciprocal robustness", () => {
  it("unanswered or hidden answers are never compared", () => {
    expect(multiCompatDetail(R, two({ value: 50, answered: false }, full(50, 50)))).toBeNull();
    expect(multiCompatDetail(R, two(full(90, 20, { hidden: true }), full(20, 90)))).toBeNull();
  });

  it("a peer's custom question cannot pose as reciprocal", () => {
    expect(questionType("J-contattofisico")).toBe("similarity");
    expect(questionType("F-contattofisicoextra")).toBe("similarity");
  });

  it("sanitizer clamps, rounds and drops non-numeric sides", () => {
    const out = sanitizeAnswers({
      [R]: { value: 120, answered: true, giveValue: -5, receiveValue: 33.6 },
      x: { value: NaN, answered: "yes", giveValue: Infinity },
      bad: null,
    });
    expect(out[R]).toEqual({ value: 100, answered: true, giveValue: 0, receiveValue: 34 });
    expect(out["x"]).toEqual({ value: 50, answered: false });
    expect(out["bad"]).toBeUndefined();
  });

  it("totals with no partial answers carry no '~'", () => {
    const total = averageCompatDetail([R], two(full(90, 20), full(20, 90)));
    expect(total).toEqual({ score: 100, partialCount: 0, margin: 0 });
    expect(formatCompat(total)).toBe("100%");
    expect(formatMargin(total)).toBe("");
    expect(formatCompat(null)).toBe("–");
  });

  it("margin uses the critical curve range of the unknown flow", () => {
    // one critical: known flow gap 100 -> -25; unknown flow in [-25, 110] -> range [-25, 42.5]
    const res = multiCompatDetail(R, two({ value: 100, answered: true, giveValue: 100, critical: true }, full(100, 0)));
    expect(res).toEqual({ score: -25, partial: true, margin: 68 });
    expect(formatMargin(res)).toBe("±68%");
  });

  it("three-way: a pair with no computable flow widens the margin with its full range", () => {
    const onlyGive = (v: number): Answer => ({ value: v, answered: true, giveValue: v });
    const res = multiCompatDetail(R, [
      { answers: { [R]: onlyGive(80) } },
      { answers: { [R]: onlyGive(40) } },
      { answers: { [R]: full(20, 80) } },
    ]);
    // pairs: none [0,100]; 1-3 known 100, unknown [0,100] -> [50,100]; 2-3 known 60 -> [30,80]
    // low = 80/3 = 26.7, high = 280/3 = 93.3, score 80 -> margin 53
    expect(res).toEqual({ score: 80, partial: true, margin: 53 });
  });
});
