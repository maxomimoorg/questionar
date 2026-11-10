import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NavPill } from "@/components/CategoryControls";
import { Questionnaire } from "@/components/Questionnaire";
import { EROTISMO_CATEGORIES, EROTISMO_LABEL } from "@/lib/questions";

export const Route = createFileRoute("/erotismo")({
  validateSearch: z.object({ focus: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Erotismo — QuestionAR" },
      { name: "description", content: "Sezione facoltativa di QuestionAR, organizzata per categorie." },
      { property: "og:title", content: "Erotismo — QuestionAR" },
      { property: "og:description", content: "Sezione facoltativa del questionario QuestionAR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EroticPage,
});

function EroticPage() {
  const { focus } = Route.useSearch();
  return (
    <div className="app-shell safe-bottom space-y-4 pt-4">
      <NavPill to="/" label="Torna al questionario principale" back />
      <h1 className="sr-only">{EROTISMO_LABEL}</h1>
      {/* ===== AREA INFORMATIVA: modifica liberamente il testo qui sotto ===== */}
      <section className="rounded-3xl bg-surface-2/60 p-4 text-[14px] leading-relaxed text-foreground">
        <h2 className="text-[16px] font-semibold text-accent">Come compilare questa sezione</h2>
        <p className="mt-2">
          Questa sezione facoltativa approfondisce fantasie, pratiche e dinamiche. Molte domande
          sono <strong>reciproche</strong> e hanno due slider distinti:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Fare:</strong> quanto desideri praticare attivamente questa cosa verso l’altra persona.</li>
          <li><strong>Ricevere:</strong> quanto desideri che sia l’altra persona a farla verso di te.</li>
        </ul>
        <p className="mt-2">
          Nel confronto non si paragonano i due “Fare”: si incrocia quanto tu ami <em>fare</em> con
          quanto l’altra persona ama <em>ricevere</em>, e viceversa. Così emerge se vi completate o
          se desiderate lo stesso ruolo.
        </p>
        <p className="mt-2">
          Se rispondi a un solo slider la risposta è <strong>parziale</strong>: il confronto mostrerà
          una stima con margine d’errore (es. 90% ±45%). Puoi nascondere singole domande o intere
          categorie con l’icona dell’occhio.
        </p>
      </section>
      {/* ===== FINE AREA INFORMATIVA ===== */}
      <Questionnaire
        categories={EROTISMO_CATEGORIES}
        defaultOpen={false}
        hiddenKey="hidden-erotismo"
        {...(focus ? { focus } : {})}
        emptyText="Questa sezione facoltativa non ha ancora categorie: verranno aggiunte in un prossimo aggiornamento."
      />
    </div>
  );
}
