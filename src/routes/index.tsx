import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BioEditor } from "@/components/BioEditor";
import { CompactProfileTags, PROFILE_TAGS } from "@/components/ProfileTags";
import { QuestionCard } from "@/components/QuestionCard";
import { CATEGORIES, type CategoryKey } from "@/lib/questions";
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
      {
        property: "og:image",
        content: "https://questionar.lovable.app/questionar-social.jpg",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://questionar.lovable.app/questionar-social.jpg",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, questions, toggleDrawer, addCustomQuestion, patch } = useStore();
  const navigate = useNavigate();
  const { focus, tag } = Route.useSearch();
  const [editing, setEditing] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCat, setNewCat] = useState<CategoryKey>("J");

  const closeEditor = () => {
    setEditing(false);
    if (tag) void navigate({ to: "/", search: {} });
  };

  // A question opened from a comparison gets its drawer open and is scrolled into view.
  useEffect(() => {
    if (!focus) return;
    const letter = focus.split("-")[0];
    if (letter) patch({ openDrawers: { ...state.openDrawers, [letter]: true } });
    const timer = setTimeout(() => {
      const el = document.getElementById(`q-${focus}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-accent");
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (tag && PROFILE_TAGS.some((item) => item.id === tag)) setEditing(true);
  }, [tag]);

  const hidden = useMemo(
    () => questions.filter((q) => state.answers[q.id]?.hidden),
    [questions, state.answers],
  );

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

      {CATEGORIES.map((cat) => {
        const items = questions.filter(
          (q) => q.category === cat.key && !state.answers[q.id]?.hidden,
        );
        const open = state.openDrawers[cat.key] ?? true;
        return (
          <section key={cat.key} className="rounded-3xl bg-surface-2/60 p-2">
            <button
              onClick={() => toggleDrawer(cat.key)}
              className="flex w-full items-center justify-between gap-2 px-2 py-2"
            >
              <span className="text-[16px] font-bold text-accent">{cat.label}</span>
              <span className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground">
                {items.length}
                <ChevronDown
                  size={18}
                  className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {open && (
              <div className="space-y-2 pt-1">
                {items.length === 0 && (
                  <p className="px-2 pb-2 text-[12px] text-muted-foreground">
                    Nessuna domanda attiva qui.
                  </p>
                )}
                {items.map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="section-card">
        <h2 className="text-[16px]">Domanda personalizzata</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as CategoryKey)}
            className="rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Scrivi la tua domanda"
            className="flex-1 rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
          />
          <button
            onClick={() => {
              if (!newText.trim()) return;
              addCustomQuestion(newCat, newText.trim());
              setNewText("");
            }}
            className="flex items-center justify-center gap-1 rounded-xl bg-accent px-4 py-2 text-accent-foreground"
          >
            <Plus size={16} /> Aggiungi
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-surface-2/60 p-2">
        <button
          onClick={() => toggleDrawer("hidden")}
          className="flex w-full items-center justify-between gap-2 px-2 py-2"
        >
          <span className="text-[16px] font-bold text-accent">Domande nascoste</span>
          <span className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground">
            {hidden.length}
            <ChevronDown
              size={18}
              className={`transition-transform ${state.openDrawers["hidden"] ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {state.openDrawers["hidden"] && (
          <div className="space-y-2 pt-1">
            {hidden.length === 0 && (
              <p className="px-2 pb-2 text-[12px] text-muted-foreground">
                Nessuna domanda nascosta.
              </p>
            )}
            {hidden.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <BioEditor
          {...(tag ? { initialTag: tag } : {})}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
