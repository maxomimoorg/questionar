import { describe, it, expect } from "vitest";
import { MOVED_QUESTION_IDS } from "@/lib/questions";
import { sanitizeAnswers } from "@/lib/types";

describe("questions moved to Erotismo · Vanilla", () => {
  it("migrates every old saved answer to its current id without losing its state", () => {
    for (const [oldId, currentId] of Object.entries(MOVED_QUESTION_IDS)) {
      const out = sanitizeAnswers({
        [oldId]: {
          value: 37,
          answered: true,
          comment: "nota privata",
          critical: true,
          hidden: true,
          giveValue: 20,
          receiveValue: 54,
        },
      });
      expect(out[currentId]).toEqual({
        value: 37,
        answered: true,
        comment: "nota privata",
        critical: true,
        hidden: true,
        giveValue: 20,
        receiveValue: 54,
      });
      expect(out[oldId]).toBeUndefined();
    }
  });

  it("keeps the current answer when both the old and new id are present", () => {
    for (const [oldId, currentId] of Object.entries(MOVED_QUESTION_IDS)) {
      const out = sanitizeAnswers({
        [oldId]: { value: 10, answered: true },
        [currentId]: { value: 90, answered: true },
      });
      expect(out[currentId]).toMatchObject({ value: 90, answered: true });
      expect(out[oldId]).toBeUndefined();
    }
  });
});
