import { describe, it, expect } from "vitest";
import { DEFAULT_QUESTIONS, MOVED_QUESTION_IDS } from "@/lib/questions";
import { sanitizeAnswers } from "@/lib/types";

describe("questions moved to Erotismo · Vanilla", () => {
  it("9 questions leave Intimità fisica; Intimità fisica keeps 7 and Vanilla holds 8", () => {
    expect(DEFAULT_QUESTIONS.filter((q) => q.category === "D")).toHaveLength(7);
    expect(DEFAULT_QUESTIONS.filter((q) => q.category === "XA")).toHaveLength(8);
    expect(Object.keys(MOVED_QUESTION_IDS)).toHaveLength(9);
  });
  it("old saved answers follow the question to its new id", () => {
    const out = sanitizeAnswers({ "D-sessoorale": { value: 80, answered: true } });
    expect(out["XA-sessoorale"]).toMatchObject({ value: 80, answered: true });
    expect(out["D-sessoorale"]).toBeUndefined();
  });
});
