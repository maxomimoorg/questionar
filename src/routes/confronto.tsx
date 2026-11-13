import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { BioHtml } from "@/components/BioHtml";
import { CompactProfileTags } from "@/components/ProfileTags";
import { percentColor } from "@/lib/color";
import {
  averageCompatDetail,
  estimateNote,
  formatCompat,
  partialNote,
  type AverageResult,
} from "@/lib/compat";
import { CATEGORIES, EROTISMO_LABEL, isEroticQuestionId } from "@/lib/questions";
import { useStore } from "@/lib/store";
import { MarginText } from "@/components/MarginText";
import { NavPill } from "@/components/CategoryControls";
import { CompareCategories } from "@/components/compare/CompareCategories";
import { CompatibilityMap } from "@/components/compare/CompatibilityMap";
import { categoryBreakdown, sortByAffinity } from "@/lib/compat-map";
import { participantOf, useComparePeople } from "@/lib/compare-people";
import { handleOf } from "@/lib/types";

export const Route = createFileRoute("/confronto")({
  // `b` is optional so an address without it shows the "not in your address book" message, not a crash.
  validateSearch: z.object({ b: z.string().optional(), c: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Confronto profili — QuestionAR" },
      {
        name: "description",
        content:
          "Confronta il tuo questionario con quello dei tuoi contatti: compatibilità totale, per categoria e per singola domanda.",
      },
      { property: "og:title", content: "Confronto profili — QuestionAR" },
      {
        property: "og:description",
        content:
          "Compatibilità complessiva, per categoria e per domanda tra due o tre profili QuestionAR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

type ExpandedProfile = {
  handle: string;
  name: string;
  mine: boolean;
  compatibility: AverageResult | null;
};

function ComparePage() {
  const { state } = useStore();
  const { toggleFavorite } = useStore();
  const navigate = useNavigate();
  const { b, c } = Route.useSearch();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<ExpandedProfile | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = state.identity;
  const { contactB, contactC, people, participants, allQuestions } = useComparePeople(b, c);
  const overallDetail = averageCompatDetail(
    allQuestions.map((q) => q.id),
    participants,
  );
  const overall = overallDetail?.score ?? null;
  const eroticIds = allQuestions.filter((q) => isEroticQuestionId(q.id)).map((q) => q.id);
  const eroticDetail = averageCompatDetail(eroticIds, participants);
  const overallNote = partialNote(overallDetail);
  const overallEstimate = estimateNote(overallDetail);
  const [reveal, setReveal] = useState<{ key: string; n: number } | null>(null);
  const EROTISMO_KEY = "erotismo";
  const hasErotic = eroticIds.length > 0;
  const bars = sortByAffinity([
    ...categoryBreakdown(CATEGORIES, allQuestions, participants),
    // Erotismo is one more bar (its questions already count once in the total); it opens its own page.
    ...(hasErotic && eroticDetail
      ? [{ key: EROTISMO_KEY, label: EROTISMO_LABEL, detail: eroticDetail }]
      : []),
  ]);

  const others = people.filter((p) => !p.mine);

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

  const stopLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (profile: ExpandedProfile) => {
    stopLongPress();
    longPressTimer.current = setTimeout(() => {
      setExpandedProfile(profile);
      longPressTimer.current = null;
    }, 550);
  };

  return (
    <div className="app-shell safe-bottom space-y-4 pt-4">
      {/* profiles, overall compatibility and comparison actions */}
      <section
        className="section-card border-2"
        style={{
          borderColor: overall === null ? "var(--color-border)" : percentColor(overall),
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px]">COMPATIBILITÀ</h2>
            <div
              className="text-[16px] font-bold"
              style={{
                color: overall === null ? "var(--color-muted-foreground)" : percentColor(overall),
              }}
            >
              {overall === null ? (
                "dati insufficienti"
              ) : (
                <>
                  {formatCompat(overallDetail)}
                  <MarginText result={overallDetail} />
                </>
              )}
            </div>
            {overallNote && <p className="text-[12px] text-muted-foreground">{overallNote}</p>}
            {overallEstimate && (
              <p className="text-[12px] text-muted-foreground">{overallEstimate}</p>
            )}
          </div>
          <button
            onClick={() => {
              const next = !contactB.favorite;
              toggleFavorite(contactB.handle);
              toast.success(next ? "Aggiunto ai preferiti" : "Rimosso dai preferiti", {
                id: `fav-${contactB.handle}`,
              });
            }}
            aria-pressed={Boolean(contactB.favorite)}
            aria-label={contactB.favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            title={contactB.favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              contactB.favorite ? "bg-accent text-accent-foreground" : "bg-background text-accent"
            }`}
          >
            <Star size={18} fill={contactB.favorite ? "currentColor" : "none"} />
          </button>
          {contactC ? (
            <button
              onClick={() => navigate({ to: "/confronto", search: { b } })}
              className="shrink-0 rounded-xl bg-destructive px-3 py-2 text-[14px] text-destructive-foreground"
            >
              Togli il terzo
            </button>
          ) : (
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-surface-2 px-3 py-2 text-[14px]"
            >
              <Plus size={16} /> Terzo profilo
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const pairDetail = p.mine
              ? null
              : averageCompatDetail(
                  allQuestions.map((q) => q.id),
                  [participantOf(people[0]!), participantOf(p)],
                );
            const pair = pairDetail?.score ?? null;
            const showPair = Boolean(contactC && !p.mine);
            return (
              <div
                key={p.handle}
                className={`flex min-w-[150px] flex-1 items-center gap-2 rounded-2xl bg-background p-2 ${
                  showPair ? "border-2" : ""
                }`}
                onPointerDown={() =>
                  startLongPress({
                    handle: p.handle,
                    name: p.mine ? me?.name || "io" : p.name,
                    mine: p.mine,
                    compatibility: pairDetail,
                  })
                }
                onPointerUp={stopLongPress}
                onPointerLeave={stopLongPress}
                onPointerCancel={stopLongPress}
                onContextMenu={(event) => event.preventDefault()}
                style={
                  showPair
                    ? {
                        borderColor: pair === null ? "var(--color-border)" : percentColor(pair),
                      }
                    : undefined
                }
              >
                <Avatar handle={p.handle} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">
                    {p.mine ? me?.name : p.name}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">@{p.handle}</div>
                </div>
                {p.mine ? (
                  <span className="text-[14px] font-bold text-accent">ME!</span>
                ) : showPair ? (
                  <span
                    className="shrink-0 text-[14px] font-bold"
                    style={{
                      color: pair === null ? "var(--color-muted-foreground)" : percentColor(pair),
                    }}
                  >
                    {formatCompat(pairDetail)}
                    <MarginText result={pairDetail} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <CompatibilityMap
            overall={overallDetail}
            bars={bars}
            onSelect={(key) => {
              if (key === EROTISMO_KEY) {
                void navigate({ to: "/confronto/erotismo", search: { b, ...(c ? { c } : {}) } });
              } else {
                setReveal((cur) => ({ key, n: (cur?.n ?? 0) + 1 }));
              }
            }}
          />
        </div>

        <p className="mt-2 text-[12px] text-muted-foreground">
          {contactB.favorite
            ? "Tra i tuoi preferiti: la stella è visibile solo a te, nella tua rubrica."
            : "Tocca la stella per aggiungere questo profilo ai preferiti (solo sul tuo dispositivo)."}
        </p>

        {addOpen && !contactC && (
          <div className="mt-2 flex flex-wrap gap-2">
            {state.contacts
              .filter((x) => x.handle !== b)
              .map((x) => (
                <button
                  key={x.handle}
                  onClick={() => {
                    setAddOpen(false);
                    void navigate({ to: "/confronto", search: { b, c: x.handle } });
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-background p-2 text-[14px]"
                >
                  <Avatar handle={x.handle} size={28} /> {x.name}
                </button>
              ))}
            {state.contacts.filter((x) => x.handle !== b).length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                Ti serve un'altra connessione già stabilita in rubrica.
              </p>
            )}
          </div>
        )}
      </section>

      {expandedProfile && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"
          role="presentation"
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) setExpandedProfile(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Profilo di ${expandedProfile.name}`}
            className="relative w-full max-w-lg rounded-3xl border-2 bg-surface p-5 shadow-xl"
            style={{
              borderColor:
                expandedProfile.compatibility === null
                  ? "var(--color-border)"
                  : percentColor(expandedProfile.compatibility.score),
            }}
          >
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => setExpandedProfile(null)}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background text-foreground"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-4 pr-10">
              <Avatar handle={expandedProfile.handle} size={72} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold">{expandedProfile.name}</h2>
                <p className="mt-1 break-words text-[14px] text-muted-foreground">
                  @{expandedProfile.handle}
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[12px] text-muted-foreground">
                {expandedProfile.mine ? "Profilo personale" : "Compatibilità con te"}
              </div>
              <div
                className="mt-1 text-[16px] font-bold"
                style={{
                  color:
                    expandedProfile.compatibility === null
                      ? "var(--color-muted-foreground)"
                      : percentColor(expandedProfile.compatibility.score),
                }}
              >
                {expandedProfile.mine ? (
                  "ME!"
                ) : expandedProfile.compatibility === null ? (
                  "dati insufficienti"
                ) : (
                  <>
                    {formatCompat(expandedProfile.compatibility)}
                    <MarginText result={expandedProfile.compatibility} />
                  </>
                )}
              </div>
              {!expandedProfile.mine && partialNote(expandedProfile.compatibility) && (
                <p className="text-[12px] text-muted-foreground">
                  {partialNote(expandedProfile.compatibility)}
                </p>
              )}
              {!expandedProfile.mine && estimateNote(expandedProfile.compatibility) && (
                <p className="text-[12px] text-muted-foreground">
                  {estimateNote(expandedProfile.compatibility)}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* bios */}
      <section className="section-card">
        <div className="text-[12px] text-muted-foreground">@{contactB.handle}</div>
        {contactB.snapshot?.bio ? (
          <BioHtml className="rte-content mt-1 text-[14px]" html={contactB.snapshot.bio} />
        ) : (
          <p className="mt-1 text-[12px] text-muted-foreground">Nessuna bio.</p>
        )}
        <CompactProfileTags
          tags={contactB.snapshot?.tags}
          compareWith={state.tags}
          className="mt-2"
        />
        {contactC && (
          <>
            <hr className="my-3 border-border" />
            <div className="text-[12px] text-muted-foreground">@{contactC.handle}</div>
            {contactC.snapshot?.bio ? (
              <BioHtml className="rte-content mt-1 text-[14px]" html={contactC.snapshot.bio} />
            ) : (
              <p className="mt-1 text-[12px] text-muted-foreground">Nessuna bio.</p>
            )}
            <CompactProfileTags
              tags={contactC.snapshot?.tags}
              compareWith={state.tags}
              className="mt-2"
            />
          </>
        )}
      </section>

      {/* questions by category; Erotismo counts once in the total and is summarised as a category */}
      <CompareCategories
        categories={CATEGORIES}
        allQuestions={allQuestions}
        people={people}
        defaultOpen
        reveal={reveal}
        section="main"
      />
      <NavPill
        to="/confronto/erotismo"
        search={{ b, ...(c ? { c } : {}) }}
        label={EROTISMO_LABEL}
        right={
          <span
            style={{
              color: eroticDetail
                ? percentColor(eroticDetail.score)
                : "var(--color-muted-foreground)",
            }}
          >
            {formatCompat(eroticDetail)}
            <MarginText result={eroticDetail} />
          </span>
        }
      />
    </div>
  );
}
