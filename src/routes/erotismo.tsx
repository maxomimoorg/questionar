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
