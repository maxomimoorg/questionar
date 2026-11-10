import { describe, expect, it } from "vitest";
import {
  BUFFER_MAX_AGE_MS,
  BUFFER_MAX_EVENTS,
  clearBuffer,
  getEvents,
  recordEvent,
  startBuffer,
  stopBuffer,
} from "@/lib/diagnostics/buffer";
import {
  coarsePlatform,
  normalizeError,
  sanitizeNote,
  sanitizePath,
} from "@/lib/diagnostics/redact";
import { buildReport } from "@/lib/diagnostics/report";
import { DIAG_DB_NAME } from "@/lib/diagnostics/checks";

describe("diagnostic buffer", () => {
  it("records nothing while inactive", () => {
    stopBuffer();
    clearBuffer();
    recordEvent("relay.ready");
    expect(getEvents()).toHaveLength(0);
  });

  it("rejects events outside the allow-list and redacts free-text values", () => {
    startBuffer();
    recordEvent("chat.message" as never, { text: "ciao" });
    recordEvent("relay.closed", { code: 1006, reason: "Contact @mario sent hi", "bad key!": "x" });
    const ev = getEvents();
    expect(ev).toHaveLength(1);
    expect(ev[0]!.data).toEqual({ code: 1006, reason: "redacted" });
    stopBuffer();
  });

  it("caps the buffer at 200 events and 30 minutes", () => {
    let t = 0;
    startBuffer(() => t);
    for (let i = 0; i < 250; i++) recordEvent("net.online");
    expect(getEvents()).toHaveLength(BUFFER_MAX_EVENTS);
    t += BUFFER_MAX_AGE_MS + 1;
    recordEvent("net.offline");
    expect(getEvents()).toHaveLength(1);
    stopBuffer();
  });
});

describe("redaction", () => {
  it("never keeps error messages", () => {
    expect(normalizeError(new TypeError("handle=@luca token=abc"))).toBe("type_error");
    expect(normalizeError("raw string")).toBe("unknown_error");
  });
  it("drops query strings and unknown paths", () => {
    expect(sanitizePath("https://x.app/confronto?h=@luca#k")).toBe("/confronto");
    expect(sanitizePath("/u/luca")).toBe("/:other");
  });
  it("masks personal data in notes and limits length", () => {
    const n = sanitizeNote(
      "mail a.b@c.it, @mario, https://x.y/?t=1 +39 333 1234567 eyJhbGciOiJIUzI1NiIsInR5cCI6",
    );
    expect(n).not.toMatch(/a\.b@c\.it|@mario|https|333|eyJ/);
    expect(sanitizeNote("x".repeat(900)).length).toBeLessThanOrEqual(500);
  });
  it("reports only browser family, major version and OS", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.6778.39 Mobile Safari/537.36";
    expect(coarsePlatform(ua)).toEqual({ browser: "chromium", browserMajor: "131", os: "android" });
  });
  it("uses a diagnostic database separate from the app's", () => {
    expect(DIAG_DB_NAME).toBe("questionar-diagnostics");
  });
});

describe("report", () => {
  const base = {
    sessionId: "s1",
    startedAt: 0,
    endedAt: 1000,
    appVersion: "1.0",
    buildMode: "test",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox/130.0",
    events: [],
  };
  it("is versioned, separates manual from automatic outcomes and counts each status", () => {
    const r = buildReport({
      ...base,
      checks: [
        { id: "a", title: "A", category: "browser", status: "pass", durationMs: 1 },
        {
          id: "b",
          title: "B",
          category: "pwa",
          status: "fail",
          durationMs: 1,
          code: "sw_not_registered",
        },
        { id: "c", title: "C", category: "network", status: "skip", durationMs: 0 },
      ],
      scenarios: [
        { id: "manual.backup", status: "passed", stepsDone: [0, 9], note: "ok, scrivimi a z@z.it" },
      ],
    });
    expect(r.schema).toBe("questionar-diagnostics");
    expect(r.version).toBe(1);
    expect(r.summary.automatic).toEqual({ pass: 1, fail: 1, skip: 1, not_applicable: 0 });
    expect(r.summary.manual.passed).toBe(1);
    expect(r.checks.every((c) => c.source === "automatic")).toBe(true);
    const sc = r.scenarios.find((s) => s.id === "manual.backup")!;
    expect(sc.source).toBe("manual_declared");
    expect(sc.stepsPerformed).toEqual(["Esporta il backup PNG"]);
    expect(sc.note).not.toContain("z@z.it");
    expect(r.scenarios.find((s) => s.id === "manual.relay")!.status).toBe("not_run");
    expect(r.limits.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain("Mozilla");
  });
});
