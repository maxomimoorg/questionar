// Viste reali del confronto (CompareCategories + useComparePeople) sul dispositivo di Io, con
// Luna e Sole in rubrica come li inviano: bloccati, sbloccati e a tre.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement as h, type ReactNode } from "react";

import { CompareCategories } from "@/components/compare/CompareCategories";
import { averageCompatDetail, formatCompat } from "@/lib/compat";
import { useComparePeople } from "@/lib/compare-people";
import { CATEGORIES, EROTISMO_CATEGORIES, type ProtectedSection } from "@/lib/questions";
import { StoreProvider } from "@/lib/store";
import { idbUnlockStorage } from "@/lib/unlock-db";
import { UnlockProvider } from "@/lib/unlocks";
import { ioWithContacts, TRIO_PASSWORDS, trioHandle } from "./fixtures/trio";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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

const LUNA = trioHandle("luna");
const SOLE = trioHandle("sole");

function Compare({ b, c, section }: { b: string; c?: string; section: ProtectedSection }) {
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
      categories: section === "main" ? CATEGORIES : EROTISMO_CATEGORIES,
      allQuestions,
      people,
      defaultOpen: true,
      section,
    }),
  );
}

async function renderCompare(section: ProtectedSection, b: string, c?: string) {
  saved.state = await ioWithContacts();
  return render(
    h(
      StoreProvider,
      null,
      h(UnlockProvider, null, h(Compare, { b, ...(c ? { c } : {}), section })),
    ),
  );
}

const header = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`categoria ${label}$`) });
const drawer = (key: string) => document.querySelector<HTMLElement>(`[data-category="${key}"]`);
const cards = () => screen.queryAllByTestId("password-unlock-card");
const cardOf = (handle: string) => cards().find((el) => el.getAttribute("data-handle") === handle)!;

async function unlock(handle: string, name: string, password: string) {
  const card = cardOf(handle);
  fireEvent.change(within(card).getByLabelText(`Password di ${name}`), {
    target: { value: password },
  });
  fireEvent.click(within(card).getByRole("button", { name: /Sblocca/ }));
  await waitFor(() => expect(cardOf(handle)).toBeUndefined());
}

beforeEach(async () => {
  await idbUnlockStorage.clear();
});
afterEach(cleanup);

describe("trio: confronto con Luna (Generale protetto)", () => {
  it("bloccato: medie stimate, nessun commento di Luna, scheda per la password", async () => {
    await renderCompare("main", LUNA);
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(cardOf(LUNA)).toHaveTextContent("Luna");
    expect(header("Impegno per la stabilità").parentElement).toHaveTextContent("≈70%±19%");
    expect(header("Autonomia").parentElement).toHaveTextContent("≈91%±12%");
    expect(drawer("G")).toBeNull();
    expect(document.body).not.toHaveTextContent("Commento privato di Luna");
  });

  it("sbloccato: punteggi esatti e commento visibile", async () => {
    await renderCompare("main", LUNA);
    await waitFor(() => expect(cards()).toHaveLength(1));
    await unlock(LUNA, "Luna", TRIO_PASSWORDS.luna.main);
    await waitFor(() =>
      expect(header("Impegno per la stabilità").parentElement).toHaveTextContent("109%"),
    );
    expect(header("Impegno per la stabilità").parentElement).not.toHaveTextContent("≈");
    expect(header("Autonomia").parentElement).toHaveTextContent("107%");
    expect(header("Comunicazione").parentElement).toHaveTextContent("47%");
    expect(drawer("H")).toHaveTextContent("Commento privato di Luna");
    expect(screen.getByTestId("total")).toHaveTextContent(/^74%$/);
  });

  it("Erotismo di Luna in chiaro: nessuna password chiesta, Vanilla 110%", async () => {
    await renderCompare("erotic", LUNA);
    await waitFor(() => expect(header("Vanilla").parentElement).toHaveTextContent("110%"));
    expect(cards()).toHaveLength(0);
    expect(header("Sadismo e Masochismo").parentElement).toHaveTextContent("-20%");
  });
});

describe("trio: confronto a tre", () => {
  it("Generale: chiede solo Luna; sbloccata dà i punteggi esatti a tre", async () => {
    await renderCompare("main", LUNA, SOLE);
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(cardOf(LUNA)).toBeTruthy();
    expect(header("Impegno per la stabilità").parentElement).toHaveTextContent("≈83%±13%");
    await unlock(LUNA, "Luna", TRIO_PASSWORDS.luna.main);
    await waitFor(() =>
      expect(header("Impegno per la stabilità").parentElement).toHaveTextContent("114%"),
    );
    expect(header("Tempo di qualità").parentElement).toHaveTextContent("71%");
    expect(header("Autonomia").parentElement).toHaveTextContent("27%");
  });

  it("Erotismo: chiede solo Sole; sbloccata dà i punteggi esatti a tre", async () => {
    await renderCompare("erotic", LUNA, SOLE);
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(cardOf(SOLE)).toHaveTextContent("Sole");
    expect(drawer("XA")).toBeNull();
    expect(header("Sadismo e Masochismo").parentElement).toHaveTextContent("≈27%±8%");
    await unlock(SOLE, "Sole", TRIO_PASSWORDS.sole.erotic);
    await waitFor(() =>
      expect(header("Sadismo e Masochismo").parentElement).toHaveTextContent("22%"),
    );
    expect(header("Altre dinamiche").parentElement).toHaveTextContent("42%");
  });
});
