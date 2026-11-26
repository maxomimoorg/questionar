import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement as h, type ReactNode } from "react";

import { CompareCategories } from "@/components/compare/CompareCategories";
import { averageCompatDetail, formatCompat } from "@/lib/compat";
import { useComparePeople } from "@/lib/compare-people";
import { protectSnapshot, withPassword, type SectionPayload } from "@/lib/protection";
import { CATEGORIES, DEFAULT_QUESTIONS } from "@/lib/questions";
import { StoreProvider, buildSnapshot } from "@/lib/store";
import { EMPTY_STATE, type AppState, type Contact, type ProfileSnapshot } from "@/lib/types";
import { idbUnlockStorage } from "@/lib/unlock-db";
import { UnlockManager } from "@/lib/unlock-manager";
import { UnlockProvider } from "@/lib/unlocks";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => h("a", { href: "#" }, children),
}));
const saved = vi.hoisted(() => ({ state: null as unknown }));
vi.mock("@/lib/db", () => ({
  loadState: vi.fn(async () => saved.state),
  saveState: vi.fn(async () => {}),
  clearState: vi.fn(async () => {}),
}));

const [q1, q2] = DEFAULT_QUESTIONS.filter((q) => q.category === "I");
const I = CATEGORIES.filter((c) => c.key === "I");

/** Builds the snapshot a contact would send, Generale protected by `password`. */
async function contactSnapshot(
  name: string,
  values: [number, number],
  password?: string,
  base: AppState["protection"] = {},
): Promise<ProfileSnapshot> {
  const state: AppState = {
    ...EMPTY_STATE,
    identity: { name, username: name.toLowerCase(), emojis: ["🦊", "🌙", "⭐"], createdAt: 1 },
    answers: {
      [q1!.id]: { value: values[0], answered: true, comment: `commento di ${name}` },
      [q2!.id]: { value: values[1], answered: true },
    },
  };
  const protection = password ? withPassword(base, "main", password) : {};
  return protectSnapshot(buildSnapshot(state, 2), protection, DEFAULT_QUESTIONS);
}

const contact = (handle: string, name: string, snapshot: ProfileSnapshot): Contact => ({
  handle,
  name,
  emojis: [],
  snapshot,
});

function myState(contacts: Contact[]): AppState {
  return {
    ...EMPTY_STATE,
    identity: { name: "Io", username: "iome", emojis: ["🐙", "🌙", "🔥"], createdAt: 1 },
    answers: {
      [q1!.id]: { value: 70, answered: true },
      [q2!.id]: { value: 50, answered: true },
    },
    contacts,
  };
}

function Compare({ b, c }: { b: string; c?: string }) {
  const { people, participants, allQuestions } = useComparePeople(b, c);
  const total = averageCompatDetail(
    allQuestions.map((q) => q.id),
    participants,
  );
  return h(
    "div",
    null,
    h("output", { "data-testid": "total" }, formatCompat(total)),
    h(CompareCategories, {
      categories: I,
      allQuestions,
      people,
      defaultOpen: true,
      section: "main",
    }),
  );
}

function renderCompare(b: string, c?: string) {
  return render(h(StoreProvider, null, h(UnlockProvider, null, h(Compare, c ? { b, c } : { b }))));
}

const category = () => document.querySelector<HTMLElement>('[data-category="I"]')!;

beforeEach(async () => {
  await idbUnlockStorage.clear();
  toastSuccess.mockClear();
});
afterEach(cleanup);

describe("comparison with a password-protected questionnaire", () => {
  it("shows the category means and a password card instead of the answers", async () => {
    saved.state = myState([
      contact("luna", "Luna", await contactSnapshot("Luna", [80, 60], "luna-pw")),
    ]);
    renderCompare("luna");
    const card = await screen.findByTestId("password-unlock-card");
    expect(card).toHaveTextContent("Risposte di Luna protette");
    // Means 60/70, both with σ=10: expected gap √(10² + 2/π·(10²+10²)) ≈ 15 → ≈85% ±12%.
    expect(within(category()).getByRole("button", { name: /categoria Finanze/ })).toHaveTextContent(
      "≈85%±12%",
    );
    expect(screen.getByTestId("total")).toHaveTextContent("≈85%");
    expect(category()).not.toHaveTextContent("commento di Luna");
    expect(category()).not.toHaveTextContent("Luna:");
  });

  it("unlocks with the right password: toast, answers shown, no leftover lock icons", async () => {
    saved.state = myState([
      contact("luna", "Luna", await contactSnapshot("Luna", [80, 60], "luna-pw")),
    ]);
    renderCompare("luna");
    const card = await screen.findByTestId("password-unlock-card");
    fireEvent.change(within(card).getByLabelText("Password di Luna"), {
      target: { value: "luna-pw" },
    });
    fireEvent.click(within(card).getByRole("button", { name: /Sblocca/ }));

    await waitFor(() => expect(screen.queryByTestId("password-unlock-card")).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith("Questionario sbloccato", expect.anything());
    expect(category()).toHaveTextContent("Luna:");
    expect(category()).toHaveTextContent("commento di Luna");
    // Exact per-question score again: (90 + 90) / 2.
    expect(screen.getByTestId("total")).toHaveTextContent(/^90%$/);
    expect(document.querySelector(".lucide-lock-keyhole, .lucide-lock-open")).toBeNull();
  });

  it("refuses a wrong password and applies the progressive delay 0s, 1s, 2s, 5s", async () => {
    const snap = await contactSnapshot("Luna", [80, 60], "luna-pw");
    let now = 1_000_000;
    const m = new UnlockManager(idbUnlockStorage, () => now);
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      expect(m.waitSeconds("luna", "main")).toBe(0);
      const r = await m.unlock("luna", "main", snap.mainProtected!, "sbagliata");
      expect(r.status).toBe("wrong");
      delays.push(r.status === "wrong" ? r.waitSeconds : -1);
      // Trying again too soon does not even test the password.
      if (delays[i]! > 0) {
        expect((await m.unlock("luna", "main", snap.mainProtected!, "luna-pw")).status).toBe(
          "wait",
        );
      }
      now += delays[i]! * 1000;
    }
    expect([0, ...delays]).toEqual([0, 1, 2, 5, 5]);
    expect((await m.unlock("luna", "main", snap.mainProtected!, "luna-pw")).status).toBe("ok");
    expect(m.waitSeconds("luna", "main")).toBe(0);
  });

  it("remembers the unlocked key in IndexedDB until the contact sets a new keyVersion", async () => {
    const first = await contactSnapshot("Luna", [80, 60], "luna-pw");
    const m = new UnlockManager(idbUnlockStorage);
    expect((await m.unlock("luna", "main", first.mainProtected!, "luna-pw")).status).toBe("ok");
    const stored = await idbUnlockStorage.get("luna", "main");
    expect(stored?.keyVersion).toBe(first.mainProtected!.keyVersion);
    expect(JSON.stringify(stored)).not.toContain("luna-pw");

    // "Restart": a new manager and a new UI open it with the saved key, no password asked.
    const restarted = new UnlockManager(idbUnlockStorage);
    const payload = (await restarted.restore(
      "luna",
      "main",
      first.mainProtected!,
    )) as SectionPayload;
    expect(payload.answers[q1!.id]?.value).toBe(80);
    saved.state = myState([contact("luna", "Luna", first)]);
    renderCompare("luna");
    await waitFor(() => expect(category()).toHaveTextContent("Luna:"));
    expect(screen.queryByTestId("password-unlock-card")).toBeNull();
    cleanup();

    // Luna changes password: keyVersion 2 → the old key is dropped and the card is back.
    const changed = await contactSnapshot(
      "Luna",
      [80, 60],
      "nuova-pw",
      withPassword({}, "main", "luna-pw"),
    );
    expect(changed.mainProtected!.keyVersion).toBe(2);
    expect(await restarted.restore("luna", "main", changed.mainProtected!)).toBeNull();
    expect(await idbUnlockStorage.get("luna", "main")).toBeNull();
    saved.state = myState([contact("luna", "Luna", changed)]);
    renderCompare("luna");
    expect(await screen.findByTestId("password-unlock-card")).toBeTruthy();
  });
});

describe("three-way comparison with protected participants", () => {
  it("asks B and C separately; unlocking B keeps C locked and shows B's answers", async () => {
    saved.state = myState([
      contact("luna", "Luna", await contactSnapshot("Luna", [80, 60], "luna-pw")),
      contact("sole", "Sole", await contactSnapshot("Sole", [20, 40], "sole-pw")),
    ]);
    renderCompare("luna", "sole");
    await waitFor(() => expect(screen.getAllByTestId("password-unlock-card")).toHaveLength(2));
    const cardOf = (handle: string) =>
      screen
        .getAllByTestId("password-unlock-card")
        .find((el) => el.getAttribute("data-handle") === handle)!;
    expect(cardOf("luna")).toHaveTextContent("Luna");
    expect(cardOf("sole")).toHaveTextContent("Sole");

    // Sole's password does not open Luna's questionnaire.
    fireEvent.change(within(cardOf("luna")).getByLabelText("Password di Luna"), {
      target: { value: "sole-pw" },
    });
    fireEvent.click(within(cardOf("luna")).getByRole("button", { name: /Sblocca/ }));
    await waitFor(() =>
      expect(within(cardOf("luna")).getByRole("alert")).toHaveTextContent("non corretta"),
    );
    await new Promise((r) => setTimeout(r, 1100)); // first wrong attempt: wait 1 s

    fireEvent.change(within(cardOf("luna")).getByLabelText("Password di Luna"), {
      target: { value: "luna-pw" },
    });
    fireEvent.click(within(cardOf("luna")).getByRole("button", { name: /Sblocca/ }));
    await waitFor(() => expect(screen.getAllByTestId("password-unlock-card")).toHaveLength(1));
    expect(cardOf("sole")).toBeTruthy();
    // Luna's answers are visible against mine while Sole is still locked.
    expect(category()).toHaveTextContent("Luna:");
    expect(category()).not.toHaveTextContent("Sole:");
    // The total still estimates Sole's part from her clear means.
    expect(screen.getByTestId("total").textContent).toMatch(/^≈\d+%$/);
  });

  it("estimates totally and partially protected groups from the clear means", async () => {
    const luna = await contactSnapshot("Luna", [80, 60], "luna-pw");
    const sole = await contactSnapshot("Sole", [20, 40]);
    const ids = [q1!.id, q2!.id];
    const me = { answers: myState([]).answers };
    const lockedLuna = { answers: {}, locked: ["main" as const], averages: luna.mainAverages! };
    const plainSole = { answers: sole.answers };
    // Me–Luna 85 (σ=10 each), me–Sole exact 70, Luna–Sole 58 (means 70/30, σ=10 each).
    const partial = averageCompatDetail(ids, [me, lockedLuna, plainSole]);
    expect(partial).toMatchObject({ score: 71, margin: 8, estimated: true });
    const lockedSole = { answers: {}, locked: ["main" as const], averages: { I: 30 } };
    // Sole's old scalar format keeps legacy scores: 85, 70 and 60; every estimate has ±12%.
    expect(averageCompatDetail(ids, [me, lockedLuna, lockedSole])).toMatchObject({
      score: 72,
      margin: 12,
      estimated: true,
    });
    // Nobody protected: unchanged exact maths.
    expect(averageCompatDetail(ids, [me, plainSole])).toEqual({
      score: 70,
      partialCount: 0,
      margin: 0,
    });
  });
});
