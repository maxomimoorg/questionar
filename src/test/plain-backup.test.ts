import { describe, expect, it } from "vitest";
import { backupFileName, buildPlainBackup, toCsv } from "@/lib/diagnostics/plain-backup";
import { DEFAULT_QUESTIONS, isReciprocal } from "@/lib/questions";
import { EMPTY_STATE, type AppState } from "@/lib/types";

const normal = DEFAULT_QUESTIONS.find((q) => !q.id.startsWith("X") && !isReciprocal(q))!;
const recip = DEFAULT_QUESTIONS.find((q) => isReciprocal(q))!;
const other = DEFAULT_QUESTIONS.filter((q) => !isReciprocal(q))[3]!;
const unanswered = DEFAULT_QUESTIONS.filter((q) => !isReciprocal(q))[4]!;

const state: AppState = {
  ...EMPTY_STATE,
  identity: { username: "luna", emojis: ["🦊", "🌊", "⭐"] } as AppState["identity"],
  bio: "<p><b>Ciao</b> mondo</p>",
  tags: { ...EMPTY_STATE.tags, vegan: true, alcol: "cross" },
  answers: {
    [normal.id]: { value: 70, answered: true, comment: "nota" },
    [recip.id]: { value: 50, giveValue: 80, receiveValue: 20, answered: true },
    [other.id]: { value: 30, answered: true, hidden: true },
    [unanswered.id]: { value: 50, answered: false },
  },
};

describe("plain backup", () => {
  const b = buildPlainBackup(state, DEFAULT_QUESTIONS);
  const rows = b.sections.flatMap((s) => s.rows);
  it("includes only answered, not hidden answers", () => {
    expect(rows.map((r) => r.question).sort()).toEqual([normal.text, recip.text].sort());
  });
  it("reports Fare/Ricevere for reciprocal and Valore for normal answers", () => {
    const csv = toCsv(b);
    expect(csv).toContain("Fare: 80% · Ricevere: 20%");
    expect(csv).toContain("Valore: 70%");
    expect(csv).toContain("nota");
  });
  it("lists active tags and names the file after the handle", () => {
    expect(b.tags).toEqual([
      { label: "vegan", state: "sì" },
      { label: "alcol", state: "escluso" },
    ]);
    expect(backupFileName(b, "pdf")).toBe("questionar-backup-luna🦊🌊⭐.pdf");
  });
});
