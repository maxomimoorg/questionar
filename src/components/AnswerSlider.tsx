import { Check, X } from "lucide-react";
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { percentColor, thumbGlyph } from "@/lib/color";

type SliderProps = {
  /** Saved value (0–100). */
  value: number;
  answered: boolean;
  onCommit: (value: number) => void;
  /** Short label shown before the track ("Fare", "Ricevere"). */
  label?: string;
};

/** One answer slider: drag the thumb, tap anywhere on the track, or use the arrow keys. */
export function AnswerSlider({ value, answered, onCommit, label }: SliderProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const shown = dragValue ?? value;
  // Colours only recalculate on release, never during the drag.
  const color = answered ? percentColor(value) : "var(--color-muted-foreground)";

  const valueFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 50;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 50;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  }, []);

  // The track captures the pointer, so even a very quick tap delivers its release here.
  const start = (e: ReactPointerEvent, from: number) => {
    e.preventDefault();
    dragging.current = true;
    try {
      trackRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported: move/up still reach the track while the pointer is over it */
    }
    setDragValue(from);
  };
  const move = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    setDragValue(valueFromClientX(e.clientX));
  };
  const end = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const v = valueFromClientX(e.clientX);
    setDragValue(null);
    onCommit(v);
  };

  const glyph = thumbGlyph(shown);
  const filledLeft = answered && shown < 50;
  const filledRight = answered && shown > 50;
  const name = label ? `${label}: ${shown}%` : `Risposta: ${shown}%`;

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="w-16 shrink-0 text-[12px] font-semibold text-muted-foreground">
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        className="relative h-9 flex-1 touch-none select-none"
        // Tap on the track: jump there and keep dragging from that point.
        onPointerDown={(e) => start(e, valueFromClientX(e.clientX))}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* two adjacent segments; only one gets filled */}
        <div className="absolute inset-x-0 top-1/2 flex h-2.5 -translate-y-1/2 overflow-hidden rounded-full">
          <div className="relative h-full flex-1 bg-muted">
            {filledLeft && (
              <div
                data-slider-fill
                className="absolute inset-y-0 right-0"
                style={{ left: `${shown * 2}%`, backgroundColor: color }}
              />
            )}
          </div>
          <div className="mx-px" />
          <div className="relative h-full flex-1 bg-muted">
            {filledRight && (
              <div
                data-slider-fill
                className="absolute inset-y-0 left-0"
                style={{ width: `${(shown - 50) * 2}%`, backgroundColor: color }}
              />
            )}
          </div>
        </div>

        <button
          role="slider"
          aria-label={name}
          aria-valuenow={shown}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            // Grabbing the thumb keeps its value (no jump to the pointer position).
            e.stopPropagation();
            start(e, shown);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onCommit(Math.max(0, shown - 1));
            if (e.key === "ArrowRight") onCommit(Math.min(100, shown + 1));
          }}
          className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full shadow-md ring-2 ring-background"
          style={{ left: `${shown}%`, backgroundColor: color }}
        >
          {glyph === "check" ? (
            <Check size={16} strokeWidth={3.5} color="#fff" />
          ) : glyph === "cross" ? (
            <X size={16} strokeWidth={3.5} color="#fff" />
          ) : (
            <span className="text-[13px] font-extrabold text-white">?</span>
          )}
        </button>
      </div>
      <span
        className="w-11 text-right text-[14px] font-bold tabular-nums"
        style={{ color }}
      >
        {shown}%
      </span>
    </div>
  );
}
