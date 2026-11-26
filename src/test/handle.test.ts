import { describe, expect, it } from "vitest";

import { emojisFromHandle, isValidHandle, normalizeHandle } from "@/lib/handle";

describe("handle check", () => {
  it("accepts a username followed by exactly 3 emoji, including skin tones and variation selectors", () => {
    expect(isValidHandle("luna🦊🌊⭐")).toBe(true);
    expect(isValidHandle("luna👍🏽❤️⭐")).toBe(true);
  });
  it("rejects 2 or 4 emoji and stray letters among the emoji", () => {
    expect(isValidHandle("luna🦊🌊")).toBe(false);
    expect(isValidHandle("luna🦊🌊⭐🍀")).toBe(false);
    expect(isValidHandle("luna🦊a🌊⭐")).toBe(false);
  });
});

describe("handle with leading @", () => {
  it("strips a leading @ and surrounding spaces", () => {
    expect(normalizeHandle("  @luna🦊🌊⭐ ")).toBe("luna🦊🌊⭐");
    expect(normalizeHandle("luna🦊🌊⭐")).toBe("luna🦊🌊⭐");
  });
  it("accepts @handle as valid and still rejects wrong ones", () => {
    expect(isValidHandle("@luna🦊🌊⭐")).toBe(true);
    expect(isValidHandle("@lun🦊🌊⭐")).toBe(false);
    expect(isValidHandle("@@luna🦊🌊⭐")).toBe(false);
  });
  it("extracts emoji from an @handle", () => {
    expect(emojisFromHandle("@luna🦊🌊⭐")).toEqual(["🦊", "🌊", "⭐"]);
  });
});
