import { describe, expect, it } from "vitest";

import { hasAnsweredErotic } from "@/lib/visibility";

const questions = [
  { id: "A-musica", category: "A" as const },
  { id: "XB-shibari", category: "XB" as const },
  { id: "D-sessoorale", category: "XA" as const }, // moved into Erotismo, old id kept
];

describe("Erotismo info panel opens until the first Erotismo answer", () => {
  it("opens when no Erotismo question is answered, even if main ones are", () => {
    expect(hasAnsweredErotic(questions, { "A-musica": { value: 80, answered: true } })).toBe(false);
  });

  it("an untouched slider does not count as an answer", () => {
    expect(hasAnsweredErotic(questions, { "XB-shibari": { value: 50, answered: false } })).toBe(
      false,
    );
  });

  it("stays closed after one Erotismo answer", () => {
    expect(hasAnsweredErotic(questions, { "XB-shibari": { value: 70, answered: true } })).toBe(
      true,
    );
  });

  it("counts questions moved into Erotismo that kept their old id", () => {
    expect(hasAnsweredErotic(questions, { "D-sessoorale": { value: 70, answered: true } })).toBe(
      true,
    );
  });
});
