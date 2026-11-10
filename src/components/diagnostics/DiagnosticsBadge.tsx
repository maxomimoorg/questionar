import { Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endDiagnostics, setDiagState, useDiagState } from "@/lib/diagnostics/session";

export function DiagnosticsBadge() {
  const s = useDiagState();
  if (!s.active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[80] flex items-center justify-center gap-2 bg-destructive px-3 py-2 text-[13px] font-semibold text-destructive-foreground safe-bottom"
    >
      <Activity size={15} aria-hidden />
      <span>Modalità diagnostica attiva</span>
      {!s.panelOpen && (
        <Button size="sm" variant="secondary" onClick={() => setDiagState({ panelOpen: true })}>
          Apri
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={endDiagnostics}
        aria-label="Termina la modalità diagnostica"
      >
        <X /> Termina
      </Button>
    </div>
  );
}
