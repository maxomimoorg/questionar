import { describe, expect, it } from "vitest";
import {
  averageCompatDetail,
  formatCompat,
  formatMargin,
  multiCompat,
  multiCompatDetail,
  questionCompat,
  reciprocalFlows,
} from "@/lib/compat";
import { DEFAULT_QUESTIONS, questionType, MOVED_QUESTION_IDS } from "@/lib/questions";
import { isPartialAnswer, reciprocalValue, sanitizeSnapshot, type Answer } from "@/lib/types";

const RECIPROCAL = "F-contattofisico";
const SIMILARITY = "F-tempodiqualita";

const ans = (giveValue: number, receiveValue: number, extra: Partial<Answer> = {}): Answer => ({
  value: Math.round((giveValue + receiveValue) / 2),
  answered: true,
  giveValue,
  receiveValue,
  ...extra,
});

const pair = (id: string, a: Answer, b: Answer) =>
  multiCompat(id, [{ answers: { [id]: a } }, { answers: { [id]: b } }]);

describe("reciprocal questions (Fare / Ricevere)", () => {
  it("flags exactly the 20 chosen questions, with the reworded texts", () => {
    const reciprocal = DEFAULT_QUESTIONS.filter((q) => q.type === "reciprocal").map((q) => q.text);
    expect(reciprocal).toHaveLength(20);
    for (const text of [
      "Contatto fisico",
      "Vocali lunghi come audiolibri",
      "Masturbazione",
      "Gioco kinky (fetish/BDSM)",
      "Supporto nei momenti difficili",
      "Consigli",
      "Sostegno nel lavoro sulla salute mentale",
      "Supporto economico",
      "Regali costosi",
    ]) {
      expect(reciprocal).toContain(text);
    }
    expect(questionType(SIMILARITY)).toBe("similarity");
    expect(questionType("J-miadomandapersonale")).toBe("similarity");
  });

  it("keeps the old ids of reworded questions so saved answers still match", () => {
    const byText = (t: string) => DEFAULT_QUESTIONS.find((q) => q.text === t)!.id;
    expect(byText("Masturbazione")).toBe("XA-masturbazione");
    expect(MOVED_QUESTION_IDS["D-masturbazionereciproca"]).toBe("XA-masturbazione");
    expect(byText("Vocali lunghi come audiolibri")).toBe("F-mandarsivocalilunghicomeaudiolibri");
    expect(byText("Supporto nei momenti difficili")).toBe("H-offriresupportoneimomentidifficili");
    expect(byText("Consigli")).toBe("H-chiedereconsigli");
    expect(byText("Sostegno nel lavoro sulla salute mentale")).toBe(
      "H-sostenereillavorosullasalutementale",
    );
  });

  it("perfect complementarity: Fare 90/Ricevere 20 vs Fare 20/Ricevere 90 is 100%", () => {
    const flows = reciprocalFlows(ans(90, 20), ans(20, 90), 0);
    expect(flows).toEqual({ aToB: 100, bToA: 100, score: 100, partial: false, margin: 0 });
    expect(pair(RECIPROCAL, ans(90, 20), ans(20, 90))).toBe(100);
  });

  it("both only want to give: gap 100 on both flows gives 0%", () => {
    expect(reciprocalFlows(ans(100, 0), ans(100, 0), 0)).toEqual({
      aToB: 0,
      bToA: 0,
      score: 0,
      partial: false,
      margin: 0,
    });
    expect(pair(RECIPROCAL, ans(100, 0), ans(100, 0))).toBe(0);
  });

  it("uses the unchanged critical curves on each flow", () => {
    // one critical: gap 0 -> 110, gap 100 -> -25
    expect(pair(RECIPROCAL, ans(90, 20, { critical: true }), ans(20, 90))).toBe(110);
    expect(pair(RECIPROCAL, ans(100, 0, { critical: true }), ans(100, 0))).toBe(-25);
    // both critical: gap 100 -> -30
    expect(
      pair(RECIPROCAL, ans(100, 0, { critical: true }), ans(100, 0, { critical: true })),
    ).toBe(-30);
    // mixed flows: gap 0 (110) and gap 55 (25) -> mean 68 (rounded)
    expect(reciprocalFlows(ans(80, 25), ans(80, 80), 1)).toEqual({
      aToB: 110,
      bToA: 25,
      score: 68,
      partial: false,
      margin: 0,
    });
  });

  it("similarity questions ignore Fare/Ricevere and keep the old formula", () => {
    expect(pair(SIMILARITY, ans(90, 20), ans(20, 90))).toBe(100 - Math.abs(55 - 55));
    expect(pair(SIMILARITY, { value: 70, answered: true }, { value: 40, answered: true })).toBe(
      questionCompat(70, 40, 0),
    );
  });

  it("answers saved with a single value count as Fare = Ricevere = value", () => {
    const old = (value: number): Answer => ({ value, answered: true });
    expect(pair(RECIPROCAL, old(70), old(40))).toBe(70);
    // mixed: old single value 60 vs new Fare 60 / Ricevere 60
    expect(pair(RECIPROCAL, old(60), ans(60, 60))).toBe(100);
  });

  it("averages every pair in a three-way comparison", () => {
    const id = RECIPROCAL;
    const score = multiCompat(id, [
      { answers: { [id]: ans(90, 20) } },
      { answers: { [id]: ans(20, 90) } },
      { answers: { [id]: ans(100, 0) } },
    ]);
    const ab = reciprocalFlows(ans(90, 20), ans(20, 90), 0).score;
    const ac = reciprocalFlows(ans(90, 20), ans(100, 0), 0).score;
    const bc = reciprocalFlows(ans(20, 90), ans(100, 0), 0).score;
    expect(score).toBe(Math.round((ab! + ac! + bc!) / 3));
  });

  it("snapshots keep valid Fare/Ricevere values and drop invalid ones", () => {
    const snap = sanitizeSnapshot({
      name: "Luna",
      bio: "",
      customQuestions: [],
      updatedAt: 1,
      answers: {
        [RECIPROCAL]: { value: 55, answered: true, giveValue: 90, receiveValue: 20 },
        "F-regali": { value: 40, answered: true, giveValue: "x", receiveValue: 180 } as unknown as Answer,
        [SIMILARITY]: { value: 30, answered: true, comment: "ok", critical: true },
      },
    });
    expect(snap.answers[RECIPROCAL]).toEqual({
      value: 55,
      answered: true,
      giveValue: 90,
      receiveValue: 20,
    });
    expect(snap.answers["F-regali"]).toEqual({ value: 40, answered: true, receiveValue: 100 });
    expect(snap.answers[SIMILARITY]).toEqual({
      value: 30,
      answered: true,
      comment: "ok",
      critical: true,
    });
  });

  describe("partial answers (only Fare or only Ricevere)", () => {
    const onlyGive = (v: number, extra: Partial<Answer> = {}): Answer => ({
      value: v,
      answered: true,
      giveValue: v,
      ...extra,
    });
    const onlyReceive = (v: number): Answer => ({ value: v, answered: true, receiveValue: v });

    it("an answer with only one side is partial; legacy single values are complete", () => {
      expect(isPartialAnswer(onlyGive(80))).toBe(true);
      expect(isPartialAnswer(onlyReceive(30))).toBe(true);
      expect(isPartialAnswer(ans(80, 30))).toBe(false);
      expect(isPartialAnswer({ value: 60, answered: true })).toBe(false);
      expect(isPartialAnswer({ value: 50, answered: false })).toBe(false);
    });

    it("value sent to older versions is the mean of the known sides only", () => {
      expect(reciprocalValue(80, undefined)).toBe(80);
      expect(reciprocalValue(undefined, 30)).toBe(30);
      expect(reciprocalValue(90, 20)).toBe(55);
    });

    it("compares only the computable flow and flags the score as an estimate", () => {
      // I only answered Fare 80; Luna Fare 20 / Ricevere 70: I give ➔ Luna receives = 90
      expect(reciprocalFlows(onlyGive(80), ans(20, 70), 0)).toEqual({
        aToB: 90,
        bToA: null,
        score: 90,
        partial: true,
        margin: 45,
      });
      expect(multiCompatDetail(RECIPROCAL, [
        { answers: { [RECIPROCAL]: onlyGive(80) } },
        { answers: { [RECIPROCAL]: ans(20, 70) } },
      ])).toEqual({ score: 90, partial: true, margin: 45 });
    });

    it("the unanswered side is never treated as 50%", () => {
      // if Ricevere were assumed 50, B ➔ A would be 100 - |20 - 50| = 70 and the mean 80
      expect(pair(RECIPROCAL, onlyGive(80), ans(20, 70))).toBe(90);
    });

    it("critical curves still apply to the single known flow", () => {
      // gap 100 with one critical flag -> -25
      expect(pair(RECIPROCAL, onlyGive(100, { critical: true }), ans(100, 0))).toBe(-25);
    });

    it("nothing comparable when both answered only Fare", () => {
      expect(reciprocalFlows(onlyGive(80), onlyGive(40), 0)).toEqual({
        aToB: null,
        bToA: null,
        score: null,
        partial: false,
        margin: 0,
      });
      expect(pair(RECIPROCAL, onlyGive(80), onlyGive(40))).toBeNull();
    });

    it("totals include estimates and count them", () => {
      const me = { answers: { [RECIPROCAL]: onlyGive(80), [SIMILARITY]: { value: 70, answered: true } } };
      const luna = { answers: { [RECIPROCAL]: ans(20, 70), [SIMILARITY]: { value: 40, answered: true } } };
      const total = averageCompatDetail([RECIPROCAL, SIMILARITY], [me, luna]);
      // margins: reciprocal 45, similarity 0 -> mean 23 (rounded)
      expect(total).toEqual({ score: 80, partialCount: 1, margin: 23 });
      expect(formatCompat(total)).toBe("80%");
      expect(formatMargin(total)).toBe("±23%");
      expect(formatMargin({ margin: 0 })).toBe("");
    });

    it("three-way: a pair with no computable flow is skipped and makes the result partial", () => {
      const id = RECIPROCAL;
      const result = multiCompatDetail(id, [
        { answers: { [id]: onlyGive(80) } },
        { answers: { [id]: onlyGive(40) } },
        { answers: { [id]: ans(20, 80) } },
      ]);
      // pair 1-2: none; 1-3: 80 vs 80 -> 100; 2-3: 40 vs 80 -> 60
      expect(result).toEqual({ score: 80, partial: true, margin: 53 });
    });

    it("snapshots keep a single Fare or Ricevere side", () => {
      const snap = sanitizeSnapshot({
        name: "Luna",
        bio: "",
        customQuestions: [],
        updatedAt: 1,
        answers: { [RECIPROCAL]: onlyReceive(30) },
      });
      expect(snap.answers[RECIPROCAL]).toEqual({ value: 30, answered: true, receiveValue: 30 });
    });
  });
});
