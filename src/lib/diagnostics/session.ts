// In-memory diagnostic session store (never persisted, never sent anywhere).

import { useSyncExternalStore } from "react";
import type { CheckResult, ScenarioResult } from "./types";
import { clearBuffer, recordEvent, startBuffer, stopBuffer } from "./buffer";
import { normalizeError } from "./redact";
import { deleteDiagnosticDb } from "./checks";

export type Stage = "checks" | "manual" | "summary";

export type DiagState = {
  active: boolean;
  panelOpen: boolean;
  stage: Stage;
  sessionId: string;
  startedAt: number;
  checks: CheckResult[];
  runningId: string | null;
  scenarios: Record<string, ScenarioResult>;
};

const initial: DiagState = {
  active: false,
  panelOpen: false,
  stage: "checks",
  sessionId: "",
  startedAt: 0,
  checks: [],
  runningId: null,
  scenarios: {},
};

let state: DiagState = initial;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

export function getDiagState() {
  return state;
}

export function setDiagState(patch: Partial<DiagState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useDiagState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => initial,
  );
}

function attachListeners() {
  if (typeof window === "undefined") return;
  const onError = (e: ErrorEvent) => recordEvent("app.error", { kind: "error", code: normalizeError(e.error) });
  const onRejection = (e: PromiseRejectionEvent) =>
    recordEvent("app.error", { kind: "unhandled_rejection", code: normalizeError(e.reason) });
  const onOnline = () => recordEvent("net.online");
  const onOffline = () => recordEvent("net.offline");
  const onVis = () => recordEvent("page.visibility", { state: document.visibilityState });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVis);
  detach = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVis);
  };
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `s-${Math.random().toString(36).slice(2)}`;
}

export function startDiagnostics() {
  if (state.active) return setDiagState({ panelOpen: true });
  startBuffer();
  attachListeners();
  setDiagState({ ...initial, active: true, panelOpen: true, sessionId: newId(), startedAt: Date.now() });
}

/** Ends the session and wipes all local diagnostic data. */
export function endDiagnostics() {
  detach?.();
  detach = null;
  stopBuffer();
  clearBuffer();
  void deleteDiagnosticDb();
  setDiagState(initial);
}

export function clearDiagnosticData() {
  clearBuffer();
  void deleteDiagnosticDb();
  setDiagState({ checks: [], scenarios: {}, stage: "checks", runningId: null });
}
