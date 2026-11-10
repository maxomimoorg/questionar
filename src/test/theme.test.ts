import { describe, expect, it } from "vitest";
import { PALETTE, readableOn } from "@/lib/palette";
import { normalizeTheme } from "@/lib/theme";

const originals = [
  ["Rosso", "#ff3131"],
  ["Arancione", "#ff751f"],
  ["Giallo", "#ffde59"],
  ["Verde", "#7ed957"],
  ["Azzurro", "#0cc0df"],
  ["Turchese", "#0097b2"],
  ["Blu", "#004aad"],
  ["Viola", "#cb6ce6"],
  ["Rosa", "#ff66c4"],
];

describe("Brand theme", () => {
  it("preserves exactly the nine original bio text colors", () => {
    expect(PALETTE.map((p) => [p.label, p.hex])).toEqual(originals);
  });
  it("defaults to dark mode when nothing is saved", () => {
    expect(normalizeTheme(undefined)).toEqual({ mode: "dark" });
    expect(normalizeTheme(null)).toEqual({ mode: "dark" });
    expect(normalizeTheme({})).toEqual({ mode: "dark" });
  });
  it("keeps an explicitly saved light mode", () => {
    expect(normalizeTheme({ mode: "light" })).toEqual({ mode: "light" });
  });
  it("keeps an explicitly saved dark mode", () => {
    expect(normalizeTheme({ mode: "dark" })).toEqual({ mode: "dark" });
  });
  it("falls back to dark for invalid legacy preferences", () => {
    expect(normalizeTheme({ mode: "invalid", accent: 123, tint: "invalid" })).toEqual({
      mode: "dark",
    });
  });
  it("uses dark text on yellow and green bio colors", () => {
    expect(readableOn("#ffde59")).toBe("#000000");
    expect(readableOn("#7ed957")).toBe("#000000");
  });
});
