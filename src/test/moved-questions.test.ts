import { describe, it, expect } from "vitest";
import { DEFAULT_QUESTIONS, MOVED_QUESTION_IDS } from "@/lib/questions";
import { sanitizeAnswers } from "@/lib/types";

describe("questions moved to Erotismo · Vanilla", () => {
  it("10 questions leave Intimità fisica and land in Vanilla", () => {
    expect(DEFAULT_QUESTIONS.filter((q) => q.category === "D")).toHaveLength(6);
    expect(DEFAULT_QUESTIONS.filter((q) => q.category === "XA")).toHaveLength(10);
    expect(Object.keys(MOVED_QUESTION_IDS)).toHaveLength(10);
  });
  it("old saved answers follow the question to its new id", () => {
    const out = sanitizeAnswers({ "D-sessoorale": { value: 80, answered: true } });
    expect(out["XA-sessoorale"]).toMatchObject({ value: 80, answered: true });
    expect(out["D-sessoorale"]).toBeUndefined();
  });
});
