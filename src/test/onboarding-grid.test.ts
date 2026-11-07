import { describe, expect, it, vi } from "vitest";

import { ONBOARDING_GRID_KEY, clearOnboardingGrid, loadOrRollGrid } from "@/lib/onboarding-grid";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const GRID_A = ["🦊", "🌊", "⭐", "🍀", "🐙", "🌙", "🔥", "🍄", "🦋"];
const GRID_B = ["🐝", "🌵", "🍉", "🐢", "🎈", "🧊", "🌻", "🐳", "🪐"];

describe("onboarding emoji grid", () => {
  it("saves the first grid under questionar_onboarding_grid", () => {
    const storage = memoryStorage();
    expect(loadOrRollGrid(storage, () => GRID_A)).toEqual(GRID_A);
    expect(JSON.parse(storage.data.get(ONBOARDING_GRID_KEY)!)).toEqual(GRID_A);
    expect(ONBOARDING_GRID_KEY).toBe("questionar_onboarding_grid");
  });

  it("reuses the same 9 emoji after a reload instead of rolling again", () => {
    const storage = memoryStorage();
    loadOrRollGrid(storage, () => GRID_A);
    const roll = vi.fn(() => GRID_B);
    expect(loadOrRollGrid(storage, roll)).toEqual(GRID_A);
    expect(roll).not.toHaveBeenCalled();
  });

  it("rolls a new grid only after the profile has been created and the key cleared", () => {
    const storage = memoryStorage();
    loadOrRollGrid(storage, () => GRID_A);
    clearOnboardingGrid(storage);
    expect(storage.data.has(ONBOARDING_GRID_KEY)).toBe(false);
    expect(loadOrRollGrid(storage, () => GRID_B)).toEqual(GRID_B);
  });

  it("replaces a corrupted or incomplete saved grid", () => {
    const storage = memoryStorage();
    storage.setItem(ONBOARDING_GRID_KEY, JSON.stringify(["🦊", "🌊"]));
    expect(loadOrRollGrid(storage, () => GRID_B)).toEqual(GRID_B);
    storage.setItem(ONBOARDING_GRID_KEY, "{not json");
    expect(loadOrRollGrid(storage, () => GRID_A)).toEqual(GRID_A);
  });
});
