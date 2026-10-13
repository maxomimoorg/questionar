import type { ThemeState } from "./types";

/** Single brand theme: only the light/dark mode is user-switchable. Dark is the default. */
export function normalizeTheme(saved: unknown): ThemeState {
  const theme = saved && typeof saved === "object" ? (saved as Partial<ThemeState>) : {};
  return { mode: theme.mode === "light" ? "light" : "dark" };
}
