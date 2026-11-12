import * as DialogPrimitive from "@radix-ui/react-dialog";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import type { ProtectedBox } from "@/lib/password-crypto";
import { openSectionWithPassword } from "@/lib/protection";
import type { ProtectedSection } from "@/lib/questions";
import type { RestoredSection } from "@/lib/store";

const LABELS: Record<ProtectedSection, string> = {
  main: "Password del questionario generale",
  erotic: "Password del questionario Erotismo",
};

/**
 * Importing my own backup whose questionnaires are password-protected: each password opens its
 * section; skipping restores only what travels in clear.
 */
export function BackupRestoreDialog({
  boxes,
  onDone,
  onCancel,
}: {
  boxes: Partial<Record<ProtectedSection, ProtectedBox>>;
  onDone: (restored: RestoredSection[]) => void;
  onCancel: () => void;
}) {
  const sections = (Object.keys(boxes) as ProtectedSection[]).filter((s) => boxes[s]);
  const [values, setValues] = useState<Partial<Record<ProtectedSection, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProtectedSection, boolean>>>({});
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    setBusy(true);
    const restored: RestoredSection[] = [];
    const nextErrors: Partial<Record<ProtectedSection, boolean>> = {};
    for (const section of sections) {
      const password = values[section];
      const box = boxes[section];
      if (!password || !box) continue;
      try {
        const { payload } = await openSectionWithPassword(password, box, section);
        restored.push({ section, password, salt: box.salt, keyVersion: box.keyVersion, payload });
      } catch {
        nextErrors[section] = true;
      }
    }
    setBusy(false);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onDone(restored);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Content
          aria-describedby="restore-help"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-3xl bg-surface p-5 text-foreground shadow-xl outline-none"
        >
          <DialogPrimitive.Title className="flex items-center gap-2 text-[16px] font-bold text-brand">
            <KeyRound size={18} aria-hidden="true" className="text-accent" /> Backup protetto
          </DialogPrimitive.Title>
          <p id="restore-help" className="text-[13px] text-muted-foreground">
            Questo backup contiene questionari protetti da password. Inseriscile per ripristinare
            anche risposte, commenti e domande personalizzate protetti.
          </p>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void restore();
            }}
          >
            {sections.map((section) => (
              <div key={section}>
                <label className="block text-[12px] font-semibold" htmlFor={`restore-${section}`}>
                  {LABELS[section]}
                </label>
                <input
                  id={`restore-${section}`}
                  type="password"
                  autoComplete="off"
                  value={values[section] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [section]: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
                />
                {errors[section] && (
                  <p role="alert" className="mt-1 text-[12px] font-semibold text-destructive">
                    Password non corretta.
                  </p>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onDone([])}
                className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-[14px]"
              >
                Salta
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground shadow-action-glow disabled:opacity-60"
              >
                {busy ? "Verifico…" : "Ripristina"}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
