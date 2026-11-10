import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CHECKS, runChecks } from "@/lib/diagnostics/checks";
import { SCENARIOS } from "@/lib/diagnostics/scenarios";
import { exportReport } from "@/lib/diagnostics/export";
import { summarize } from "@/lib/diagnostics/report";
import { NOTE_MAX } from "@/lib/diagnostics/redact";
import {
  clearDiagnosticData,
  endDiagnostics,
  getDiagState,
  setDiagState,
  useDiagState,
} from "@/lib/diagnostics/session";
import type { CheckStatus, ManualStatus, ScenarioResult } from "@/lib/diagnostics/types";

const CHECK_LABEL: Record<CheckStatus, string> = {
  pass: "Superato",
  fail: "Fallito",
  skip: "Non verificato",
  not_applicable: "Non applicabile",
};

const MANUAL: { v: ManualStatus; label: string }[] = [
  { v: "passed", label: "Superato" },
  { v: "failed", label: "Fallito" },
  { v: "not_run", label: "Non eseguito" },
  { v: "not_applicable", label: "N/A" },
];

function scenario(id: string): ScenarioResult {
  return getDiagState().scenarios[id] ?? { id, status: "not_run", stepsDone: [] };
}
function updateScenario(id: string, patch: Partial<ScenarioResult>) {
  const s = getDiagState();
  setDiagState({ scenarios: { ...s.scenarios, [id]: { ...scenario(id), ...patch } } });
}

export function DiagnosticsPanel() {
  const s = useDiagState();
  const started = useRef("");

  useEffect(() => {
    if (!s.active || s.stage !== "checks" || s.checks.length || started.current === s.sessionId)
      return;
    started.current = s.sessionId;
    void runChecks(CHECKS, (done, runningId) => setDiagState({ checks: done, runningId }));
  }, [s.active, s.stage, s.checks.length, s.sessionId]);

  if (!s.active || !s.panelOpen) return null;
  const running = s.runningId !== null || (s.stage === "checks" && s.checks.length < CHECKS.length);
  const sum = summarize(s.checks, Object.values(s.scenarios));

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center bg-overlay p-3 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diag-title"
        className="info-scroll mt-4 mb-14 max-h-[82dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-border"
      >
        <div className="mb-3 flex items-center gap-2">
          <h1 id="diag-title" className="flex-1 text-xl">
            Diagnostica locale
          </h1>
          <Button variant="secondary" size="sm" onClick={() => setDiagState({ panelOpen: false })}>
            Riduci
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Tutto resta su questo dispositivo: nulla viene inviato a server o analytics.
        </p>

        <nav className="mt-3 flex gap-2" aria-label="Fasi diagnostica">
          {(["checks", "manual", "summary"] as const).map((st, i) => (
            <Button
              key={st}
              size="sm"
              variant={s.stage === st ? "default" : "secondary"}
              disabled={running}
              onClick={() => setDiagState({ stage: st })}
            >
              {i + 1}. {st === "checks" ? "Controlli" : st === "manual" ? "Checklist" : "Riepilogo"}
            </Button>
          ))}
        </nav>

        {s.stage === "checks" && (
          <section className="mt-4">
            <p className="text-[13px]" aria-live="polite">
              {running
                ? `Controlli in corso… ${s.checks.length}/${CHECKS.length}`
                : "Controlli completati."}
            </p>
            <ul className="mt-2 space-y-1">
              {CHECKS.map((c) => {
                const r = s.checks.find((x) => x.id === c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]"
                  >
                    <span className="flex-1">{c.title}</span>
                    {r?.code && <code className="text-[11px] text-muted-foreground">{r.code}</code>}
                    <span
                      data-status={r?.status ?? (s.runningId === c.id ? "running" : "pending")}
                      className="font-semibold"
                    >
                      {r ? CHECK_LABEL[r.status] : s.runningId === c.id ? "In corso…" : "In attesa"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Button
              className="mt-3"
              disabled={running}
              onClick={() => setDiagState({ stage: "manual" })}
            >
              Vai alla checklist manuale
            </Button>
          </section>
        )}

        {s.stage === "manual" && (
          <section className="mt-4 space-y-3">
            <p className="rounded-xl bg-surface-2 p-2 text-[12px]">
              Nelle note non inserire dati personali, contatti, risposte o segreti.
            </p>
            {SCENARIOS.map((def) => {
              const r = s.scenarios[def.id] ?? {
                id: def.id,
                status: "not_run" as const,
                stepsDone: [],
              };
              return (
                <fieldset key={def.id} className="rounded-2xl bg-surface-2 p-3 text-[13px]">
                  <legend className="font-semibold">{def.title}</legend>
                  {def.prerequisites.length > 0 && (
                    <p className="text-muted-foreground">
                      Prerequisiti: {def.prerequisites.join("; ")}
                    </p>
                  )}
                  <ol className="mt-1 space-y-1">
                    {def.steps.map((step, i) => (
                      <li key={i}>
                        <label className="flex gap-2">
                          <input
                            type="checkbox"
                            checked={r.stepsDone.includes(i)}
                            onChange={(e) =>
                              updateScenario(def.id, {
                                stepsDone: e.target.checked
                                  ? [...r.stepsDone, i].sort()
                                  : r.stepsDone.filter((x) => x !== i),
                              })
                            }
                          />
                          {step}
                        </label>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-1">Atteso: {def.expected}</p>
                  <div
                    className="mt-2 flex flex-wrap gap-1"
                    role="radiogroup"
                    aria-label={`Esito: ${def.title}`}
                  >
                    {MANUAL.map((m) => (
                      <Button
                        key={m.v}
                        size="sm"
                        role="radio"
                        aria-checked={r.status === m.v}
                        variant={r.status === m.v ? "default" : "secondary"}
                        onClick={() => updateScenario(def.id, { status: m.v })}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                  <textarea
                    aria-label={`Note: ${def.title}`}
                    maxLength={NOTE_MAX}
                    placeholder="Note facoltative (niente dati personali)"
                    value={r.note ?? ""}
                    onChange={(e) => updateScenario(def.id, { note: e.target.value })}
                    className="mt-2 w-full rounded-xl bg-background p-2 text-[13px] ring-1 ring-border"
                  />
                </fieldset>
              );
            })}
            <Button onClick={() => setDiagState({ stage: "summary" })}>Vai al riepilogo</Button>
          </section>
        )}

        {s.stage === "summary" && (
          <section className="mt-4 space-y-2 text-[13px]">
            <p>
              Automatici: {sum.automatic.pass} superati, {sum.automatic.fail} falliti,{" "}
              {sum.automatic.skip} non verificati, {sum.automatic.not_applicable} non applicabili.
            </p>
            <p>
              Manuali (dichiarati): {sum.manual.passed} superati, {sum.manual.failed} falliti,{" "}
              {sum.manual.not_run} non eseguiti, {sum.manual.not_applicable} non applicabili.
            </p>
            <p className="text-muted-foreground">
              Il report vale solo per questa sessione e questo dispositivo; non attesta altri
              browser né lo stato interno del relay.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={exportReport}>Esporta report diagnostico</Button>
              <Button variant="secondary" onClick={clearDiagnosticData}>
                Cancella dati diagnostici
              </Button>
              <Button variant="destructive" onClick={endDiagnostics}>
                Termina diagnostica
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
