import {
  REPORT_SCHEMA,
  REPORT_VERSION,
  type CheckResult,
  type DiagEvent,
  type ScenarioResult,
} from "./types";
import { SCENARIOS } from "./scenarios";
import { coarsePlatform, sanitizeNote } from "./redact";

export const REPORT_LIMITS = [
  "I controlli automatici descrivono solo ciò che questa sessione, su questo browser e dispositivo, ha potuto verificare.",
  "Il report non attesta test su altri browser o dispositivi.",
  "Il report non descrive lo stato interno del relay: solo le transizioni osservate dal client.",
  "Gli esiti manuali sono dichiarati dallo sviluppatore e non sono verifiche automatiche.",
  "'skip' indica una verifica non eseguita o non verificabile in questo contesto; non equivale a un successo.",
  "Il funzionamento offline non è dimostrato dai controlli automatici.",
];

export type ReportInput = {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  appVersion: string;
  buildMode: string;
  userAgent: string;
  checks: CheckResult[];
  scenarios: ScenarioResult[];
  events: DiagEvent[];
};

export function summarize(checks: CheckResult[], scenarios: ScenarioResult[]) {
  const count = <T extends string>(xs: T[], v: T) => xs.filter((x) => x === v).length;
  const cs = checks.map((c) => c.status);
  const ms = scenarios.map((s) => s.status);
  return {
    automatic: {
      pass: count(cs, "pass"),
      fail: count(cs, "fail"),
      skip: count(cs, "skip"),
      not_applicable: count(cs, "not_applicable"),
    },
    manual: {
      passed: count(ms, "passed"),
      failed: count(ms, "failed"),
      not_run: count(ms, "not_run"),
      not_applicable: count(ms, "not_applicable"),
    },
  };
}

export function buildReport(input: ReportInput) {
  const byId = new Map(input.scenarios.map((s) => [s.id, s]));
  const scenarios = SCENARIOS.map((def) => {
    const r = byId.get(def.id);
    const note = r?.note ? sanitizeNote(r.note) : undefined;
    return {
      id: def.id,
      title: def.title,
      source: "manual_declared" as const,
      status: r?.status ?? "not_run",
      expected: def.expected,
      stepsPerformed: (r?.stepsDone ?? []).filter((i) => def.steps[i]).map((i) => def.steps[i]),
      ...(note ? { note } : {}),
    };
  });
  return {
    schema: REPORT_SCHEMA,
    version: REPORT_VERSION,
    _doc: "Report diagnostico locale di QuestionAR. Vedi docs/DOCUMENTAZIONE.md#diagnostica per il significato dei campi.",
    session: {
      id: input.sessionId,
      startedAt: new Date(input.startedAt).toISOString(),
      endedAt: new Date(input.endedAt).toISOString(),
    },
    app: { version: input.appVersion, build: input.buildMode },
    platform: coarsePlatform(input.userAgent),
    checks: input.checks.map((c) => ({ ...c, source: "automatic" as const })),
    scenarios,
    events: input.events,
    summary: summarize(input.checks, input.scenarios),
    limits: REPORT_LIMITS,
  };
}

export type DiagnosticReport = ReturnType<typeof buildReport>;

export function reportFilename(startedAt: number) {
  const d = new Date(startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `questionar-diagnostica-${d}.json`;
}
