import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { Questionnaire } from "@/components/Questionnaire";
import { CATEGORIES } from "@/lib/questions";
import { StoreProvider, useStore } from "@/lib/store";
import { EMPTY_STATE, type AppState } from "@/lib/types";

const saved = vi.hoisted(() => ({ calls: [] as unknown[] }));
const legacyState = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/lib/db", () => ({
  loadState: vi.fn(async () => legacyState.value),
  saveState: vi.fn(async (s: unknown) => {
    saved.calls.push(JSON.parse(JSON.stringify(s)));
  }),
  clearState: vi.fn(async () => {}),
}));

let api: ReturnType<typeof useStore> | null = null;
function Probe() {
  api = useStore();
  return null;
}

const J = CATEGORIES.filter((c) => c.key === "J");

function renderApp() {
  return render(
    <StoreProvider>
      <Probe />
      <Questionnaire categories={J} defaultOpen hiddenKey="hidden-main" />
    </StoreProvider>,
  );
}

const lastSaved = () => saved.calls[saved.calls.length - 1] as AppState;

afterEach(() => {
  cleanup();
  saved.calls = [];
  legacyState.value = null;
  api = null;
});

describe("custom question type selection", () => {
  it("defaults to Normale, saves Complementare and shows Fare/Ricevere sliders", async () => {
    renderApp();
    await waitFor(() => expect(api?.ready).toBe(true));

    const group = screen.getByRole("radiogroup", { name: "Tipo di domanda" });
    expect(within(group).getByRole("radio", { name: "Normale" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(group).getByRole("radio", { name: "Complementare" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    fireEvent.click(within(group).getByRole("radio", { name: "Complementare" }));
    fireEvent.change(screen.getByPlaceholderText("Scrivi la tua domanda"), {
      target: { value: "Cucinare" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));

    const card = await waitFor(() => document.getElementById("q-J-cucinare")!);
    expect(card).toBeTruthy();
    expect(within(card).getByTestId("custom-type")).toHaveTextContent("Complementare");
    expect(within(card).getByRole("slider", { name: /^Fare/ })).toBeTruthy();
    expect(within(card).getByRole("slider", { name: /^Ricevere/ })).toBeTruthy();
    // The selector goes back to the default for the next question.
    expect(within(group).getByRole("radio", { name: "Normale" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.change(screen.getByPlaceholderText("Scrivi la tua domanda"), {
      target: { value: "Ballare" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
    const normal = await waitFor(() => document.getElementById("q-J-ballare")!);
    expect(within(normal).getByTestId("custom-type")).toHaveTextContent("Normale");
    expect(within(normal).getAllByRole("slider")).toHaveLength(1);

    await waitFor(() =>
      expect(lastSaved().customQuestions.map((q) => [q.id, q.type])).toEqual([
        ["J-cucinare", "reciprocal"],
        ["J-ballare", "similarity"],
      ]),
    );
    expect(api!.mySnapshot().customQuestions.map((q) => q.type)).toEqual([
      "reciprocal",
      "similarity",
    ]);
  });

  it("a partial Complementare answer stays incomplete until both sides are answered", async () => {
    renderApp();
    await waitFor(() => expect(api?.ready).toBe(true));
    act(() => api!.addCustomQuestion("J", "Cucinare", "reciprocal"));
    const card = await waitFor(() => document.getElementById("q-J-cucinare")!);
    const section = card.closest("section")!;
    const before = within(section).getByTestId("completion").textContent;

    fireEvent.keyDown(within(card).getByRole("slider", { name: /^Fare/ }), { key: "ArrowRight" });
    expect(await within(card).findByText(/Risposta parziale/)).toBeTruthy();
    expect(within(section).getByTestId("completion").textContent).toBe(before);

    fireEvent.keyDown(within(card).getByRole("slider", { name: /^Ricevere/ }), {
      key: "ArrowLeft",
    });
    await waitFor(() => expect(within(card).queryByText(/Risposta parziale/)).toBeNull());
    expect(api!.state.answers["J-cucinare"]).toMatchObject({
      answered: true,
      giveValue: 51,
      receiveValue: 49,
      value: 50,
    });
  });

  it("loads legacy custom questions without a type as Normale and imports only valid types", async () => {
    legacyState.value = {
      ...EMPTY_STATE,
      identity: null,
      customQuestions: [{ id: "J-vecchia", category: "J", text: "Vecchia", custom: true }],
    };
    renderApp();
    await waitFor(() => expect(api?.ready).toBe(true));
    const card = document.getElementById("q-J-vecchia")!;
    expect(within(card).getByTestId("custom-type")).toHaveTextContent("Normale");
    expect(within(card).getAllByRole("slider")).toHaveLength(1);

    act(() =>
      api!.applyBackup({
        v: 1,
        name: "",
        handle: "x",
        bio: "",
        answers: {},
        customQuestions: [
          { id: "J-vecchia", category: "J", text: "Vecchia", custom: true, type: "reciprocal" },
          { id: "J-nuova", category: "J", text: "Nuova", custom: true, type: "reciprocal" },
          { id: "J-strana", category: "J", text: "Strana", custom: true, type: "boh" as never },
        ],
        savedAt: 1,
      }),
    );
    // The question already on the profile keeps its own definition.
    expect(api!.state.customQuestions.map((q) => [q.id, q.type])).toEqual([
      ["J-vecchia", "similarity"],
      ["J-nuova", "reciprocal"],
      ["J-strana", "similarity"],
    ]);
  });

  it("answering a contact's custom question keeps its type", async () => {
    renderApp();
    await waitFor(() => expect(api?.ready).toBe(true));
    act(() => api!.ensureQuestion("J-sua", "Sua", "reciprocal"));
    const card = await waitFor(() => document.getElementById("q-J-sua")!);
    expect(within(card).getByRole("slider", { name: /^Fare/ })).toBeTruthy();
  });
});
