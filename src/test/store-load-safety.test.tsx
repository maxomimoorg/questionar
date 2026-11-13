import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { StoreProvider, useStore } from "@/lib/store";

const db = vi.hoisted(() => ({ fail: true, reads: 0, saves: 0 }));

vi.mock("@/lib/db", () => ({
  loadState: vi.fn(async () => {
    db.reads++;
    if (db.fail) throw new Error("locked");
    return { bio: "salvata", identity: null };
  }),
  saveState: vi.fn(async () => {
    db.saves++;
  }),
  clearState: vi.fn(async () => {}),
}));

let api: ReturnType<typeof useStore> | null = null;
function Probe() {
  api = useStore();
  return null;
}

afterEach(() => {
  cleanup();
  api = null;
  db.fail = true;
  db.reads = 0;
  db.saves = 0;
});

describe("saved profile read failure", () => {
  it("retries, then reports the error without ever saving an empty profile", async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await waitFor(() => expect(api?.loadError).toBe(true), { timeout: 3000 });
    expect(db.reads).toBe(3);
    expect(api?.ready).toBe(false);
    expect(db.saves).toBe(0);

    db.fail = false;
    act(() => api?.retryLoad());
    await waitFor(() => expect(api?.ready).toBe(true));
    expect(api?.loadError).toBe(false);
    expect(api?.state.bio).toBe("salvata");
  });
});
