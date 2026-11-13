import { afterEach, describe, expect, it, vi } from "vitest";

import { avatarDataUri, avatarSvg } from "@/lib/avatar";

afterEach(() => vi.restoreAllMocks());

describe("offline avatars", () => {
  it("are generated without any network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const uri = avatarDataUri("giacoma🦊🌙⭐");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("are deterministic per handle and differ between handles", () => {
    expect(avatarSvg("anna🐱")).toBe(avatarSvg("anna🐱"));
    expect(avatarSvg("anna🐱")).not.toBe(avatarSvg("bruno🐶"));
  });

  it("use the requested size for the backup card", () => {
    expect(avatarSvg("anna🐱", 700)).toContain('width="700"');
  });
});
