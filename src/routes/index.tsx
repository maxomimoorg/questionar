import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { BioEditor } from "@/components/BioEditor";
import { CompactProfileTags, PROFILE_TAGS } from "@/components/ProfileTags";
import { NavPill } from "@/components/CategoryControls";
import { Questionnaire } from "@/components/Questionnaire";
import { CATEGORIES, EROTISMO_LABEL } from "@/lib/questions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    focus: z.string().optional(),
    tag: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "QuestionAR — il tuo questionario di compatibilità" },
      {
        name: "description",
        content:
          "Rispondi al questionario con gli slider, aggiungi commenti e domande personalizzate. Tutti i dati restano sul tuo dispositivo.",
      },
      { property: "og:title", content: "QuestionAR — il tuo questionario di compatibilità" },
      {
        property: "og:description",
        content:
          "Questionario a slider per misurare la compatibilità tra profili, salvato solo in locale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { focus, tag } = Route.useSearch();
  const [editing, setEditing] = useState(false);

  const closeEditor = () => {
    setEditing(false);
    if (tag) void navigate({ to: "/", search: {} });
  };

  useEffect(() => {
    if (tag && PROFILE_TAGS.some((item) => item.id === tag)) setEditing(true);
  }, [tag]);

  return (
    <div className="app-shell safe-bottom space-y-4 pt-4">
      <section className="section-card">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px]">Bio</h2>
            {state.bio ? (
              <div
                className="rte-content mt-1 text-[14px]"
                dangerouslySetInnerHTML={{ __html: state.bio }}
              />
            ) : (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nessuna bio: tocca la matita per scriverne una.
              </p>
            )}
            <CompactProfileTags tags={state.tags} className="mt-2" />
          </div>
          <button
            aria-label="Modifica bio, nome e username"
            onClick={() => setEditing(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-accent"
          >
            <Pencil size={16} />
          </button>
        </div>
      </section>

      <Questionnaire
        categories={CATEGORIES}
        defaultOpen
        hiddenKey="hidden"
        {...(focus ? { focus } : {})}
        afterCategories={<NavPill to="/erotismo" label={EROTISMO_LABEL} />}
      />

      {editing && (
        <BioEditor
          {...(tag ? { initialTag: tag } : {})}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
