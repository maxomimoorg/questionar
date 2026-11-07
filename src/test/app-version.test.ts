import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { appVersion } from "@/components/diagnostics/DiagnosticsPanel";
import { buildReport } from "@/lib/diagnostics/report";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8")) as { version: string };

describe("diagnostic report version", () => {
  it("uses the package.json version, not 'unknown'", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(appVersion()).toBe(pkg.version);
    const report = buildReport({
      sessionId: "s",
      startedAt: 0,
      endedAt: 1,
      appVersion: appVersion(),
      buildMode: "test",
      userAgent: "",
      checks: [],
      scenarios: [],
      events: [],
    });
    expect(report.app.version).toBe(pkg.version);
    expect(report.app.version).not.toBe("unknown");
  });
});
