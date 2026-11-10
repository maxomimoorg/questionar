import { getEvents } from "./buffer";
import { buildReport, reportFilename } from "./report";
import { getDiagState } from "./session";

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Injected at build time from package.json (vite.config.ts). */
export function appVersion(): string {
  const v = import.meta.env["VITE_APP_VERSION"] as string | undefined;
  return v && v.trim() ? v : "unknown";
}

export function exportReport() {
  const s = getDiagState();
  const report = buildReport({
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    endedAt: Date.now(),
    appVersion: appVersion(),
    buildMode: import.meta.env.MODE,
    userAgent: navigator.userAgent,
    checks: s.checks,
    scenarios: Object.values(s.scenarios),
    events: getEvents(),
  });
  downloadJson(report, reportFilename(s.startedAt));
}
