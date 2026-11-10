import { describe, expect, it } from "vitest";

import { isValidHandle } from "@/lib/handle";

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
