import { describe, expect, it } from "vitest";
import { runChecks, type CheckDef } from "@/lib/diagnostics/checks";
import { getEvents, startBuffer, stopBuffer } from "@/lib/diagnostics/buffer";

describe("diagnostic checks", () => {
  it("a throwing check becomes fail with a normalized code and does not block the next ones", async () => {
    startBuffer();
    const defs: CheckDef[] = [
      {
        id: "a",
        title: "A",
        category: "browser",
        run: async () => {
          const e = new Error("secret user@example.com payload");
          e.name = "QuotaExceededError";
          throw e;
        },
      },
      { id: "b", title: "B", category: "browser", run: async () => ({ status: "pass" }) },
      {
        id: "c",
        title: "C",
        category: "network",
        run: async () => ({ status: "skip", code: "no_safe_test_endpoint" }),
      },
      { id: "d", title: "D", category: "pwa", run: async () => ({ status: "not_applicable" }) },
    ];
    let t = 0;
    const res = await runChecks(defs, undefined, () => (t += 5));
    expect(res.map((r) => [r.id, r.status])).toEqual([
      ["a", "fail"],
      ["b", "pass"],
      ["c", "skip"],
      ["d", "not_applicable"],
    ]);
    expect(res[0]!.code).toBe("quota_exceeded");
    expect(res[0]!.durationMs).toBe(5);
    expect(JSON.stringify(res)).not.toContain("example.com");
    expect(JSON.stringify(getEvents())).not.toContain("secret");
    stopBuffer();
  });
});
