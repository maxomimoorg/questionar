// Onboarding emoji grid frozen across reloads: rolling again on refresh would let people
// "re-roll" until they get rare emoji. The grid is dropped only once the profile exists.
import { rollPickerEmojis } from "./emoji";

export const ONBOARDING_GRID_KEY = "questionar_onboarding_grid";
export const GRID_SIZE = 9;

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): KV | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage disabled (private mode, policies)
  }
}

function isValidGrid(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === GRID_SIZE &&
    value.every((e) => typeof e === "string" && e.length > 0 && e.length <= 16) &&
    new Set(value).size === GRID_SIZE
  );
}

/** Returns the saved grid, or rolls a new one and saves it. */
export function loadOrRollGrid(
  storage: KV | null = browserStorage(),
  roll: () => string[] = rollPickerEmojis,
): string[] {
  try {
    const raw = storage?.getItem(ONBOARDING_GRID_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidGrid(parsed)) return parsed;
    }
  } catch {
    /* corrupted value: roll a new grid */
  }
  const grid = roll();
  try {
    storage?.setItem(ONBOARDING_GRID_KEY, JSON.stringify(grid));
  } catch {
    /* quota or disabled storage: the grid simply won't survive a reload */
  }
  return grid;
}

/** Call only after the profile and identity have been created successfully. */
export function clearOnboardingGrid(storage: KV | null = browserStorage()) {
  try {
    storage?.removeItem(ONBOARDING_GRID_KEY);
  } catch {
    /* ignore */
  }
}
