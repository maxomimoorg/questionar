import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Star, Zap, ArrowRightCircle, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { PROFILE_TAGS } from "@/components/ProfileTags";
import { percentColor } from "@/lib/color";
import { averageCompat, multiCompat } from "@/lib/compat";
import { CATEGORIES } from "@/lib/questions";
import { useStore } from "@/lib/store";
import { handleOf, type Answer, type Question } from "@/lib/types";

export const Route = createFileRoute("/confronto")({
  validateSearch: z.object({ b: z.string(), c: z.string().optional() }),
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
  component: ComparePage,
});

type ExpandedProfile = {
  handle: string;
  name: string;
  mine: boolean;
  compatibility: number | null;
};

function ComparePage() {
  const { state, questions } = useStore();
  const { toggleRecommend } = useStore();
  const navigate = useNavigate();
  const { b, c } = Route.useSearch();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<ExpandedProfile | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = state.identity;
  const contactB = state.contacts.find((x) => x.handle === b);
  const contactC = c ? state.contacts.find((x) => x.handle === c) : undefined;

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

  const people = [
    { handle: handleOf(me), name: "io", answers: state.answers, mine: true },
    {
      handle: contactB.handle,
      name: contactB.name,
      answers: contactB.snapshot?.answers ?? {},
      mine: false,
    },
    ...(contactC
      ? [
          {
            handle: contactC.handle,
            name: contactC.name,
            answers: contactC.snapshot?.answers ?? {},
            mine: false,
          },
        ]
      : []),
  ];

  // union of my questions and the other profiles' custom ones
  const allQuestions: Question[] = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) map.set(q.id, q);
    for (const contact of [contactB, contactC]) {
      for (const q of contact?.snapshot?.customQuestions ?? []) {
        if (!map.has(q.id)) map.set(q.id, { ...q, custom: true });
      }
    }
    return [...map.values()];
  }, [questions, contactB, contactC]);

  const participants = people.map((p) => ({ answers: p.answers }));
  const overall = averageCompat(
    allQuestions.map((q) => q.id),
    participants,
  );

  const others = people.filter((p) => !p.mine);
  const recommended = (contactB.snapshot?.recommends ?? [])
    .filter((h) => h !== handleOf(me));
  const tagSets = [
    state.tags,
    contactB.snapshot?.tags ?? {},
    ...(contactC ? [contactC.snapshot?.tags ?? {}] : []),
  ];
  const visibleTags = PROFILE_TAGS.filter((tag) =>
    tagSets.some((tags) => Boolean(tags[tag.id])),
  );

  const editTag = (tagId: string) => {
    void navigate({ to: "/", search: { tag: tagId } });
  };

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
          borderColor:
            overall === null ? "var(--color-border)" : percentColor(overall),
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px]">COMPATIBILITÀ</h2>
            <div
              className="text-[16px] font-bold"
              style={{
                color:
                  overall === null ? "var(--color-muted-foreground)" : percentColor(overall),
              }}
            >
              {overall === null ? "dati insufficienti" : `${overall}%`}
            </div>
          </div>
          <button
            onClick={() => toggleRecommend(contactB.handle)}
            aria-label={
              contactB.recommended ? "Non consigliare più" : "Consiglia ai tuoi contatti!"
            }
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              contactB.recommended
                ? "bg-accent text-accent-foreground"
                : "bg-background text-accent"
            }`}
          >
            <Star size={18} />
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
            const pair = p.mine
              ? null
              : averageCompat(
                  allQuestions.map((q) => q.id),
                  [{ answers: state.answers }, { answers: p.answers }],
                );
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
                    compatibility: pair,
                  })
                }
                onPointerUp={stopLongPress}
                onPointerLeave={stopLongPress}
                onPointerCancel={stopLongPress}
                onContextMenu={(event) => event.preventDefault()}
                style={
                  showPair
                    ? {
                        borderColor:
                          pair === null ? "var(--color-border)" : percentColor(pair),
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
                      color:
                        pair === null ? "var(--color-muted-foreground)" : percentColor(pair),
                    }}
                  >
                    {pair === null ? "–" : `${pair}%`}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[12px] text-muted-foreground">
          {contactB.recommended
            ? "Stai consigliando questo profilo ai tuoi contatti."
            : "Tocca la stellina per consigliare questo profilo ai tuoi contatti."}
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
                  : percentColor(expandedProfile.compatibility),
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
                      : percentColor(expandedProfile.compatibility),
                }}
              >
                {expandedProfile.mine
                  ? "ME!"
                  : expandedProfile.compatibility === null
                    ? "dati insufficienti"
                    : `${expandedProfile.compatibility}%`}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* bios */}
      <section className="section-card">
        <div className="text-[12px] text-muted-foreground">@{contactB.handle}</div>
        {contactB.snapshot?.bio ? (
          <div
            className="rte-content mt-1 text-[14px]"
            dangerouslySetInnerHTML={{ __html: contactB.snapshot.bio }}
          />
        ) : (
          <p className="mt-1 text-[12px] text-muted-foreground">Nessuna bio.</p>
        )}
        {contactC && (
          <>
            <hr className="my-3 border-border" />
            <div className="text-[12px] text-muted-foreground">@{contactC.handle}</div>
            {contactC.snapshot?.bio ? (
              <div
                className="rte-content mt-1 text-[14px]"
                dangerouslySetInnerHTML={{ __html: contactC.snapshot.bio }}
              />
            ) : (
              <p className="mt-1 text-[12px] text-muted-foreground">Nessuna bio.</p>
            )}
          </>
        )}
        {visibleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {visibleTags.map(({ id, label, icon: Icon }) => {
              const mine = Boolean(tagSets[0]?.[id]);
              const otherCount = tagSets.slice(1).filter((tags) => tags[id]).length;
              const shared = mine && otherCount > 0;
              const otherOnlyTone = otherCount === tagSets.length - 1 ? "red" : "yellow";

              return (
                <button
                  key={id}
                  type="button"
                  disabled={mine}
                  onClick={() => editTag(id)}
                  aria-label={mine ? label : `Attiva il tag ${label} nel tuo profilo`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] transition-colors ${
                    shared
                      ? "border-tag-match bg-tag-match text-tag-match-foreground"
                      : mine
                        ? "border-input bg-background text-muted-foreground"
                        : otherOnlyTone === "red"
                          ? "border-destructive bg-background text-foreground"
                          : "border-warning bg-background text-foreground"
                  }`}
                >
                  <Icon size={12} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* questions by category */}
      {CATEGORIES.map((cat) => {
        const items = allQuestions.filter((q) => q.category === cat.key);
        if (items.length === 0) return null;
        const catCompat = averageCompat(
          items.map((q) => q.id),
          participants,
        );
        return (
          <section key={cat.key} className="rounded-3xl bg-surface-2/60 p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-[16px] font-bold text-accent">{cat.label}</span>
              <span
                className="text-[14px] font-bold"
                style={{
                  color:
                    catCompat === null
                      ? "var(--color-muted-foreground)"
                      : percentColor(catCompat),
                }}
              >
                {catCompat === null ? "–" : `${catCompat}%`}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((q) => (
                <CompareRow
                  key={q.id}
                  question={q}
                  people={people}
                  known={questions.some((x) => x.id === q.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* profiles recommended by this contact */}
      {recommended.length > 0 && (
        <section className="section-card">
          <h2 className="text-[16px]">Profili consigliati da {contactB.name}</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {recommended.map((h) => (
              <button
                key={h}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(h);
                    toast.success("Handle copiato: incollalo nella ricerca connessioni");
                  } catch {
                    toast.error("Impossibile copiare");
                  }
                }}
                className="flex items-center gap-2 rounded-2xl bg-background p-2 text-left"
              >
                <Avatar handle={h} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">
                    {h.replace(/[^a-z0-9]/gi, "")}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">@{h}</div>
                </div>
                <Star size={14} className="ml-auto text-accent" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type Person = {
  handle: string;
  name: string;
  answers: Record<string, Answer>;
  mine: boolean;
};

function CompareRow({
  question,
  people,
  known,
}: {
  question: Question;
  people: Person[];
  known: boolean;
}) {
  const { ensureQuestion } = useStore();
  const navigate = useNavigate();
  const rows = people.map((p) => ({ person: p, answer: p.answers[question.id] }));
  const mine = rows[0]!;
  const compat = multiCompat(
    question.id,
    people.map((p) => ({ answers: p.answers })),
  );
  const criticalBy = rows.filter((r) => r.answer?.critical).map((r) => r.person);
  const needsMyAnswer = !mine.answer?.answered;
  const allAnswered = rows.every((r) => r.answer?.answered);
  const noneAnswered = rows.every((r) => !r.answer?.answered);

  const goToMine = () => {
    if (!known) ensureQuestion(question.id, question.text);
    void navigate({ to: "/", search: { focus: question.id } });
  };

  if (noneAnswered) return null;

  if (!allAnswered && needsMyAnswer) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2">
        <p className="flex-1 text-[14px] leading-snug text-muted-foreground">{question.text}</p>
        <button
          aria-label="Rispondi sul tuo profilo"
          onClick={goToMine}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-background text-accent"
        >
          <ArrowRightCircle size={16} />
        </button>
      </div>
    );
  }

  if (!allAnswered && !needsMyAnswer) {
    return (
      <div className="rounded-2xl bg-surface px-3 py-2">
        <p className="text-[14px] leading-snug text-muted-foreground">{question.text}</p>
      </div>
    );
  }


  return (
    <div
      className={`rounded-2xl px-3 py-3 ${
        criticalBy.length > 0 ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[14px] leading-snug">{question.text}</p>
        {criticalBy.length > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-[12px] text-accent">
            <Zap size={14} />
            {criticalBy.map((p) => (p.mine ? "io" : p.name)).join(", ")}
          </span>
        )}
      </div>

      {/* shared track with one thumb per person */}

      <div className="relative mt-3 h-9">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-muted" />
        {compat !== null && (
          <div
            className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: percentColor(compat) }}
          />
        )}
        {rows.map((r) =>
          r.answer?.answered ? (
            r.person.mine ? (
              <span
                key={r.person.handle}
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
                style={{
                  left: `${r.answer.value}%`,
                  backgroundColor: percentColor(r.answer.value),
                }}
              />
            ) : (

              <span
                key={r.person.handle}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-[3px]"
                style={{
                  left: `${r.answer.value}%`,
                  backgroundColor: percentColor(r.answer.value),
                }}
              >
                <Avatar handle={r.person.handle} size={26} />
              </span>
            )
          ) : null,
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
        {rows.map((r) => (
          <span key={r.person.handle}>
            {r.person.mine ? "io" : r.person.name}:{" "}
            <b
              style={{
                color: r.answer?.answered
                  ? percentColor(r.answer.value)
                  : "var(--color-muted-foreground)",
              }}
            >
              {r.answer?.answered ? `${r.answer.value}%` : "–"}
            </b>
          </span>
        ))}
        <span>
          Compatibilità:{" "}
          <b
            style={{
              color:
                compat === null ? "var(--color-muted-foreground)" : percentColor(compat),
            }}
          >
            {compat === null ? "–" : `${compat}%`}
          </b>
        </span>
      </div>

      <div className="mt-1 space-y-0.5">
        {rows
          .filter((r) => r.answer?.comment)
          .map((r) => (
            <p key={r.person.handle} className="text-[14px] italic text-muted-foreground">
              <b className="not-italic">{r.person.mine ? "io" : r.person.name}:</b>{" "}
              {r.answer!.comment}
            </p>
          ))}
      </div>
    </div>
  );
}
