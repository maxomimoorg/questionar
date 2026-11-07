// Diagnostic mode: shared types. Everything here stays local to the device.

export const REPORT_SCHEMA = "questionar-diagnostics" as const;
export const REPORT_VERSION = 1 as const;

/** Automatic check outcome. "skip" covers "non verificabile in questo contesto". */
export type CheckStatus = "pass" | "fail" | "skip" | "not_applicable";

/** Manual outcome declared by the developer. */
export type ManualStatus = "passed" | "failed" | "not_run" | "not_applicable";

export type CheckResult = {
  id: string;
  title: string;
  category: CheckCategory;
  status: CheckStatus;
  durationMs: number;
  /** Normalized technical code (snake_case), never raw messages. */
  code?: string | undefined;
  /** Short, allow-listed technical facts (no personal data). */
  facts?: Record<string, string | number | boolean> | undefined;
};

export type CheckCategory = "browser" | "storage" | "pwa" | "crypto" | "backup" | "network" | "errors";

export type ScenarioDef = {
  id: string;
  title: string;
  prerequisites: string[];
  steps: string[];
  expected: string;
};

export type ScenarioResult = {
  id: string;
  status: ManualStatus;
  /** Indexes of the steps the developer marked as performed. */
  stepsDone: number[];
  note?: string | undefined;
};

export type DiagEventType =
  | "relay.connecting"
  | "relay.ready"
  | "relay.closed"
  | "relay.retry_scheduled"
  | "relay.unavailable"
  | "p2p.state"
  | "net.online"
  | "net.offline"
  | "page.visibility"
  | "app.error"
  | "diag.check_error";

export type DiagEvent = {
  type: DiagEventType;
  /** ms since session start */
  t: number;
  data?: Record<string, string | number | boolean> | undefined;
};
