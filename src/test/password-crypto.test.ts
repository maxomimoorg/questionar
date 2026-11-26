import { describe, expect, it, vi } from "vitest";

import {
  IV_BYTES,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  WrongPasswordError,
  decryptJson,
  deriveKey,
  encryptJson,
  fromBase64,
  newSalt,
  openWithPassword,
} from "@/lib/password-crypto";
import {
  categoryAverages,
  nextKeyVersion,
  openSectionWithPassword,
  protectSnapshot,
  withPassword,
  withoutPassword,
} from "@/lib/protection";
import { DEFAULT_QUESTIONS } from "@/lib/questions";
import { buildSnapshot } from "@/lib/store";
import { EMPTY_STATE, sanitizeSnapshot, type AppState, type ProfileSnapshot } from "@/lib/types";

const MAIN_PW = "girasole-42";
const EROTIC_PW = "luna-segreta";

const mainQ = DEFAULT_QUESTIONS.filter((q) => q.category === "I");
const eroticQ = DEFAULT_QUESTIONS.filter((q) => q.category === "XA");

function stateWith(protection: AppState["protection"]): AppState {
  return {
    ...EMPTY_STATE,
    identity: { name: "Io", username: "iome", emojis: ["🐙", "🌙", "🔥"], createdAt: 1 },
    answers: {
      [mainQ[0]!.id]: { value: 80, answered: true, comment: "commento generale" },
      [mainQ[1]!.id]: { value: 40, answered: true },
      [eroticQ[0]!.id]: { value: 90, answered: true, comment: "commento erotismo" },
    },
    customQuestions: [
      { id: "J-cucinare", category: "J", text: "Cucinare", custom: true, type: "similarity" },
      { id: "XA-massaggi", category: "XA", text: "Massaggi", custom: true, type: "similarity" },
    ],
    protection,
  };
}

const questionsOf = (s: AppState) => [...DEFAULT_QUESTIONS, ...s.customQuestions];

describe("password crypto (PBKDF2 + AES-256-GCM)", () => {
  it("derives with PBKDF2-SHA-256, 600 000 iterations, 128-bit salt; encrypts and decrypts", async () => {
    const spy = vi.spyOn(crypto.subtle, "deriveKey");
    const salt = newSalt();
    expect(fromBase64(salt)).toHaveLength(SALT_BYTES);
    const key = await deriveKey(MAIN_PW, salt);
    const params = spy.mock.calls[0]![0] as Pbkdf2Params;
    expect(params).toMatchObject({ name: "PBKDF2", hash: "SHA-256", iterations: 600_000 });
    expect(PBKDF2_ITERATIONS).toBe(600_000);
    expect(spy.mock.calls[0]![2]).toEqual({ name: "AES-GCM", length: 256 });
    spy.mockRestore();
    expect(key.extractable).toBe(false);

    const value = { hello: "mondo", n: 7 };
    const box = await encryptJson(key, salt, 1, value);
    expect(fromBase64(box.iv)).toHaveLength(IV_BYTES);
    // 128-bit authentication tag appended to the ciphertext.
    expect(fromBase64(box.ciphertext)).toHaveLength(JSON.stringify(value).length + 16);
    expect(await decryptJson(key, box)).toEqual(value);
    // A fresh IV for every encryption.
    const again = await encryptJson(key, salt, 1, value);
    expect(again.iv).not.toBe(box.iv);
    expect((await openWithPassword(MAIN_PW, box)).value).toEqual(value);
  });

  it("rejects a wrong password with a controlled WrongPasswordError", async () => {
    const salt = newSalt();
    const box = await encryptJson(await deriveKey(MAIN_PW, salt), salt, 1, { a: 1 });
    await expect(openWithPassword("sbagliata", box)).rejects.toBeInstanceOf(WrongPasswordError);
    // A tampered ciphertext is refused the same way.
    const bytes = fromBase64(box.ciphertext);
    bytes[0] = bytes[0]! ^ 1;
    const tampered = { ...box, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(openWithPassword(MAIN_PW, tampered)).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe("two independent compartments (Generale / Erotismo)", () => {
  it("keeps each section in its own box, opened only by its own password", async () => {
    const protection = withPassword(withPassword({}, "main", MAIN_PW), "erotic", EROTIC_PW);
    const state = stateWith(protection);
    const snap = await protectSnapshot(buildSnapshot(state, 5), protection, questionsOf(state));

    // Nothing of either section is left in clear.
    expect(snap.answers).toEqual({});
    expect(snap.customQuestions).toEqual([]);
    expect(snap.mainProtected!.salt).not.toBe(snap.eroticProtected!.salt);

    const main = await openSectionWithPassword(MAIN_PW, snap.mainProtected!, "main");
    expect(Object.keys(main.payload.answers).sort()).toEqual([mainQ[0]!.id, mainQ[1]!.id].sort());
    expect(main.payload.answers[mainQ[0]!.id]!.comment).toBe("commento generale");
    expect(main.payload.customQuestions.map((q) => q.id)).toEqual(["J-cucinare"]);

    const erotic = await openSectionWithPassword(EROTIC_PW, snap.eroticProtected!, "erotic");
    expect(Object.keys(erotic.payload.answers)).toEqual([eroticQ[0]!.id]);
    expect(erotic.payload.customQuestions.map((q) => q.id)).toEqual(["XA-massaggi"]);

    // The other section's password never opens a box.
    await expect(
      openSectionWithPassword(MAIN_PW, snap.eroticProtected!, "erotic"),
    ).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(
      openSectionWithPassword(EROTIC_PW, snap.mainProtected!, "main"),
    ).rejects.toBeInstanceOf(WrongPasswordError);

    // Clear aggregates per category; the encrypted answers themselves stay opaque.
    expect(snap.mainAverages).toEqual({
      I: { mean: 60, simMean: 60, giveMean: null, recvMean: null, stdDev: 20 },
    });
    expect(snap.eroticAverages).toEqual({
      XA: { mean: 90, simMean: null, giveMean: 90, recvMean: 90, stdDev: 0 },
    });
  });

  it("protecting only Generale leaves Erotismo travelling in clear", async () => {
    const protection = withPassword({}, "main", MAIN_PW);
    const state = stateWith(protection);
    const snap = await protectSnapshot(buildSnapshot(state, 5), protection, questionsOf(state));
    expect(Object.keys(snap.answers)).toEqual([eroticQ[0]!.id]);
    expect(snap.customQuestions.map((q) => q.id)).toEqual(["XA-massaggi"]);
    expect(snap.eroticProtected).toBeUndefined();
    expect(snap.eroticAverages).toBeUndefined();
    expect(snap.mainProtected).toBeDefined();
  });

  it("without a password the snapshot is exactly the old clear format", async () => {
    const state = stateWith({});
    const clear = buildSnapshot(state, 5);
    expect(await protectSnapshot(clear, {}, questionsOf(state))).toEqual(clear);
  });

  it("a new or re-set password always gets a new keyVersion and salt", () => {
    const a = withPassword({}, "main", "uno-uno");
    expect(a.main!.keyVersion).toBe(1);
    const b = withPassword(a, "main", "due-due");
    expect(b.main!.keyVersion).toBe(2);
    expect(b.main!.salt).not.toBe(a.main!.salt);
    const removed = withoutPassword(b, "main");
    expect(removed.main).toBeUndefined();
    expect(nextKeyVersion(removed, "main")).toBe(3);
    // Sections count versions independently.
    expect(withPassword(b, "erotic", "tre-tre").erotic!.keyVersion).toBe(1);
  });

  it("means skip unanswered, hidden questions and hidden categories", () => {
    const answers = {
      [mainQ[0]!.id]: { value: 80, answered: true },
      [mainQ[1]!.id]: { value: 20, answered: true, hidden: true },
      [mainQ[2]!.id]: { value: 10, answered: false },
    };
    expect(categoryAverages(answers, DEFAULT_QUESTIONS, [], "main")).toEqual({
      I: { mean: 80, simMean: 80, giveMean: null, recvMean: null, stdDev: 0 },
    });
    expect(categoryAverages(answers, DEFAULT_QUESTIONS, ["I"], "main")).toEqual({});
  });
});

describe("passwords never leave the device", () => {
  it("sanitizeSnapshot and the shared snapshot never contain a clear password", async () => {
    const protection = withPassword(withPassword({}, "main", MAIN_PW), "erotic", EROTIC_PW);
    const state = stateWith(protection);
    const base = buildSnapshot(state, 5);
    expect(base).not.toHaveProperty("protection");
    const shared = sanitizeSnapshot(await protectSnapshot(base, protection, questionsOf(state)));
    const text = JSON.stringify(shared);
    expect(text).not.toContain(MAIN_PW);
    expect(text).not.toContain(EROTIC_PW);
    expect(text).not.toContain("commento");

    // Even a snapshot polluted with password fields is cleaned on send and receive.
    const polluted = {
      ...shared,
      protection,
      password: MAIN_PW,
      mainProtected: { ...shared.mainProtected!, password: MAIN_PW },
    } as unknown as ProfileSnapshot;
    const clean = JSON.stringify(sanitizeSnapshot(polluted));
    expect(clean).not.toContain(MAIN_PW);
    expect(clean).not.toContain(EROTIC_PW);
    expect(Object.keys(sanitizeSnapshot(polluted)).sort()).toEqual(
      [
        "answers",
        "bio",
        "customQuestions",
        "eroticAverages",
        "eroticProtected",
        "hiddenCategories",
        "mainAverages",
        "mainProtected",
        "name",
        "tags",
        "updatedAt",
      ].sort(),
    );
  });
});
