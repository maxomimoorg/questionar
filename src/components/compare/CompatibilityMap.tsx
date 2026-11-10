import { ChevronRight } from "lucide-react";

import { MarginText } from "@/components/MarginText";
import { percentColor } from "@/lib/color";
import { formatCompat, type AverageResult } from "@/lib/compat";
import type { CategoryBar } from "@/lib/compat-map";

const muted = "var(--color-muted-foreground)";

/**
 * Visual summary of a comparison: a ring with the overall score and one bar per category,
 * sorted by affinity. Tapping a bar asks the page to reveal that category.
 */
export function CompatibilityMap({
  overall,
  bars,
  onSelect,
  title = "Mappa per categoria",
}: {
  overall: AverageResult | null;
  bars: CategoryBar[];
  onSelect: (key: string) => void;
  title?: string;
}) {
  const score = overall?.score ?? null;
  const ring = score === null ? 0 : Math.min(100, Math.max(0, score));
  return (
    <div
      className="compat-map flex flex-col gap-4 sm:flex-row sm:items-start"
      data-testid="compat-map"
    >
      <div className="flex items-center gap-3 sm:flex-col sm:items-center">
        <div
          className="compat-ring grid size-24 shrink-0 place-items-center rounded-full"
          role="img"
          aria-label={
            score === null
              ? "Compatibilità: dati insufficienti"
              : `Compatibilità complessiva ${score}%`
          }
          style={{
            background:
              score === null
                ? "var(--color-muted)"
                : `conic-gradient(${percentColor(score)} ${ring * 3.6}deg, var(--color-muted) 0)`,
          }}
        >
          <div className="grid size-[4.5rem] place-items-center rounded-full bg-background text-center leading-tight">
            <b
              className="text-[18px]"
              style={{ color: score === null ? muted : percentColor(score) }}
            >
              {formatCompat(overall)}
            </b>
            {overall && overall.margin > 0 && (
              <span className="-mt-1 text-[11px] font-semibold text-muted-foreground">
                ±{overall.margin}%
              </span>
            )}
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground sm:max-w-24 sm:text-center">{title}</p>
      </div>

      <ul className="min-w-0 flex-1 space-y-1">
        {bars.length === 0 && (
          <li className="text-[12px] text-muted-foreground">Nessuna categoria da confrontare.</li>
        )}
        {bars.map((bar, i) => {
          const s = bar.detail?.score ?? null;
          const width = s === null ? 0 : Math.min(100, Math.max(0, s));
          return (
            <li key={bar.key}>
              <button
                type="button"
                onClick={() => onSelect(bar.key)}
                aria-label={`${bar.label}: ${s === null ? "nessuna risposta confrontabile" : `${s}%`}. Mostra la categoria`}
                className="group w-full rounded-xl px-2 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <span className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate">{bar.label}</span>
                  <span
                    className="flex shrink-0 items-center gap-0.5 font-bold"
                    style={{ color: s === null ? muted : percentColor(s) }}
                  >
                    {formatCompat(bar.detail)}
                    <MarginText result={bar.detail} />
                    <ChevronRight size={14} aria-hidden="true" className="text-muted-foreground" />
                  </span>
                </span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="compat-bar block h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      backgroundColor: s === null ? "transparent" : percentColor(s),
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
