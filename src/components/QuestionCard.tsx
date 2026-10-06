import { Check, Eye, EyeOff, MessageSquare, Trash2, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { percentColor, thumbGlyph } from "@/lib/color";
import { useStore } from "@/lib/store";
import type { Question } from "@/lib/questions";

type Props = { question: Question };

export function QuestionCard({ question }: Props) {
  const { state, setAnswer, removeCustomQuestion } = useStore();
  const answer = state.answers[question.id] ?? { value: 50, answered: false };
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [draftComment, setDraftComment] = useState(answer.comment ?? "");
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const shown = dragValue ?? answer.value;
  // Colours only recalculate on release, never during the drag.
  const colorValue = answer.answered ? answer.value : 50;
  const color = answer.answered ? percentColor(colorValue) : "var(--color-muted-foreground)";

  const valueFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 50;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  }, []);

  useEffect(() => {
    if (!dragging.current) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      setDragValue(valueFromClientX(e.clientX));
    };
    const up = (e: PointerEvent) => {
      dragging.current = false;
      const v = valueFromClientX(e.clientX);
      setDragValue(null);
      setAnswer(question.id, { value: v, answered: true });
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragValue, question.id, setAnswer, valueFromClientX]);

  const glyph = thumbGlyph(shown);
  const filledLeft = answer.answered && shown < 50;
  const filledRight = answer.answered && shown > 50;

  const commit = () => {
    setCommentOpen(false);
    setAnswer(question.id, { comment: draftComment.trim() });
  };

  return (
    <div
      id={`q-${question.id}`}
      className={`rounded-2xl px-3 py-3 transition-colors ${
        answer.hidden ? "opacity-50 grayscale" : ""
      } ${answer.critical ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"}`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[14px] leading-snug text-foreground">{question.text}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Aggiungi un commento"
            onClick={() => setCommentOpen((v) => !v)}
            className={`grid size-8 place-items-center rounded-full ${
              answer.comment ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"
            }`}
          >
            <MessageSquare size={15} />
          </button>
          <button
            aria-label="Nascondi o mostra la domanda"
            onClick={() => {
              const hidden = !answer.hidden;
              setAnswer(question.id, { hidden });
              toast(hidden ? "Domanda nascosta" : "Domanda visibile", {
                description: hidden
                  ? "Non apparirà nei confronti e non influisce sulla compatibilità."
                  : "Torna nei confronti e nel calcolo della compatibilità.",
              });
            }}
            className="grid size-8 place-items-center rounded-full bg-background text-muted-foreground"
          >
            {answer.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            aria-label="Segna come critica"
            onClick={() => {
              const critical = !answer.critical;
              setAnswer(question.id, { critical });
              toast(critical ? "Domanda critica (dealbreaker)" : "Domanda non più critica", {
                description: critical
                  ? "Vicinanza o distanza su questo tema peseranno molto di più sulla compatibilità."
                  : "Torna a pesare come tutte le altre domande.",
              });
            }}
            className={`grid size-8 place-items-center rounded-full ${
              answer.critical ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"
            }`}
          >
            <Zap size={15} />
          </button>
          {question.custom && (
            <button
              aria-label="Elimina domanda personalizzata"
              onClick={() => removeCustomQuestion(question.id)}
              className="grid size-8 place-items-center rounded-full bg-background text-destructive"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div ref={trackRef} className="relative h-9 flex-1 select-none">
          {/* two adjacent segments; only one gets filled */}
          <div className="absolute inset-x-0 top-1/2 flex h-2.5 -translate-y-1/2 overflow-hidden rounded-full">
            <div className="relative h-full flex-1 bg-muted">
              {filledLeft && (
                <div
                  className="absolute inset-y-0 right-0"
                  style={{ left: `${shown * 2}%`, backgroundColor: color }}
                />
              )}
            </div>
            <div className="mx-px" />
            <div className="relative h-full flex-1 bg-muted">
              {filledRight && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${(shown - 50) * 2}%`, backgroundColor: color }}
                />
              )}
            </div>
          </div>

          <button
            role="slider"
            aria-label={`Risposta: ${shown}%`}
            aria-valuenow={shown}
            aria-valuemin={0}
            aria-valuemax={100}
            onPointerDown={(e) => {
              e.preventDefault();
              dragging.current = true;
              setDragValue(shown);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft")
                setAnswer(question.id, { value: Math.max(0, shown - 1), answered: true });
              if (e.key === "ArrowRight")
                setAnswer(question.id, { value: Math.min(100, shown + 1), answered: true });
            }}
            className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full shadow-md ring-2 ring-background"
            style={{
              left: `${shown}%`,
              backgroundColor: answer.answered ? color : "var(--color-muted-foreground)",
            }}
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
          style={{ color: answer.answered ? color : "var(--color-muted-foreground)" }}
        >
          {shown}%
        </span>
      </div>

      {commentOpen ? (
        <input
          autoFocus
          value={draftComment}
          maxLength={150}
          onChange={(e) => setDraftComment(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder="Commento (max 150 caratteri)"
          className="mt-2 w-full rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
        />
      ) : (
        answer.comment && (
          <p className="mt-2 text-[14px] italic text-muted-foreground">{answer.comment}</p>
        )
      )}
    </div>
  );
}
