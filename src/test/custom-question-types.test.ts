import { afterEach, describe, expect, it, vi } from "vitest";
import { averageCompatDetail, multiCompatDetail, typeAmong, type Participant } from "@/lib/compat";
import {
  DEFAULT_QUESTIONS,
  isReciprocal,
  questionId,
  questionType,
  resolveQuestionType,
  sanitizeCustomQuestions,
  type Question,
} from "@/lib/questions";
import { buildSnapshot } from "@/lib/store";
import { importBackupPng, type BackupPayload } from "@/lib/stego";
import { EMPTY_STATE, sanitizeSnapshot, type Answer } from "@/lib/types";
import { completionOf } from "@/lib/visibility";

const CUSTOM = questionId("J", "Cucinare per l'altra persona");
const custom = (type?: unknown): Question =>
  ({
    id: CUSTOM,
    category: "J",
    text: "Cucinare per l'altra persona",
    custom: true,
    ...(type !== undefined ? { type } : {}),
  }) as Question;

const full = (g: number, r: number, extra: Partial<Answer> = {}): Answer => ({
  value: Math.round((g + r) / 2),
  answered: true,
  giveValue: g,
  receiveValue: r,
  ...extra,
});

const people = (defs: Question[][], answers: Answer[], id = CUSTOM): Participant[] =>
  answers.map((a, i) => ({ answers: { [id]: a }, customQuestions: defs[i] ?? [] }));

describe("custom question types: definitions and legacy data", () => {
  it("keeps ids from category + text and saves the chosen type", () => {
    expect(CUSTOM).toBe("J-cucinareperlaltrapersona");
    const [q] = sanitizeCustomQuestions([custom("reciprocal")]);
    expect(q).toEqual({
      id: CUSTOM,
      category: "J",
      text: "Cucinare per l'altra persona",
      custom: true,
      type: "reciprocal",
    });
  });

  it("legacy definitions without a type become Normale", () => {
    const [q] = sanitizeCustomQuestions([
      { id: CUSTOM, category: "J", text: "Cucinare per l'altra persona", custom: true },
    ]);
    expect(q?.type).toBe("similarity");
    expect(isReciprocal(q!)).toBe(false);
  });

  it("invalid types are accepted as Normale without errors; malformed entries are dropped", () => {
    const out = sanitizeCustomQuestions([
      custom("banana"),
      { id: "J-altra", category: "J", text: "Altra", type: 7 },
      { id: "J-terza", text: "Terza", type: null },
      null,
      { id: 5, text: "x" },
      { id: "J-vuota", text: "" },
      "J-stringa",
    ]);
    expect(out.map((q) => [q.id, q.type])).toEqual([
      [CUSTOM, "similarity"],
      ["J-altra", "similarity"],
      ["J-terza", "similarity"],
    ]);
    expect(out[2]?.category).toBe("J");
    expect(sanitizeCustomQuestions("not a list")).toEqual([]);
    expect(sanitizeCustomQuestions(undefined)).toEqual([]);
  });

  it("a custom entry can never redefine a default question or its type", () => {
    const reciprocalDefault = DEFAULT_QUESTIONS.find((q) => q.type === "reciprocal")!;
    const similarityDefault = DEFAULT_QUESTIONS.find((q) => q.type === "similarity")!;
    const fakes = [
      { ...reciprocalDefault, custom: true, type: "similarity" as const },
      { ...similarityDefault, custom: true, type: "reciprocal" as const },
    ];
    expect(sanitizeCustomQuestions(fakes)).toEqual([]);
    expect(resolveQuestionType(reciprocalDefault.id, fakes)).toBe("reciprocal");
    expect(resolveQuestionType(similarityDefault.id, fakes)).toBe("similarity");
  });
});

describe("custom question types: snapshot, P2P and backup", () => {
  it("snapshots carry the type and survive a JSON round trip (P2P)", () => {
    const snap = buildSnapshot({ ...EMPTY_STATE, customQuestions: [custom("reciprocal")] }, 1);
    expect(snap.customQuestions[0]?.type).toBe("reciprocal");
    const received = sanitizeSnapshot(JSON.parse(JSON.stringify(snap)));
    expect(received.customQuestions).toEqual([custom("reciprocal")]);
  });

  it("snapshots from older versions (no type) arrive as Normale", () => {
    const legacy = {
      name: "Luna",
      bio: "",
      answers: {},
      customQuestions: [custom()],
      updatedAt: 1,
    };
    expect(sanitizeSnapshot(legacy).customQuestions[0]?.type).toBe("similarity");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("PNG backups keep the type of each custom question", async () => {
    const payload: BackupPayload = {
      v: 1,
      name: "Luna",
      handle: "luna🦊🌊⭐",
      bio: "",
      answers: { [CUSTOM]: full(80, 30) },
      customQuestions: [custom("reciprocal"), { ...custom(), id: "J-legacy", text: "Legacy" }],
      savedAt: 1,
    };
    const json = new TextEncoder().encode(JSON.stringify(payload));
    const bytes = new Uint8Array(8 + json.length);
    bytes.set(new TextEncoder().encode("QAR1"));
    new DataView(bytes.buffer).setUint32(4, json.length);
    bytes.set(json, 8);
    const data = new Uint8ClampedArray(256 * 256 * 4).fill(254);
    for (let bit = 0; bit < bytes.length * 8; bit++) {
      const pos = Math.floor(bit / 3) * 4 + (bit % 3);
      data[pos] =
        ((data[pos] ?? 0) & 254) | (((bytes[Math.floor(bit / 8)] ?? 0) >> (7 - (bit % 8))) & 1);
    }
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 256, height: 256, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data }),
    } as unknown as CanvasRenderingContext2D);

    const read = await importBackupPng(new File([], "backup.png"));
    expect(sanitizeCustomQuestions(read.customQuestions).map((q) => q.type)).toEqual([
      "reciprocal",
      "similarity",
    ]);
  });
});

describe("custom Complementare comparison", () => {
  it("compares crosswise like the built-in Fare/Ricevere questions", () => {
    // Both like to give and not receive: crosswise they do not match at all.
    const answers = [full(100, 0), full(100, 0)];
    expect(multiCompatDetail(CUSTOM, people([[custom("reciprocal")], []], answers))).toEqual({
      score: 0,
      partial: false,
      margin: 0,
    });
    // Same answers on a Normale question compare the single value (50 vs 50).
    expect(multiCompatDetail(CUSTOM, people([[custom("similarity")], []], answers))?.score).toBe(
      100,
    );
    expect(multiCompatDetail(CUSTOM, people([[custom()], [custom()]], answers))?.score).toBe(100);
    // Complementary needs: 90/20 against 20/90 is a full match.
    expect(
      multiCompatDetail(CUSTOM, people([[custom("reciprocal")]], [full(90, 20), full(20, 90)]))
        ?.score,
    ).toBe(100);
  });

  it("twin questions are Complementare when any participant's definition says so", () => {
    const ps = people(
      [[custom("similarity")], [custom("reciprocal")], []],
      [full(1, 1), full(1, 1), full(1, 1)],
    );
    expect(typeAmong(CUSTOM, ps)).toBe("reciprocal");
    expect(
      typeAmong(CUSTOM, people([[custom()], [custom("banana")]], [full(1, 1), full(1, 1)])),
    ).toBe("similarity");
  });

  it("handles partial answers with an estimate and margin, then becomes exact once completed", () => {
    const defs = [[custom("reciprocal")], [custom("reciprocal")]];
    const partialMine: Answer = { value: 80, answered: true, giveValue: 80 };
    const estimate = multiCompatDetail(CUSTOM, people(defs, [partialMine, full(20, 70)]));
    expect(estimate).toEqual({ score: 90, partial: true, margin: 45 });

    const completed = multiCompatDetail(CUSTOM, people(defs, [full(80, 20), full(20, 70)]));
    expect(completed).toEqual({ score: 95, partial: false, margin: 0 });

    // Nothing computable: both only answered "Fare".
    expect(
      multiCompatDetail(
        CUSTOM,
        people(defs, [partialMine, { value: 40, answered: true, giveValue: 40 }]),
      ),
    ).toBeNull();
  });

  it("counts partial custom questions in category and total averages", () => {
    const SIM = DEFAULT_QUESTIONS.find((q) => q.category === "A" && q.type === "similarity")!.id;
    const ps: Participant[] = [
      {
        answers: {
          [CUSTOM]: { value: 80, answered: true, giveValue: 80 },
          [SIM]: { value: 50, answered: true },
        },
        customQuestions: [custom("reciprocal")],
      },
      { answers: { [CUSTOM]: full(20, 70), [SIM]: { value: 50, answered: true } } },
    ];
    expect(averageCompatDetail([CUSTOM, SIM], ps)).toEqual({
      score: 95,
      partialCount: 1,
      margin: 23,
    });
  });

  it("completion counts a partial Complementare answer only once both sides are set", () => {
    const q = custom("reciprocal");
    const partial = completionOf(
      [q],
      { answers: { [CUSTOM]: { value: 80, answered: true, giveValue: 80 } } },
      isReciprocal,
    );
    expect(partial).toEqual({ done: 0, total: 1 });
    expect(completionOf([q], { answers: { [CUSTOM]: full(80, 20) } }, isReciprocal)).toEqual({
      done: 1,
      total: 1,
    });
    // The same partial answer on a Normale question is complete.
    expect(
      completionOf(
        [custom()],
        { answers: { [CUSTOM]: { value: 80, answered: true } } },
        isReciprocal,
      ),
    ).toEqual({ done: 1, total: 1 });
  });
});

describe("default questions are unchanged", () => {
  it("every default question keeps its built-in type, even next to opposite custom entries", () => {
    const opposite = DEFAULT_QUESTIONS.map((q) => ({
      ...q,
      custom: true,
      type: q.type === "reciprocal" ? ("similarity" as const) : ("reciprocal" as const),
    }));
    for (const q of DEFAULT_QUESTIONS) {
      const ps: Participant[] = [{ answers: {}, customQuestions: opposite }, { answers: {} }];
      expect(typeAmong(q.id, ps)).toBe(q.type);
      expect(isReciprocal(q)).toBe(q.type === "reciprocal");
      expect(questionType(q.id)).toBe(q.type);
    }
  });

  it("default scores do not depend on custom definitions", () => {
    const R = DEFAULT_QUESTIONS.find((q) => q.type === "reciprocal")!.id;
    const S = DEFAULT_QUESTIONS.find((q) => q.type === "similarity")!.id;
    const answers = { [R]: full(100, 0), [S]: full(100, 0) };
    const plain = [{ answers }, { answers }];
    const withDefs = [
      {
        answers,
        customQuestions: [
          { id: R, type: "similarity" },
          { id: S, type: "reciprocal" },
        ],
      },
      { answers },
    ];
    expect(multiCompatDetail(R, withDefs)).toEqual(multiCompatDetail(R, plain));
    expect(multiCompatDetail(S, withDefs)).toEqual(multiCompatDetail(S, plain));
    expect(multiCompatDetail(R, plain)?.score).toBe(0);
    expect(multiCompatDetail(S, plain)?.score).toBe(100);
  });
});
