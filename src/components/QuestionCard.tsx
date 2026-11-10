import { Check, Eye, EyeOff, MessageSquare, Trash2, X, Zap } from "lucide-react";
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { percentColor, thumbGlyph } from "@/lib/color";
import { useStore } from "@/lib/store";
import { CUSTOM_TYPE_LABELS, categoryOfId, isReciprocal, type Question } from "@/lib/questions";
import { isCategoryHidden } from "@/lib/visibility";
import { giveOf, isPartialAnswer, receiveOf, reciprocalValue } from "@/lib/types";

type Props = {
  question: Question;
  /** Shown inside a hidden category's group: dimmed, while its own flag stays as it is. */
  hiddenByCategory?: boolean;
};

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

export function QuestionCard({ question, hiddenByCategory }: Props) {
  const { state, setAnswer, removeCustomQuestion } = useStore();
  const answer = state.answers[question.id] ?? { value: 50, answered: false };
  const [commentOpen, setCommentOpen] = useState(false);
  const [draftComment, setDraftComment] = useState(answer.comment ?? "");
  const reciprocal = isReciprocal(question);

  const color = answer.answered ? percentColor(answer.value) : "var(--color-muted-foreground)";

  // Answers saved with a single slider start both sides from that value; a side never
  // touched stays unanswered, so the question counts as partially answered.
  const give = answer.answered ? giveOf(answer) : undefined;
  const receive = answer.answered ? receiveOf(answer) : undefined;
  const partial = isPartialAnswer(answer);
  const saveReciprocal = (giveValue: number | undefined, receiveValue: number | undefined) =>
    setAnswer(question.id, {
      ...(giveValue !== undefined ? { giveValue } : {}),
      ...(receiveValue !== undefined ? { receiveValue } : {}),
      value: reciprocalValue(giveValue, receiveValue),
      answered: true,
    });

  const commit = () => {
    setCommentOpen(false);
    setAnswer(question.id, { comment: draftComment.trim() });
  };

  return (
    <div
      id={`q-${question.id}`}
      className={`rounded-2xl px-3 py-3 transition-colors ${
        answer.hidden || hiddenByCategory ? "opacity-50 grayscale" : ""
      } ${answer.critical ? "bg-surface-2 ring-2" : "bg-surface"}`}
      style={answer.critical ? ({ "--tw-ring-color": color } as import("react").CSSProperties) : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-[14px] leading-snug text-foreground">{question.text}</p>
          {question.custom && (
            <p
              className="mt-0.5 text-[11px] font-semibold text-muted-foreground"
              data-testid="custom-type"
            >
              Personalizzata · {CUSTOM_TYPE_LABELS[reciprocal ? "reciprocal" : "similarity"]}
            </p>
          )}
        </div>
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
            aria-label={answer.hidden ? "Ripristina la domanda" : "Nascondi la domanda"}
            onClick={() => {
              const hidden = !answer.hidden;
              setAnswer(question.id, { hidden });
              const catHidden = isCategoryHidden(state, categoryOfId(question.id));
              toast(hidden ? "Domanda nascosta" : catHidden ? "Domanda ripristinata" : "Domanda visibile", {
                description: hidden
                  ? "Non apparirà nei confronti e non influisce sulla compatibilità."
                  : catHidden
                    ? "Resta nascosta finché la sua categoria è nascosta."
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
              answer.critical ? "text-background" : "bg-background text-muted-foreground"
            }`}
            style={answer.critical ? { backgroundColor: color } : undefined}
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

      {reciprocal ? (
        <div className="mt-2 space-y-1">
          <AnswerSlider
            label="Fare"
            value={give ?? 50}
            answered={give !== undefined}
            onCommit={(v) => saveReciprocal(v, receive)}
          />
          <AnswerSlider
            label="Ricevere"
            value={receive ?? 50}
            answered={receive !== undefined}
            onCommit={(v) => saveReciprocal(give, v)}
          />
          {partial && (
            <p className="text-[12px] text-muted-foreground">
              Risposta parziale: rispondi anche a “{give === undefined ? "Fare" : "Ricevere"}”
              per un confronto completo. Intanto i confronti mostrano una stima.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <AnswerSlider
            value={answer.value}
            answered={answer.answered}
            onCommit={(v) => setAnswer(question.id, { value: v, answered: true })}
          />
        </div>
      )}

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
