import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus, Star, Zap, ArrowRightCircle, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { CompactProfileTags } from "@/components/ProfileTags";
import { percentColor } from "@/lib/color";
import {
  averageCompatDetail,
  flowCompat,
  formatCompat,
  multiCompat,
  multiCompatDetail,
  type AverageResult,
} from "@/lib/compat";
import { CATEGORIES, isReciprocal } from "@/lib/questions";
import { useStore } from "@/lib/store";
import { MarginText } from "@/components/MarginText";
import { giveOf, handleOf, receiveOf, type Answer, type Question } from "@/lib/types";

/** Short note under a total that includes partial Fare/Ricevere estimates. */
function partialNote(result: AverageResult | null): string | null {
  if (!result || result.partialCount === 0) return null;
  return result.partialCount === 1
    ? "Stima: include 1 domanda con risposta parziale (± è il margine d'errore)."
    : `Stima: include ${result.partialCount} domande con risposta parziale (± è il margine d'errore).`;
}

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
  const { state, questions } = useStore();
  const { toggleFavorite } = useStore();
  const navigate = useNavigate();
  const { b, c } = Route.useSearch();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<ExpandedProfile | null>(null);
  const [closedCats, setClosedCats] = useState<Record<string, boolean>>({});
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
  const overallDetail = averageCompatDetail(
    allQuestions.map((q) => q.id),
    participants,
  );
  const overall = overallDetail?.score ?? null;
  const overallNote = partialNote(overallDetail);

  const others = people.filter((p) => !p.mine);

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
              {overall === null ? "dati insufficienti" : <>{formatCompat(overallDetail)}<MarginText result={overallDetail} /></>}
            </div>
            {overallNote && (
              <p className="text-[12px] text-muted-foreground">{overallNote}</p>
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
              contactB.favorite
                ? "bg-accent text-accent-foreground"
                : "bg-background text-accent"
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
                  [{ answers: state.answers }, { answers: p.answers }],
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
                    {formatCompat(pairDetail)}<MarginText result={pairDetail} />
                  </span>
                ) : null}
              </div>
            );
          })}
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
                {expandedProfile.mine
                  ? "ME!"
                  : expandedProfile.compatibility === null
                    ? "dati insufficienti"
                    : <>{formatCompat(expandedProfile.compatibility)}<MarginText result={expandedProfile.compatibility} /></>}
              </div>
              {!expandedProfile.mine && partialNote(expandedProfile.compatibility) && (
                <p className="text-[12px] text-muted-foreground">
                  {partialNote(expandedProfile.compatibility)}
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
          <div
            className="rte-content mt-1 text-[14px]"
            dangerouslySetInnerHTML={{ __html: contactB.snapshot.bio }}
          />
        ) : (
          <p className="mt-1 text-[12px] text-muted-foreground">Nessuna bio.</p>
        )}
        <CompactProfileTags tags={contactB.snapshot?.tags} compareWith={state.tags} className="mt-2" />
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
            <CompactProfileTags tags={contactC.snapshot?.tags} compareWith={state.tags} className="mt-2" />
          </>
        )}
      </section>

      {/* questions by category */}
      {CATEGORIES.map((cat) => {
        const items = allQuestions
          .filter((q) => q.category === cat.key)
          .map((q, i) => ({ q, i, c: multiCompat(q.id, participants) }))
          .sort((x, y) => {
            if (x.c === null && y.c === null) return x.i - y.i;
            if (x.c === null) return 1;
            if (y.c === null) return -1;
            return y.c - x.c || x.i - y.i;
          })
          .map((x) => x.q);
        if (items.length === 0) return null;
        const catDetail = averageCompatDetail(
          items.map((q) => q.id),
          participants,
        );
        const catCompat = catDetail?.score ?? null;
        const closed = Boolean(closedCats[cat.key]);
        return (
          <section key={cat.key} className="rounded-3xl bg-surface-2/60 p-2">
            <button
              type="button"
              aria-expanded={!closed}
              aria-label={closed ? `Apri la categoria ${cat.label}` : `Chiudi la categoria ${cat.label}`}
              onClick={() =>
                setClosedCats((current) => ({ ...current, [cat.key]: !current[cat.key] }))
              }
              className="flex w-full items-center justify-between gap-2 rounded-2xl px-2 py-2 text-left"
            >
              <span className="text-[16px] font-bold text-brand">{cat.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className="text-[14px] font-bold"
                  style={{
                    color:
                      catCompat === null
                        ? "var(--color-muted-foreground)"
                        : percentColor(catCompat),
                  }}
                >
                  {formatCompat(catDetail)}<MarginText result={catDetail} />
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 text-muted-foreground transition-transform duration-300 ease-out ${
                    closed ? "" : "rotate-180"
                  }`}
                />
              </span>
            </button>
            {closed ? null : (
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
            )}
          </section>
        );
      })}
    </div>
  );
}

type Person = {
  handle: string;
  name: string;
  answers: Record<string, Answer>;
  mine: boolean;
};

/** Marker on a comparison track: a dot for me, the avatar for everyone else. */
function PersonThumb({ person, value }: { person: Person; value: number }) {
  return person.mine ? (
    <span
      className="absolute top-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
      style={{ left: `${value}%`, backgroundColor: percentColor(value) }}
    />
  ) : (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-[3px]"
      style={{ left: `${value}%`, backgroundColor: percentColor(value) }}
    >
      <Avatar handle={person.handle} size={26} />
    </span>
  );
}

const giverLabel = (p: Person) => (p.mine ? "Io faccio" : `${p.name} fa`);
const receiverLabel = (p: Person) => (p.mine ? "io ricevo" : `${p.name} riceve`);

/** One Fare/Ricevere percentage, or "–" when that side has no answer yet. */
function SideValue({ value }: { value: number | undefined }) {
  return value === undefined ? (
    <b className="text-muted-foreground">–</b>
  ) : (
    <b style={{ color: percentColor(value) }}>{value}%</b>
  );
}

/** Who still has to answer a side, e.g. "manca il tuo “Fare”" / "manca il “Ricevere” di Luna". */
function missingSide(p: Person, side: "Fare" | "Ricevere") {
  return p.mine ? `manca il tuo “${side}”` : `manca il “${side}” di ${p.name}`;
}

/**
 * Reciprocal question: one track per direction, "who gives → who receives", each with its own
 * match score. A direction with an unanswered side waits for that answer; the question score is
 * the mean of the known flows (an estimate when some are missing).
 */
function ReciprocalFlowsView({ rows }: { rows: { person: Person; answer: Answer }[] }) {
  const criticalCount = rows.filter((r) => r.answer.critical).length;
  const flows: {
    giver: Person;
    receiver: Person;
    give: number | undefined;
    receive: number | undefined;
    score: number | null;
  }[] = [];
  for (const g of rows) {
    for (const r of rows) {
      if (g === r) continue;
      flows.push({
        giver: g.person,
        receiver: r.person,
        give: giveOf(g.answer),
        receive: receiveOf(r.answer),
        score: flowCompat(g.answer, r.answer, criticalCount),
      });
    }
  }
  return (
    <div className="mt-2 space-y-1">
      {flows.map((f) => {
        const missing = [
          f.give === undefined ? missingSide(f.giver, "Fare") : null,
          f.receive === undefined ? missingSide(f.receiver, "Ricevere") : null,
        ].filter(Boolean);
        return (
          <div key={`${f.giver.handle}>${f.receiver.handle}`}>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-muted-foreground">
                {giverLabel(f.giver)} ➔ {receiverLabel(f.receiver)}
              </span>
              {f.score === null ? (
                <span className="text-muted-foreground">in attesa di risposta</span>
              ) : (
                <b style={{ color: percentColor(f.score) }}>{f.score}%</b>
              )}
            </div>
            <div className="relative h-9">
              <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-muted" />
              {f.score !== null && (
                <div
                  className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: percentColor(f.score) }}
                />
              )}
              {f.give !== undefined && <PersonThumb person={f.giver} value={f.give} />}
              {f.receive !== undefined && <PersonThumb person={f.receiver} value={f.receive} />}
            </div>
            {missing.length > 0 && (
              <p className="text-[12px] text-muted-foreground">
                Verso non calcolabile: {missing.join(", ")}.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const compatDetail = multiCompatDetail(
    question.id,
    people.map((p) => ({ answers: p.answers })),
  );
  const compat = compatDetail?.score ?? null;
  const criticalBy = rows.filter((r) => r.answer?.critical).map((r) => r.person);
  // Same rule as the profile: critical questions use the percentage colour, not the theme.
  const criticalColor =
    compat !== null ? percentColor(compat) : "var(--color-muted-foreground)";
  const reciprocal = isReciprocal(question);
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
        criticalBy.length > 0 ? "bg-surface-2 ring-2" : "bg-surface"
      }`}
      style={
        criticalBy.length > 0
          ? ({ "--tw-ring-color": criticalColor } as import("react").CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[14px] leading-snug">{question.text}</p>
        {criticalBy.length > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 text-[12px]"
            style={{ color: criticalColor }}
          >
            <Zap size={14} />
            {criticalBy.map((p) => (p.mine ? "io" : p.name)).join(", ")}
          </span>
        )}
      </div>

      {reciprocal ? (
        <ReciprocalFlowsView rows={rows as { person: Person; answer: Answer }[]} />
      ) : (
        /* shared track with one thumb per person */
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
              <PersonThumb key={r.person.handle} person={r.person} value={r.answer.value} />
            ) : null,
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
        {rows.map((r) => (
          <span key={r.person.handle}>
            {r.person.mine ? "io" : r.person.name}:{" "}
            {reciprocal && r.answer?.answered ? (
              <>
                Fare <SideValue value={giveOf(r.answer)} />
                {" · "}Ricevere <SideValue value={receiveOf(r.answer)} />
              </>
            ) : (
              <b
                style={{
                  color: r.answer?.answered
                    ? percentColor(r.answer.value)
                    : "var(--color-muted-foreground)",
                }}
              >
                {r.answer?.answered ? `${r.answer.value}%` : "–"}
              </b>
            )}
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
            {formatCompat(compatDetail)}<MarginText result={compatDetail} />
          </b>
        </span>
      </div>
      {compatDetail?.partial && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          Compatibilità parziale: è una stima, perché manca una parte della risposta
          “Fare”/“Ricevere”.
        </p>
      )}

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
