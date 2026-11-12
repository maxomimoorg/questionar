import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { NavPill } from "@/components/CategoryControls";
import { CompareCategories } from "@/components/compare/CompareCategories";
import { CompatibilityMap } from "@/components/compare/CompatibilityMap";
import { categoryBreakdown } from "@/lib/compat-map";
import { MarginText } from "@/components/MarginText";
import { percentColor } from "@/lib/color";
import { useComparePeople } from "@/lib/compare-people";
import { averageCompatDetail, estimateNote, formatCompat, partialNote } from "@/lib/compat";
import { EROTISMO_CATEGORIES, EROTISMO_LABEL, isEroticQuestionId } from "@/lib/questions";

export const Route = createFileRoute("/confronto_/erotismo")({
  // `b` is optional so an address without it shows the "not in your address book" message, not a crash.
  validateSearch: z.object({ b: z.string().optional(), c: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Confronto Erotismo — QuestionAR" },
      {
        name: "description",
        content: "Confronto della sezione facoltativa Erotismo tra profili QuestionAR.",
      },
      { property: "og:title", content: "Confronto Erotismo — QuestionAR" },
      {
        property: "og:description",
        content: "Compatibilità della sezione facoltativa, per categoria e per domanda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EroticComparePage,
});

function EroticComparePage() {
  const { b, c } = Route.useSearch();
  const { contactB, people, participants, allQuestions } = useComparePeople(b, c);
  const eroticQuestions = allQuestions.filter((q) => isEroticQuestionId(q.id));
  const detail = averageCompatDetail(
    eroticQuestions.map((q) => q.id),
    participants,
  );
  const note = partialNote(detail);
  const estimate = estimateNote(detail);
  const [reveal, setReveal] = useState<{ key: string; n: number } | null>(null);
  const bars = categoryBreakdown(EROTISMO_CATEGORIES, eroticQuestions, participants);

  if (!contactB) {
    return (
      <div className="app-shell safe-bottom pt-6">
        <p className="text-[14px]">
          Questa connessione non è più nella tua rubrica.{" "}
          <Link to="/rubrica" className="text-accent underline">
            Torna alla rubrica
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell safe-bottom space-y-4 pt-4">
      <NavPill
        to="/confronto"
        search={{ b, ...(c ? { c } : {}) }}
        label="Torna al confronto principale"
        back
      />
      <section
        className="section-card border-2"
        style={{ borderColor: detail ? percentColor(detail.score) : "var(--color-border)" }}
      >
        <h2 className="text-[16px]">{EROTISMO_LABEL.toUpperCase()}</h2>
        <div
          className="text-[16px] font-bold"
          style={{ color: detail ? percentColor(detail.score) : "var(--color-muted-foreground)" }}
        >
          {detail ? (
            <>
              {formatCompat(detail)}
              <MarginText result={detail} />
            </>
          ) : (
            "dati insufficienti"
          )}
        </div>
        {note && <p className="text-[12px] text-muted-foreground">{note}</p>}
        {estimate && <p className="text-[12px] text-muted-foreground">{estimate}</p>}
        <p className="mt-1 text-[12px] text-muted-foreground">
          Con{" "}
          {people
            .filter((p) => !p.mine)
            .map((p) => p.name)
            .join(" e ")}
          . Queste domande contano una sola volta anche nella compatibilità generale.
        </p>
        <div className="mt-3 border-t border-border pt-3">
          <CompatibilityMap
            overall={detail}
            bars={bars}
            title="Mappa Erotismo"
            onSelect={(key) => setReveal((cur) => ({ key, n: (cur?.n ?? 0) + 1 }))}
          />
        </div>
      </section>
      <CompareCategories
        categories={EROTISMO_CATEGORIES}
        allQuestions={eroticQuestions}
        people={people}
        defaultOpen={false}
        reveal={reveal}
        section="erotic"
      />
    </div>
  );
}
