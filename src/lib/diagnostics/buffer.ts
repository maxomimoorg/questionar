// Bounded, allow-listed in-memory event buffer. Inactive (no-op) unless diagnostics are on.

import type { DiagEvent, DiagEventType } from "./types";
import { sanitizeFacts } from "./redact";

export const BUFFER_MAX_EVENTS = 200;
export const BUFFER_MAX_AGE_MS = 30 * 60 * 1000;

const ALLOWED: ReadonlySet<DiagEventType> = new Set<DiagEventType>([
  "relay.connecting",
  "relay.ready",
  "relay.closed",
  "relay.retry_scheduled",
  "relay.unavailable",
  "p2p.state",
  "net.online",
  "net.offline",
  "page.visibility",
  "app.error",
  "diag.check_error",
]);

let active = false;
let startedAt = 0;
let events: DiagEvent[] = [];
let now: () => number = () => Date.now();

export function startBuffer(clock?: () => number) {
  if (clock) now = clock;
  active = true;
  startedAt = now();
  events = [];
}

export function stopBuffer() {
  active = false;
}

export function clearBuffer() {
  events = [];
}

export function isBufferActive() {
  return active;
}

/** Safe to call from app code: does nothing when diagnostics are off. */
export function recordEvent(type: DiagEventType, data?: Record<string, unknown>) {
  if (!active || !ALLOWED.has(type)) return;
  const t = now() - startedAt;
  events.push({ type, t, data: sanitizeFacts(data) });
  const minT = t - BUFFER_MAX_AGE_MS;
  events = events.filter((e) => e.t >= minT);
  if (events.length > BUFFER_MAX_EVENTS) events = events.slice(-BUFFER_MAX_EVENTS);
}

export function getEvents(): DiagEvent[] {
  return events.slice();
}
