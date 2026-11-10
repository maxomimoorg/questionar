import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { expandAllAction } from "@/lib/visibility";

/** Pill that opens or closes every category at once; its text names the available action. */
export function ExpandAllPill({
  openStates,
  onSet,
}: {
  openStates: boolean[];
  onSet: (open: boolean) => void;
}) {
  const action = expandAllAction(openStates);
  const disabled = openStates.length === 0;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSet(action === "expand")}
        className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-foreground disabled:opacity-50"
      >
        {action === "expand" ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
        {action === "expand" ? "Espandi tutte" : "Comprimi tutte"}
      </button>
    </div>
  );
}

/**
 * Category drawer header: the title area opens/closes the drawer, a separate eye button hides
 * or restores the whole category.
 */
export function CategoryHeader({
  label,
  open,
  onToggle,
  right,
  hidden,
  onToggleHidden,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  right: ReactNode;
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? `Chiudi la categoria ${label}` : `Apri la categoria ${label}`}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl px-2 py-2 text-left"
      >
        <span className="text-[16px] font-bold text-brand">{label}</span>
        <span className="flex shrink-0 items-center gap-2 text-[12px] font-normal text-muted-foreground">
          {right}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {onToggleHidden && (
        <button
          type="button"
          aria-label={
            hidden ? `Ripristina la categoria ${label}` : `Nascondi la categoria ${label}`
          }
          title={hidden ? "Ripristina categoria" : "Nascondi categoria"}
          onClick={onToggleHidden}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-background text-muted-foreground"
        >
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
}

/** Navigation pill toward another page (not a drawer): arrow instead of chevron. */
export function NavPill({
  to,
  search,
  label,
  back,
  right,
}: {
  to: "/" | "/erotismo" | "/confronto" | "/confronto/erotismo";
  search?: Record<string, string | undefined>;
  label: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="flex w-full items-center justify-between gap-2 rounded-3xl bg-surface-2/60 px-4 py-3"
    >
      <span className="flex items-center gap-2 text-[16px] font-bold text-brand">
        {back && <ArrowLeft size={18} aria-hidden="true" />}
        {label}
      </span>
      <span className="flex items-center gap-2 text-[14px] font-bold">
        {right}
        {!back && <ArrowRight size={18} aria-hidden="true" className="text-muted-foreground" />}
      </span>
    </Link>
  );
}
