import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { StoreProvider, useStore } from "@/lib/store";
import { EMPTY_STATE } from "@/lib/types";

vi.mock("@/lib/db", () => ({
  loadState: vi.fn(async () => ({
    ...EMPTY_STATE,
    identity: { name: "Io", username: "iome", emojis: ["🐙", "🌙", "🔥"], createdAt: 1 },
  })),
  saveState: vi.fn(async () => {}),
  clearState: vi.fn(async () => {}),
}));

// The real pages, without a router: their Route exposes the component and an empty search.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const { Route: HomeRoute } = await import("@/routes/index");
const { Route: EroticRoute } = await import("@/routes/erotismo");

let api: ReturnType<typeof useStore> | null = null;
function Probe() {
  api = useStore();
  return null;
}

function renderPage(route: { options: { component?: unknown } }) {
  const Page = route.options.component as () => ReactNode;
  return render(
    <StoreProvider>
      <Probe />
      <Page />
    </StoreProvider>,
  );
}

const writeText = vi.fn(async () => {});
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

afterEach(() => {
  cleanup();
  api = null;
  writeText.mockClear();
});

async function openPill() {
  const pill = await screen.findByTestId("password-pill");
  fireEvent.click(pill);
  return screen.findByRole("dialog");
}

describe("owner password pill", () => {
  it("on / it sits left of the expand pill and manages the Generale password", async () => {
    renderPage(HomeRoute);
    await waitFor(() => expect(api?.ready).toBe(true));
    const pill = await screen.findByTestId("password-pill");
    expect(pill).toHaveTextContent("Proteggi con password");
    expect(pill).toHaveAttribute("data-active", "false");
    expect(pill.querySelector(".lucide-lock-open")).toBeTruthy();
    // Immediately to the left of the expand/collapse pill, in the same row.
    const expand = screen.getByRole("button", { name: /Comprimi tutte|Espandi tutte/ });
    expect(pill.nextElementSibling).toBe(expand);

    const dialog = await openPill();
    expect(within(dialog).getByText(/Comunica questa password/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Nuova password"), {
      target: { value: "girasole" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Attiva" }));

    await waitFor(() => expect(api!.state.protection.main?.password).toBe("girasole"));
    expect(api!.state.protection.erotic).toBeUndefined();
    // Shown in clear right away, without an eye toggle.
    expect(within(dialog).getByTestId("current-password")).toHaveTextContent("girasole");
    expect(within(dialog).queryByRole("button", { name: /mostra|nascondi/i })).toBeNull();
    const active = screen.getByTestId("password-pill");
    expect(active).toHaveTextContent("Password attiva");
    expect(active).toHaveAttribute("data-active", "true");
    expect(active.querySelector(".lucide-key-round")).toBeTruthy();
  });

  it("copies, edits (new keyVersion) and removes the password", async () => {
    renderPage(HomeRoute);
    await waitFor(() => expect(api?.ready).toBe(true));
    act(() => api!.setSectionPassword("main", "prima-pw"));
    const dialog = await openPill();
    expect(within(dialog).getByTestId("current-password")).toHaveTextContent("prima-pw");
    const v1 = api!.state.protection.main!.keyVersion;

    fireEvent.click(within(dialog).getByRole("button", { name: /Copia/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("prima-pw"));

    fireEvent.click(within(dialog).getByRole("button", { name: /Modifica/ }));
    const input = within(dialog).getByLabelText("Modifica password");
    expect(input).toHaveValue("prima-pw");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salva" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("almeno 8");
    fireEvent.change(input, { target: { value: "1234567" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salva" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("almeno 8");
    fireEvent.change(input, { target: { value: "seconda-pw" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(api!.state.protection.main?.password).toBe("seconda-pw"));
    expect(api!.state.protection.main!.keyVersion).toBe(v1 + 1);
    expect(within(dialog).getByTestId("current-password")).toHaveTextContent("seconda-pw");

    fireEvent.click(within(dialog).getByRole("button", { name: /Rimuovi/ }));
    await waitFor(() => expect(api!.state.protection.main).toBeUndefined());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("password-pill")).toHaveTextContent("Proteggi con password");
  });

  it("on /erotismo the pill manages the separate Erotismo password", async () => {
    renderPage(EroticRoute);
    await waitFor(() => expect(api?.ready).toBe(true));
    act(() => api!.setSectionPassword("main", "generale-pw"));
    const pill = await screen.findByTestId("password-pill");
    // The Generale password does not turn on the Erotismo pill.
    expect(pill).toHaveTextContent("Proteggi con password");

    const dialog = await openPill();
    expect(within(dialog).getByRole("heading")).toHaveTextContent("Erotismo");
    fireEvent.change(within(dialog).getByLabelText("Nuova password"), {
      target: { value: "erotismo-pw" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Attiva" }));
    await waitFor(() => expect(api!.state.protection.erotic?.password).toBe("erotismo-pw"));
    expect(api!.state.protection.main?.password).toBe("generale-pw");
    expect(screen.getByTestId("password-pill")).toHaveTextContent("Password attiva");
  });
});
