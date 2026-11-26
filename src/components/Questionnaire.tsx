import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { CategoryHeader, ExpandAllPill } from "@/components/CategoryControls";
import { PasswordControl } from "@/components/PasswordProtection";
import { QuestionCard } from "@/components/QuestionCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";

import {
  CUSTOM_TYPE_LABELS,
  categoryOfId,
  isReciprocal,
  type AnyCategoryKey,
  type ProtectedSection,
  type QuestionType,
} from "@/lib/questions";
import { useStore } from "@/lib/store";
import {
  completionLabel,
  completionOf,
  hiddenSection,
  isCategoryHidden,
  isIndividuallyHidden,
} from "@/lib/visibility";

type Props = {
  categories: { key: AnyCategoryKey; label: string }[];
  /** Drawer state for categories never toggled: main open, Erotismo closed. */
  defaultOpen: boolean;
  /** Key of this questionnaire's hidden-items drawer. */
  hiddenKey: string;
  /** Question to open and scroll to (from a comparison). */
  focus?: string;
  /** Rendered between the expand/collapse pill and the categories' end (e.g. Erotismo link). */
  afterCategories?: ReactNode;
  /** Shown instead of the category list when no category is configured. */
  emptyText?: string;
  /** Which password this questionnaire's pill manages (Generale on /, Erotismo on /erotismo). */
  section: ProtectedSection;
};

/** Categories, counts, hide/restore, custom questions and the hidden section of one questionnaire. */
export function Questionnaire({
  categories,
  defaultOpen,
  hiddenKey,
  focus,
  afterCategories,
  emptyText,
  section,
}: Props) {
  const {
    state,
    questions,
    toggleDrawer,
    setDrawers,
    toggleCategoryHidden,
    addCustomQuestion,
    clearAnswers,
  } = useStore();
  const [clearCat, setClearCat] = useState<{ key: string; label: string } | null>(null);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<QuestionType>("similarity");
  const [newCat, setNewCat] = useState<AnyCategoryKey | "">(
    categories[categories.length - 1]?.key ?? "",
  );

  const isOpen = (key: string) => state.openDrawers[key] ?? defaultOpen;
  const visibleCats = categories.filter((c) => !isCategoryHidden(state, c.key));
  const hidden = useMemo(
    () => hiddenSection(categories, questions, state),
    [categories, questions, state],
  );
  const hiddenCount = hidden.groups.length + hidden.individual.length;

  useEffect(() => {
    if (!focus) return;
    const cat = categoryOfId(focus);
    if (!categories.some((c) => c.key === cat)) return;
    setDrawers([cat], true);
    const timer = setTimeout(() => {
      const el = document.getElementById(`q-${focus}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-accent");
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const hideCategory = (key: string, label: string) => {
    const nowHidden = !isCategoryHidden(state, key);
    toggleCategoryHidden(key);
    toast(nowHidden ? `Categoria “${label}” nascosta` : `Categoria “${label}” ripristinata`, {
      description: nowHidden
        ? "Le sue domande non contano nei confronti. Le trovi nella sezione delle nascoste."
        : "Tornano visibili le domande non nascoste singolarmente.",
    });
  };

  return (
    <>
      <ExpandAllPill
        leading={<PasswordControl section={section} />}
        openStates={visibleCats.map((c) => isOpen(c.key))}
        onSet={(open) =>
          setDrawers(
            visibleCats.map((c) => c.key),
            open,
          )
        }
      />

      {categories.length === 0 && emptyText && (
        <p className="section-card text-[14px] text-muted-foreground">{emptyText}</p>
      )}

      {visibleCats.map((cat) => {
        const items = questions.filter(
          (q) => q.category === cat.key && !isIndividuallyHidden(state, q.id),
        );
        const open = isOpen(cat.key);
        const completion = completionOf(
          questions.filter((q) => q.category === cat.key),
          state,
          isReciprocal,
        );
        return (
          <section
            key={cat.key}
            className="rounded-3xl bg-surface-2/60 p-2"
            data-category={cat.key}
          >
            <CategoryHeader
              label={cat.label}
              open={open}
              onToggle={() => toggleDrawer(cat.key, defaultOpen)}
              right={<span data-testid="completion">{completionLabel(completion)}</span>}
              hidden={false}
              onToggleHidden={() => hideCategory(cat.key, cat.label)}
              onLongPressHidden={() => setClearCat({ key: cat.key, label: cat.label })}
            />
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

      {afterCategories}

      <section className="section-card">
        <h2 className="text-[16px]">Domanda personalizzata</h2>
        {categories.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Disponibile quando ci sarà almeno una categoria.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as AnyCategoryKey)}
              className="rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
            >
              {categories.map((c) => (
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
                if (!newText.trim() || !newCat) return;
                addCustomQuestion(newCat, newText.trim(), newType);
                setNewText("");
                setNewType("similarity");
              }}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-action-glow transition-colors hover:bg-primary/90"
            >
              <Plus size={16} /> Aggiungi
            </button>
          </div>
        )}
        {categories.length > 0 && (
          <div className="mt-3">
            <div
              role="radiogroup"
              aria-label="Tipo di domanda"
              className="inline-flex rounded-xl bg-background p-1 ring-1 ring-input"
            >
              {(["similarity", "reciprocal"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={newType === t}
                  onClick={() => setNewType(t)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    newType === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {CUSTOM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {newType === "similarity"
                ? "Normale: un solo cursore, più le risposte sono vicine più siete compatibili."
                : "Complementare: due cursori, Fare e Ricevere, confrontati in modo incrociato."}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-surface-2/60 p-2" data-testid="hidden-section">
        <CategoryHeader
          label="Categorie e domande nascoste"
          open={Boolean(state.openDrawers[hiddenKey])}
          onToggle={() => toggleDrawer(hiddenKey, false)}
          right={hiddenCount}
        />
        {state.openDrawers[hiddenKey] && (
          <div className="space-y-3 pt-1">
            {hiddenCount === 0 && (
              <p className="px-2 pb-2 text-[12px] text-muted-foreground">
                Nessuna categoria o domanda nascosta.
              </p>
            )}
            {hidden.groups.map((g) => (
              <div
                key={g.key}
                className="space-y-2 rounded-2xl bg-background/40 p-2"
                data-hidden-group={g.key}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className="flex-1 text-[14px] font-bold text-brand">{g.label}</span>
                  <button
                    type="button"
                    onClick={() => hideCategory(g.key, g.label)}
                    className="rounded-full bg-surface-2 px-3 py-1 text-[12px] font-semibold"
                  >
                    Ripristina categoria
                  </button>
                </div>
                {g.questions.length === 0 && (
                  <p className="px-1 text-[12px] text-muted-foreground">
                    Nessuna domanda in questa categoria.
                  </p>
                )}
                {g.questions.map((q) => (
                  <QuestionCard key={q.id} question={q} hiddenByCategory />
                ))}
              </div>
            ))}
            {hidden.individual.length > 0 && (
              <div className="space-y-2" data-hidden-individual>
                <p className="px-2 text-[12px] font-semibold text-muted-foreground">
                  Domande nascoste singolarmente — tocca l’occhio per ripristinarle
                </p>
                {hidden.individual.map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={clearCat !== null}
        onOpenChange={(o) => !o && setClearCat(null)}
        title="Eliminare le risposte della categoria?"
        description={`Eliminare tutte le risposte della categoria «${clearCat?.label ?? ""}»? Tutte le risposte e i commenti salvati in questa categoria torneranno allo stato iniziale.`}
        confirmLabel="Elimina tutte"
        onConfirm={() => {
          if (!clearCat) return;
          // Default and custom questions of the category share the same list.
          clearAnswers(questions.filter((q) => q.category === clearCat.key).map((q) => q.id));
          toast(`Risposte di “${clearCat.label}” eliminate`, {
            description: "Le domande della categoria sono tornate allo stato non risposto.",
          });
          setClearCat(null);
        }}
      />
    </>
  );
}
