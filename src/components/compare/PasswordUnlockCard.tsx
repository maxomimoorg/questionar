import { KeyRound, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { ProtectedSection } from "@/lib/questions";
import { useUnlocks } from "@/lib/unlocks";

const SECTION_NAME: Record<ProtectedSection, string> = {
  main: "questionario generale",
  erotic: "questionario Erotismo",
};

/**
 * Shown in a comparison when a contact's questionnaire is password-protected: the category
 * means stay visible, the single answers open with the password the contact communicated.
 */
export function PasswordUnlockCard({
  handle,
  name,
  section,
}: {
  handle: string;
  name: string;
  section: ProtectedSection;
}) {
  const { unlock, waitSeconds } = useUnlocks();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(() => waitSeconds(handle, section));

  const waiting = wait > 0;
  useEffect(() => {
    if (!waiting) return;
    // Counts down to zero; the interval stops once attempts are allowed again.
    const id = window.setInterval(() => setWait(waitSeconds(handle, section)), 250);
    return () => window.clearInterval(id);
  }, [waiting, waitSeconds, handle, section]);

  const submit = async () => {
    if (!password || busy || wait > 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await unlock(handle, section, password);
      if (r.status === "ok") {
        toast.success("Questionario sbloccato", { id: `unlock-${handle}-${section}` });
        setPassword("");
      } else if (r.status === "wrong") {
        setError("Password non corretta.");
        setWait(r.waitSeconds);
      } else if (r.status === "wait") {
        setWait(r.waitSeconds);
      }
    } catch {
      setError("Non è stato possibile verificare la password.");
    } finally {
      setBusy(false);
    }
  };

  const inputId = `unlock-${section}-${handle}`;
  return (
    <section
      className="section-card space-y-2"
      data-testid="password-unlock-card"
      data-handle={handle}
      aria-label={`Sblocca il ${SECTION_NAME[section]} di ${name}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent">
          <LockKeyhole size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px]">Risposte di {name} protette</h3>
          <p className="text-[12px] text-muted-foreground">
            Vedi già le medie per categoria. Inserisci la password che {name} ti ha comunicato per
            vedere risposte, commenti e domande personalizzate.
          </p>
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Password di {name}
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Password di ${name}`}
          className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!password || busy || wait > 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-action-glow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <KeyRound size={15} aria-hidden="true" />
          {busy ? "Verifico…" : wait > 0 ? `Attendi ${wait}s` : "Sblocca"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
