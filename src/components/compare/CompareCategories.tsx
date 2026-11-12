import { useNavigate } from "@tanstack/react-router";
import { ArrowRightCircle, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CategoryHeader, ExpandAllPill } from "@/components/CategoryControls";
import { MarginText } from "@/components/MarginText";
import { PasswordUnlockCard } from "@/components/compare/PasswordUnlockCard";
import { participantOf } from "@/lib/compare-people";
import { percentColor } from "@/lib/color";
import {
  averageCompatDetail,
  flowCompat,
  formatCompat,
  multiCompat,
  multiCompatDetail,
  typeAmong,
  type Participant,
} from "@/lib/compat";
import { visibleToAll } from "@/lib/compat-map";
import { isEroticQuestionId, type ProtectedSection } from "@/lib/questions";
import { useStore } from "@/lib/store";
import { giveOf, receiveOf, type Answer, type Question } from "@/lib/types";

export type Person = {
  handle: string;
  name: string;
  answers: Record<string, Answer>;
  hiddenCategories: string[];
  /** This person's custom question definitions (their type decides Normale/Complementare). */
  customQuestions?: Question[];
  /** Password-protected questionnaires of this person that the viewer has not unlocked. */
  locked?: ProtectedSection[];
  /** Clear per-category means of those locked questionnaires. */
  averages?: Record<string, number>;
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

export function CompareRow({
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
  const participants = people.map(participantOf);
  // Same type as the totals: built-in for defaults, Complementare if any definition says so.
  const type = typeAmong(question.id, participants);
  const compatDetail = multiCompatDetail(question.id, participants, type);
  const compat = compatDetail?.score ?? null;
  const criticalBy = rows.filter((r) => r.answer?.critical).map((r) => r.person);
  // Same rule as the profile: critical questions use the percentage colour, not the theme.
  const criticalColor = compat !== null ? percentColor(compat) : "var(--color-muted-foreground)";
  const reciprocal = type === "reciprocal";
  const needsMyAnswer = !mine.answer?.answered;
  const allAnswered = rows.every((r) => r.answer?.answered);
  const noneAnswered = rows.every((r) => !r.answer?.answered);

  const goToMine = () => {
    if (!known) ensureQuestion(question.id, question.text, type);
    void navigate({
      to: isEroticQuestionId(question.id) ? "/erotismo" : "/",
      search: { focus: question.id },
    });
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
              color: compat === null ? "var(--color-muted-foreground)" : percentColor(compat),
            }}
          >
            {formatCompat(compatDetail)}
            <MarginText result={compatDetail} />
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

/**
 * Comparison drawers for a list of categories, with the global expand/collapse pill.
 * Questions hidden by any participant (individually or by category) are left out.
 */
export function CompareCategories({
  categories,
  allQuestions,
  people,
  defaultOpen,
  reveal,
  section,
}: {
  categories: { key: string; label: string }[];
  /** Questionnaire shown here (Generale or Erotismo): decides which passwords are asked. */
  section: ProtectedSection;
  allQuestions: Question[];
  people: Person[];
  defaultOpen: boolean;
  /** Category to open and scroll to (e.g. a tapped chart bar); `n` changes on every request. */
  reveal?: { key: string; n: number } | null;
}) {
  const { questions } = useStore();
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const participants: Participant[] = people.map(participantOf);
  const visibleTo = (q: Question) => visibleToAll(q, people);
  // Each protected participant is handled on their own: the others stay readable.
  const lockedPeople = people.filter((p) => !p.mine && p.locked?.includes(section));
  const readable = people.filter((p) => p.mine || !p.locked?.includes(section));
  const readableParticipants = readable.map(participantOf);

  useEffect(() => {
    if (!reveal) return;
    setOpenCats((cur) => ({ ...cur, [reveal.key]: true }));
    // Wait for the drawer to render open before scrolling its header into view.
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-category="${reveal.key}"]`);
      if (!el) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      el.classList.remove("compat-flash");
      void el.offsetWidth;
      el.classList.add("compat-flash");
    });
    return () => cancelAnimationFrame(id);
  }, [reveal]);
  const shown = categories
    .map((cat) => ({
      cat,
      items: allQuestions
        .filter((q) => q.category === cat.key && visibleTo(q))
        .map((q, i) => ({ q, i, c: multiCompat(q.id, readableParticipants) }))
        .sort((x, y) => {
          if (x.c === null && y.c === null) return x.i - y.i;
          if (x.c === null) return 1;
          if (y.c === null) return -1;
          return y.c - x.c || x.i - y.i;
        })
        .map((x) => x.q),
    }))
    .filter((x) => x.items.length > 0);
  const isOpen = (key: string) => openCats[key] ?? defaultOpen;

  return (
    <>
      <ExpandAllPill
        openStates={shown.map((x) => isOpen(x.cat.key))}
        onSet={(open) => setOpenCats(Object.fromEntries(shown.map((x) => [x.cat.key, open])))}
      />
      {lockedPeople.map((p) => (
        <PasswordUnlockCard key={p.handle} handle={p.handle} name={p.name} section={section} />
      ))}
      {shown.length === 0 && (
        <p className="section-card text-[14px] text-muted-foreground">
          Nessuna domanda da confrontare qui.
        </p>
      )}
      {shown.map(({ cat, items }) => {
        const catDetail = averageCompatDetail(
          items.map((q) => q.id),
          participants,
        );
        const open = isOpen(cat.key);
        return (
          <section
            key={cat.key}
            className="scroll-mt-20 rounded-3xl bg-surface-2/60 p-2"
            data-category={cat.key}
            onAnimationEnd={(e) => e.currentTarget.classList.remove("compat-flash")}
          >
            <CategoryHeader
              label={cat.label}
              open={open}
              onToggle={() =>
                setOpenCats((cur) => ({ ...cur, [cat.key]: !(cur[cat.key] ?? defaultOpen) }))
              }
              right={
                <span
                  className="text-[14px] font-bold"
                  style={{
                    color: catDetail
                      ? percentColor(catDetail.score)
                      : "var(--color-muted-foreground)",
                  }}
                >
                  {formatCompat(catDetail)}
                  <MarginText result={catDetail} />
                </span>
              }
            />
            {open && (
              <div className="space-y-2">
                {readable.length < 2 ? (
                  <p className="px-2 pb-2 text-[12px] text-muted-foreground">
                    Le risposte di {lockedPeople.map((p) => p.name).join(" e ")} sono protette da
                    password
                    {lockedPeople.some((p) => p.averages?.[cat.key] !== undefined)
                      ? ": la percentuale è una stima dalle medie della categoria."
                      : " e in questa categoria non c’è ancora una media da confrontare."}
                  </p>
                ) : (
                  items.map((q) => (
                    <CompareRow
                      key={q.id}
                      question={q}
                      people={readable}
                      known={questions.some((x) => x.id === q.id)}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
