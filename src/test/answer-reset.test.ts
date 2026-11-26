import { describe, expect, it } from "vitest";
import { clearAnswers, clearedAnswer } from "@/lib/answer-reset";

describe("clearing answers (long press on the eye)", () => {
  it("brings an answer back to unanswered: value 50, no sides, no comment, not critical", () => {
    expect(
      clearedAnswer({ value: 80, giveValue: 90, receiveValue: 70, answered: true, comment: "x", critical: true }),
    ).toEqual({ value: 50, answered: false });
  });
  it("keeps the hidden flag", () => {
    expect(clearedAnswer({ value: 10, answered: true, hidden: true })).toEqual({ value: 50, answered: false, hidden: true });
  });
  it("clears only the listed ids", () => {
    const out = clearAnswers({ a: { value: 1, answered: true }, b: { value: 2, answered: true } }, ["a"]);
    expect(out["a"]).toEqual({ value: 50, answered: false });
    expect(out["b"]).toEqual({ value: 2, answered: true });
  });
});
