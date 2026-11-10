import { formatMargin } from "@/lib/compat";

/** Uncoloured "±N%" error margin shown after an estimated percentage; nothing for exact scores. */
export function MarginText({ result }: { result: { margin?: number } | null }) {
  const text = formatMargin(result);
  if (!text) return null;
  return (
    <span
      className="ml-1 text-[0.85em] font-semibold text-muted-foreground"
      data-testid="compat-margin"
    >
      {text}
    </span>
  );
}
