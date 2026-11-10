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
          Questa sezione facoltativa approfondisce pratiche e dinamiche riguardanti il mondo dell'erotismo. In QuestionAR è importante distinguere ed indicare quelli che sono i propri <li><strong>desideri</strong> dalle semplici fantasie: rispondi chiedendoti cosa vorresti davvero realizzare con una persona compatibile, più che le cose su cui fantastichi per eccitarti. Sono sfere simili, ma confonderle potrebbe creare aspettative diverse da ciò che si vuole realmente.
        </p>
        <h2 className="text-[14px] font-semibold text-accent">Risposte complementari:</h2>
        <p className="mt-2">
          Fare attenzione ad interpretare in modo condiviso i valori <em>Fare/Ricevere</em> sia nella compilazione che nella creazione di domande personalizzate:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Fare:</strong> ciò che desideri praticare da una posizione "attiva" o "dominante", dove solitamente guidi, decidi o hai il pieno controllo e potere costante.</li>
          <li><strong>Ricevere:</strong> ciò che desideri praticare da una posizione "passiva" o "sottomessa", dove solitamente segui, accogli, ti affidi e cedi il controllo su di te o parti del tuo corpo.</li>
        </ul>
        <p className="mt-2">
          Nella creazione di nuove domande personalizzate, sarebbe meglio usare formulazioni prescise e concise in modo da potersi diffondere naturalmente su altri profili senza che vengano generati doppioni (due domande con testo uguale e nella stessa categoria sarebbero gemelle anche se create da persone diverse). Domande ultraspecifiche potrebbero non ottenere risposte altrui, quindi prima di crearle chiediti quanto siano davvero importanti per te, e se non sia il caso di utilizzare i commenti a una domanda generica pertinente per indicare quello che preferisci nello specifico.
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
