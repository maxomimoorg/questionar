import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Copy, KeyRound, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordPill } from "@/components/CategoryControls";
import { passwordProblem } from "@/lib/protection";
import type { ProtectedSection } from "@/lib/questions";
import { useStore } from "@/lib/store";

const TITLES: Record<ProtectedSection, string> = {
  main: "Password del questionario generale",
  erotic: "Password del questionario Erotismo",
};

/**
 * Compact dialog managing one questionnaire's password. The current password is shown in clear
 * right away (it is the owner's own device), with Copia, Modifica and Rimuovi.
 */
export function PasswordDialog({
  section,
  password,
  onSave,
  onRemove,
  onClose,
}: {
  section: ProtectedSection;
  password: string | null;
  onSave: (password: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(password === null);
  const [draft, setDraft] = useState(password ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const problem = passwordProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(draft);
    setEditing(false);
    setError(null);
  };

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copiata");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-3xl bg-surface p-5 text-foreground shadow-xl outline-none"
          aria-describedby={`password-help-${section}`}
        >
          <div className="flex items-start gap-2">
            <DialogPrimitive.Title className="flex flex-1 items-center gap-2 text-[16px] font-bold text-brand">
              <KeyRound size={18} aria-hidden="true" className="text-accent" />
              {TITLES[section]}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Chiudi"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-background"
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>
          <p id={`password-help-${section}`} className="text-[13px] text-muted-foreground">
            Comunica questa password a chi vuoi permettere di vedere le tue risposte nel confronto.
            Senza password si vedono solo le medie per categoria.
          </p>

          {editing ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="block text-[12px] font-semibold" htmlFor={`pw-${section}`}>
                {password === null ? "Nuova password" : "Modifica password"}
              </label>
              <input
                id={`pw-${section}`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl bg-background px-3 py-2 font-mono text-[15px] outline-none ring-1 ring-input focus:ring-accent"
              />
              {error && (
                <p role="alert" className="text-[12px] font-semibold text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                {password !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(password);
                      setEditing(false);
                      setError(null);
                    }}
                    className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-[14px]"
                  >
                    Annulla
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground shadow-action-glow"
                >
                  {password === null ? "Attiva" : "Salva"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <output
                data-testid="current-password"
                className="block select-all break-all rounded-xl bg-background px-3 py-2 font-mono text-[16px] font-semibold"
              >
                {password}
              </output>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-2 py-2 text-[13px] font-semibold"
                >
                  <Copy size={14} aria-hidden="true" /> Copia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(password ?? "");
                    setEditing(true);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-2 py-2 text-[13px] font-semibold"
                >
                  <Pencil size={14} aria-hidden="true" /> Modifica
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-2 py-2 text-[13px] font-semibold text-destructive-foreground"
                >
                  <Trash2 size={14} aria-hidden="true" /> Rimuovi
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The owner's pill + dialog for one questionnaire, wired to the saved profile. */
export function PasswordControl({ section }: { section: ProtectedSection }) {
  const { state, setSectionPassword, removeSectionPassword } = useStore();
  const [open, setOpen] = useState(false);
  const secret = state.protection[section];
  return (
    <>
      <PasswordPill active={Boolean(secret)} onClick={() => setOpen(true)} />
      {open && (
        <PasswordDialog
          section={section}
          password={secret?.password ?? null}
          onSave={(password) => {
            if (password === secret?.password) return;
            setSectionPassword(section, password);
            toast.success(secret ? "Password modificata" : "Password attiva", {
              description: secret
                ? "Chi aveva la vecchia password dovrà inserire quella nuova."
                : "Nei confronti le tue risposte viaggiano cifrate.",
            });
          }}
          onRemove={() => {
            removeSectionPassword(section);
            setOpen(false);
            toast("Protezione rimossa", {
              description: "Le risposte di questo questionario tornano visibili nei confronti.",
            });
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
