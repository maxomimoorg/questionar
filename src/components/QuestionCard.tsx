import { Eye, EyeOff, MessageSquare, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { percentColor } from "@/lib/color";
import { useStore } from "@/lib/store";
import { CUSTOM_TYPE_LABELS, categoryOfId, isReciprocal, type Question } from "@/lib/questions";
import { isCategoryHidden } from "@/lib/visibility";
import { giveOf, isPartialAnswer, receiveOf, reciprocalValue } from "@/lib/types";
import { AnswerSlider } from "./AnswerSlider";
import { ConfirmDialog } from "./ConfirmDialog";
import { useLongPress } from "@/hooks/use-long-press";

/** Kept for existing imports; the slider lives in ./AnswerSlider. */
export { AnswerSlider };

type Props = {
  question: Question;
  /** Shown inside a hidden category's group: dimmed, while its own flag stays as it is. */
  hiddenByCategory?: boolean;
};

export function QuestionCard({ question, hiddenByCategory }: Props) {
  const { state, setAnswer, removeCustomQuestion, clearAnswers } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
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

  const toggleHidden = () => {
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
  };
  const eyePress = useLongPress(toggleHidden, () => setConfirmClear(true));

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
      style={
        answer.critical
          ? ({ "--tw-ring-color": color } as import("react").CSSProperties)
          : undefined
      }
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
              answer.comment
                ? "bg-accent text-accent-foreground"
                : "bg-background text-muted-foreground"
            }`}
          >
            <MessageSquare size={15} />
          </button>
          <button
            aria-label={answer.hidden ? "Ripristina la domanda" : "Nascondi la domanda"}
            {...eyePress}
            title="Tocca per nascondere · tieni premuto per eliminare la risposta"
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
              Risposta parziale: rispondi anche a “{give === undefined ? "Fare" : "Ricevere"}” per
              un confronto completo. Intanto i confronti mostrano una stima.
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
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Eliminare la risposta?"
        description="Eliminare la risposta a questa domanda? Il valore e il commento verranno azzerati e la domanda tornerà allo stato non risposto."
        onConfirm={() => {
          clearAnswers([question.id]);
          setDraftComment("");
          setCommentOpen(false);
          toast("Risposta eliminata", {
            description: "La domanda è tornata allo stato non risposto.",
          });
        }}
      />
    </div>
  );
}
