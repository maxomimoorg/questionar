import * as AlertDialog from "@radix-ui/react-alert-dialog";

// Uses the Radix primitive directly (not components/ui) so lazily split routes sharing
// Questionnaire never pull in components/ui/button (see AGENTS.md).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Elimina",
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-5 text-card-foreground shadow-lg ring-1 ring-border">
          <AlertDialog.Title className="text-[16px] font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[14px] text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Cancel className="rounded-full bg-surface-2 px-4 py-2 text-[14px] font-semibold">
              Annulla
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className="rounded-full bg-destructive px-4 py-2 text-[14px] font-semibold text-destructive-foreground"
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
