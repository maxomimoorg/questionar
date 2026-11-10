// Automatic, non-destructive in-app checks. Each check is isolated: a failure never blocks the others.

import type { CheckCategory, CheckResult, CheckStatus } from "./types";
import { normalizeError, sanitizeFacts } from "./redact";
import { getEvents, recordEvent } from "./buffer";

export const DIAG_DB_NAME = "questionar-diagnostics";

type Outcome = {
  status: CheckStatus;
  code?: string | undefined;
  facts?: Record<string, unknown> | undefined;
};

export type CheckDef = {
  id: string;
  title: string;
  category: CheckCategory;
  run: () => Promise<Outcome>;
};

const g = globalThis as typeof globalThis & { indexedDB?: IDBFactory };

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbRoundTrip(): Promise<Outcome> {
  if (!g.indexedDB) return { status: "fail", code: "idb_unavailable" };
  const open = g.indexedDB.open(DIAG_DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore("probe");
  const db = await req(open);
  try {
    const key = "probe";
    const value = { synthetic: true, n: 42 };
    const tx = (mode: IDBTransactionMode) => db.transaction("probe", mode).objectStore("probe");
    await req(tx("readwrite").put(value, key));
    const read = (await req(tx("readonly").get(key))) as typeof value | undefined;
    if (read?.n !== 42) return { status: "fail", code: "idb_read_mismatch" };
    await req(tx("readwrite").delete(key));
    const after = await req(tx("readonly").get(key));
    if (after !== undefined) return { status: "fail", code: "idb_delete_failed" };
    return { status: "pass", facts: { separate_db: true } };
  } finally {
    db.close();
    await deleteDiagnosticDb();
  }
}

export async function deleteDiagnosticDb(): Promise<void> {
  if (!g.indexedDB) return;
  await new Promise<void>((res) => {
    const r = g.indexedDB!.deleteDatabase(DIAG_DB_NAME);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

async function cryptoCheck(): Promise<Outcome> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { status: "fail", code: "subtle_unavailable" };
  // Ephemeral keys and synthetic data only; the user's identity keys are never touched.
  const a = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const b = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const aes = { name: "AES-GCM", length: 256 } as const;
  const kA = await subtle.deriveKey(
    { name: "ECDH", public: b.publicKey },
    a.privateKey,
    aes,
    false,
    ["encrypt", "decrypt"],
  );
  const kB = await subtle.deriveKey(
    { name: "ECDH", public: a.publicKey },
    b.privateKey,
    aes,
    false,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode("synthetic-probe");
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, kA, plain);
  const pt = new TextDecoder().decode(await subtle.decrypt({ name: "AES-GCM", iv }, kB, ct));
  if (pt !== "synthetic-probe") return { status: "fail", code: "crypto_roundtrip_mismatch" };
  await subtle.digest("SHA-256", plain);
  return { status: "pass", facts: { ecdh_p256: true, aes_gcm: true, sha256: true } };
}

async function pngCheck(): Promise<Outcome> {
  if (typeof document === "undefined") return { status: "skip", code: "not_verifiable_context" };
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return { status: "skip", code: "canvas_unavailable" };
  const { exportBackupPng, importBackupPng } = await import("@/lib/stego");
  // Synthetic payload kept in memory; nothing is saved, downloaded or imported into the app state.
  const payload = {
    v: 1 as const,
    name: "Diagnostica",
    handle: "diag-probe",
    bio: "",
    answers: {},
    customQuestions: [],
    savedAt: 0,
  };
  const blob = await exportBackupPng(payload);
  const back = await importBackupPng(new File([blob], "probe.png", { type: "image/png" }));
  if (back.handle !== "diag-probe") return { status: "fail", code: "png_roundtrip_mismatch" };
  let rejected = false;
  try {
    await importBackupPng(new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }));
  } catch {
    rejected = true;
  }
  if (!rejected) return { status: "fail", code: "png_invalid_accepted" };
  return { status: "pass", facts: { encrypted: false, invalid_rejected: true } };
}

async function swCheck(): Promise<Outcome> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return { status: "not_applicable", code: "sw_unsupported" };
  if (import.meta.env.DEV) return { status: "skip", code: "not_verifiable_dev_mode" };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { status: "fail", code: "sw_not_registered" };
  const state = reg.active?.state ?? reg.waiting?.state ?? reg.installing?.state ?? "none";
  return {
    status: reg.active ? "pass" : "fail",
    code: reg.active ? undefined : "sw_not_active",
    facts: { state, controlled: Boolean(navigator.serviceWorker.controller) },
  };
}

const ESSENTIAL = ["/manifest.json", "/logo.png", "/icon-192.png", "/icon-512.png"];

async function resourcesCheck(): Promise<Outcome> {
  if (typeof fetch === "undefined" || typeof location === "undefined")
    return { status: "skip", code: "not_verifiable_context" };
  let ok = 0;
  for (const p of ESSENTIAL) {
    try {
      const r = await fetch(p, { method: "HEAD", cache: "no-store" });
      if (r.ok) ok++;
    } catch {
      /* counted as missing */
    }
  }
  let cached: boolean | string = "not_verifiable";
  if (typeof caches !== "undefined" && !import.meta.env.DEV) {
    const keys = await caches.keys();
    cached = keys.some((k) => k.startsWith("questionar-"));
  }
  return {
    status: ok === ESSENTIAL.length ? "pass" : "fail",
    code: ok === ESSENTIAL.length ? undefined : "resources_missing",
    // Reachability over the network does not prove offline operation.
    facts: { reachable: ok, total: ESSENTIAL.length, cache_present: cached, offline_proven: false },
  };
}

async function browserCheck(): Promise<Outcome> {
  const has = (v: unknown) => typeof v !== "undefined";
  const facts = {
    indexeddb: has(g.indexedDB),
    subtle_crypto: Boolean(globalThis.crypto?.subtle),
    websocket: has(globalThis.WebSocket),
    webrtc: has((globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection),
    service_worker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    canvas: typeof document !== "undefined" && !!document.createElement("canvas").getContext,
    clipboard: typeof navigator !== "undefined" && has(navigator.clipboard),
    share: typeof navigator !== "undefined" && has(navigator.share),
    visibility: typeof document !== "undefined" ? document.visibilityState : "unknown",
    standalone:
      typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches,
  };
  const required = facts.indexeddb && facts.subtle_crypto && facts.websocket;
  return {
    status: required ? "pass" : "fail",
    code: required ? undefined : "required_api_missing",
    facts,
  };
}

async function networkCheck(): Promise<Outcome> {
  const ev = getEvents().filter(
    (e) => e.type.startsWith("relay.") || e.type.startsWith("p2p.") || e.type.startsWith("net."),
  );
  const facts: Record<string, unknown> = {
    navigator_online: typeof navigator !== "undefined" ? navigator.onLine : "unknown",
    observed_events: ev.length,
    relay_ready: ev.filter((e) => e.type === "relay.ready").length,
    relay_closed: ev.filter((e) => e.type === "relay.closed").length,
    relay_retries: ev.filter((e) => e.type === "relay.retry_scheduled").length,
  };
  if (ev.length === 0) return { status: "skip", code: "no_observation_yet", facts };
  const unavailable = ev.find((e) => e.type === "relay.unavailable");
  if (unavailable)
    return {
      status: "fail",
      code: `relay_${String(unavailable.data?.["reason"] ?? "unavailable")}`,
      facts,
    };
  return { status: "pass", facts };
}

async function relayActiveCheck(): Promise<Outcome> {
  // No clearly identified, safe test endpoint exists: never message real contacts.
  return { status: "skip", code: "no_safe_test_endpoint" };
}

async function errorsCheck(): Promise<Outcome> {
  const errs = getEvents().filter((e) => e.type === "app.error");
  const codes = [...new Set(errs.map((e) => String(e.data?.["code"] ?? "unknown")))].slice(0, 10);
  return {
    status: errs.length ? "fail" : "pass",
    code: errs.length ? "errors_captured" : undefined,
    facts: { count: errs.length, codes: codes.join(",") || "none" },
  };
}

export const CHECKS: CheckDef[] = [
  { id: "browser.capabilities", title: "API del browser", category: "browser", run: browserCheck },
  {
    id: "storage.indexeddb_roundtrip",
    title: "IndexedDB (spazio separato)",
    category: "storage",
    run: idbRoundTrip,
  },
  { id: "pwa.service_worker", title: "Service worker", category: "pwa", run: swCheck },
  {
    id: "pwa.essential_resources",
    title: "Risorse locali essenziali",
    category: "pwa",
    run: resourcesCheck,
  },
  {
    id: "crypto.ephemeral_roundtrip",
    title: "Crittografia (chiavi effimere)",
    category: "crypto",
    run: cryptoCheck,
  },
  { id: "backup.png_roundtrip", title: "Backup PNG sintetico", category: "backup", run: pngCheck },
  {
    id: "network.observed",
    title: "Rete e relay osservati",
    category: "network",
    run: networkCheck,
  },
  {
    id: "network.relay_active_probe",
    title: "Prova attiva relay",
    category: "network",
    run: relayActiveCheck,
  },
  { id: "errors.session", title: "Errori della sessione", category: "errors", run: errorsCheck },
];

export async function runChecks(
  defs: CheckDef[] = CHECKS,
  onProgress?: (done: CheckResult[], runningId: string | null) => void,
  clock: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const def of defs) {
    onProgress?.(results.slice(), def.id);
    const t0 = clock();
    let out: Outcome;
    try {
      out = await def.run();
    } catch (err) {
      const code = normalizeError(err);
      recordEvent("diag.check_error", { check: def.id, code });
      out = { status: "fail", code };
    }
    results.push({
      id: def.id,
      title: def.title,
      category: def.category,
      status: out.status,
      durationMs: Math.round(clock() - t0),
      code: out.code,
      facts: sanitizeFacts(out.facts),
    });
  }
  onProgress?.(results.slice(), null);
  return results;
}
