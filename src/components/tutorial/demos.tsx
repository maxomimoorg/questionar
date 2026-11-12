import {
  ArrowRight,
  AtSign,
  Bold,
  Cloud,
  Clock,
  Eye,
  EyeOff,
  FileImage,
  Heading,
  Inbox,
  Italic,
  KeyRound,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Palette,
  Plus,
  QrCode,
  Send,
  Smartphone,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AnswerSlider } from "@/components/AnswerSlider";
import { Avatar } from "@/components/Avatar";
import { CategoryHeader, ExpandAllPill, PasswordPill } from "@/components/CategoryControls";
import { MarginText } from "@/components/MarginText";
import { ProfileTagChip } from "@/components/ProfileTags";
import { percentColor } from "@/lib/color";
import { questionCompat, reciprocalFlows } from "@/lib/compat";
import { nextTagState, PROFILE_TAGS, type ProfileTags } from "@/lib/profile-tags";
import {
  EROTISMO_CATEGORY_LABELS,
  TUTORIAL_CUSTOM_CATEGORY,
  TUTORIAL_LIST_CATEGORIES,
  TUTORIAL_MAP_CATEGORIES,
  TUTORIAL_PASSWORD_DEMO,
  TUTORIAL_QUESTIONS,
  categoryLabel,
  categoryQuestionCount,
  type TutorialQuestionKey,
} from "./examples";
import { useDemoCycle, useReducedMotion } from "./hooks";
import { Stage } from "./kit";

/* All demos reuse the app's real components and maths, so what the tutorial shows is what
 * the app does. Nothing here reads or writes the saved profile. */

const pct = (value: number | null | undefined) => (value == null ? "–" : `${value}%`);

function Percent({ value, className = "" }: { value: number | null; className?: string }) {
  return (
    <b
      className={`tabular-nums ${className}`}
      style={{ color: value === null ? "var(--color-muted-foreground)" : percentColor(value) }}
    >
      {pct(value)}
    </b>
  );
}

/** A real question of the app with its category, as the questionnaire shows it. */
function QuestionLabel({ example }: { example: TutorialQuestionKey }) {
  const ref = TUTORIAL_QUESTIONS[example];
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {categoryLabel(ref.category)}
      </p>
      <p className="text-[14px] leading-snug">{ref.text}</p>
    </div>
  );
}

/** Eases 0 → 1 once over `ms`; immediately 1 with reduced motion. */
function useProgress(ms = 1400) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (reduced) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setProgress(1 - Math.pow(1 - k, 3));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, ms]);
  return progress;
}

/* ───────────── 1 · Cos'è ───────────── */

const MAP_VALUES = [92, 64, 38];
const MAP = TUTORIAL_MAP_CATEGORIES.map((key, i) => ({
  label: categoryLabel(key),
  value: MAP_VALUES[i] ?? 50,
}));

export function DemoCompatMap() {
  const p = useProgress();
  const total = Math.round((MAP.reduce((s, c) => s + c.value, 0) / MAP.length) * p);
  return (
    <Stage hint="guarda">
      <div className="flex items-center gap-4">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${percentColor(total)} ${total * 3.6}deg, var(--color-muted) 0)`,
          }}
        >
          <div className="grid size-15 place-items-center rounded-full bg-background">
            <Percent value={total} className="text-[18px]" />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {MAP.map((c) => {
            const v = Math.round(c.value * p);
            return (
              <div key={c.label} className="text-[12px]">
                <div className="flex justify-between">
                  <span className="truncate">{c.label}</span>
                  <Percent value={v} />
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${v}%`, backgroundColor: percentColor(v) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

/* ───────────── 2 · Rispondere ───────────── */

const SLIDER_STEPS = [10, 50, 90, 30, 72];

export function DemoSlider() {
  const cycle = useDemoCycle(SLIDER_STEPS.length, 1500);
  const [value, setValue] = useState<number | null>(null);
  const autoplay = cycle.playing && value === null;
  return (
    <Stage hint="trascina" className={autoplay ? "demo-autoplay" : ""}>
      <QuestionLabel example="slider" />
      <div className="mt-1" onPointerDownCapture={cycle.stop} onKeyDownCapture={cycle.stop}>
        <AnswerSlider value={value ?? SLIDER_STEPS[cycle.index]!} answered onCommit={setValue} />
      </div>
      <div className="mt-1 flex justify-between pr-14 text-[12px] text-muted-foreground">
        <span>No · 0%</span>
        <span>Forse</span>
        <span>Sì · 100%</span>
      </div>
    </Stage>
  );
}

export function DemoComment() {
  return (
    <Stage hint="guarda">
      <QuestionLabel example="comment" />
      <div className="mt-2 flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <MessageSquare size={15} />
        </span>
        <p className="demo-type overflow-hidden whitespace-nowrap text-[14px] italic text-muted-foreground">
          Sì, ma con i propri spazi…
        </p>
      </div>
    </Stage>
  );
}

export function DemoCritical() {
  const [critical, setCritical] = useState(false);
  const me = 80;
  const other = 40;
  const score = questionCompat(me, other, critical ? 1 : 0);
  return (
    <Stage hint="tocca">
      <div
        className={`rounded-xl p-2 transition-colors ${critical ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <QuestionLabel example="critical" />
          </div>
          <button
            type="button"
            aria-pressed={critical}
            aria-label="Segna come critica"
            onClick={() => setCritical((v) => !v)}
            className={`grid size-8 place-items-center rounded-full ${
              critical
                ? "bg-accent text-accent-foreground"
                : "demo-critical bg-background text-muted-foreground"
            }`}
          >
            <Zap size={15} />
          </button>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Io {me}% · Luna {other}% →{" "}
          <span data-testid="demo-critical-score">
            <Percent value={score} />
          </span>
          {critical && <span className="ml-1 font-semibold text-accent">distanza amplificata</span>}
        </p>
      </div>
    </Stage>
  );
}

function MiniBar({ label, value }: { label?: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {label && <span className="w-14 shrink-0 text-muted-foreground">{label}</span>}
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: percentColor(value) }}
        />
      </div>
    </div>
  );
}

export function DemoCustomQuestion() {
  const cycle = useDemoCycle(2, 2400);
  const complementary = cycle.index === 1;
  return (
    <Stage hint="tocca">
      <div className="flex items-start gap-2">
        <span className="demo-pop grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Plus size={16} />
        </span>
        <div className="min-w-0 flex-1 space-y-2 rounded-xl bg-surface p-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {categoryLabel(TUTORIAL_CUSTOM_CATEGORY)} · Personalizzata
            </p>
            <p className="text-[14px] leading-snug">Ballare insieme</p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Tipo di domanda">
            {["Normale", "Complementare"].map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={cycle.index === i}
                onClick={() => cycle.select(i)}
                className={`rounded-full px-2.5 py-0.5 text-[12px] ${
                  cycle.index === i
                    ? "bg-accent text-accent-foreground"
                    : "bg-surface-2 text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {complementary ? (
            <div className="space-y-1">
              <MiniBar label="Fare" value={80} />
              <MiniBar label="Ricevere" value={55} />
            </div>
          ) : (
            <MiniBar value={70} />
          )}
        </div>
      </div>
    </Stage>
  );
}

const BIO_TITLE = "Curiosə e sincerə";
const BIO_BODY = " · amo i libri usati e le passeggiate senza meta.";

export function DemoBio() {
  const total = BIO_TITLE.length + BIO_BODY.length;
  const reduced = useReducedMotion();
  const cycle = useDemoCycle(total + 25, 80);
  const typed = reduced ? total : Math.min(cycle.index, total);
  const title = BIO_TITLE.slice(0, typed);
  const body = BIO_BODY.slice(0, Math.max(0, typed - BIO_TITLE.length));
  return (
    <Stage hint="guarda">
      <div className="flex items-center gap-1 text-muted-foreground" aria-hidden="true">
        {[Heading, Bold, Italic, Link2, Palette].map((Icon, i) => (
          <span key={i} className="grid size-7 place-items-center rounded-lg bg-surface">
            <Icon size={13} />
          </span>
        ))}
        <span className="ml-auto text-[11px] tabular-nums">{typed}/666</span>
      </div>
      <p className="mt-2 min-h-[2.75rem] text-[14px]">
        <span className="font-display font-bold text-brand">{title}</span>
        <span>{body}</span>
        <span className="demo-caret" aria-hidden="true" />
      </p>
    </Stage>
  );
}

/* ───────────── 3 · Somiglianza e reciprocità ───────────── */

export function DemoSimilarity() {
  const [me, setMe] = useState(80);
  const [other, setOther] = useState(35);
  const score = questionCompat(me, other, 0);
  return (
    <Stage hint="trascina">
      <QuestionLabel example="similarity" />
      <div className="mt-1 space-y-1">
        <AnswerSlider label="Io" value={me} answered onCommit={setMe} />
        <AnswerSlider label="Luna" value={other} answered onCommit={setOther} />
      </div>
      <p className="mt-1 text-[14px]" data-testid="demo-similarity-score">
        Compatibilità: <Percent value={score} />
      </p>
    </Stage>
  );
}

type DemoAnswer = { value: number; answered: true; giveValue?: number; receiveValue?: number };

const RECIPROCAL_SCENARIOS: { label: string; me: DemoAnswer; other: DemoAnswer }[] = [
  {
    label: "Vi completate",
    me: { value: 55, answered: true, giveValue: 90, receiveValue: 20 },
    other: { value: 55, answered: true, giveValue: 20, receiveValue: 90 },
  },
  {
    label: "Entrambi solo fare",
    me: { value: 50, answered: true, giveValue: 100, receiveValue: 0 },
    other: { value: 50, answered: true, giveValue: 100, receiveValue: 0 },
  },
  {
    label: "Risposta a metà",
    me: { value: 80, answered: true, giveValue: 80 },
    other: { value: 45, answered: true, giveValue: 20, receiveValue: 70 },
  },
];

/** Uses the real reciprocal maths so the tutorial shows the same numbers as the comparison. */
export function DemoReciprocal() {
  const cycle = useDemoCycle(RECIPROCAL_SCENARIOS.length, 3200);
  const scenario = RECIPROCAL_SCENARIOS[cycle.index]!;
  const flows = reciprocalFlows(scenario.me, scenario.other, 0);
  const person = (name: string, a: DemoAnswer) => (
    <div className="space-y-1">
      <p className="text-[12px] font-semibold">{name}</p>
      <MiniBar label="Fare" value={a.giveValue ?? 0} />
      {a.receiveValue === undefined ? (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="w-14 shrink-0 text-muted-foreground">Ricevere</span>
          <span className="text-muted-foreground">non risposto</span>
        </div>
      ) : (
        <MiniBar label="Ricevere" value={a.receiveValue} />
      )}
    </div>
  );
  return (
    <Stage hint="tocca">
      <QuestionLabel example="reciprocal" />
      <div className="my-2 flex flex-wrap gap-1.5" role="group" aria-label="Esempi di reciprocità">
        {RECIPROCAL_SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={i === cycle.index}
            onClick={() => cycle.select(i)}
            className={`rounded-full px-2.5 py-0.5 text-[12px] ${
              i === cycle.index
                ? "bg-accent text-accent-foreground"
                : "bg-surface-2 text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {person("Io", scenario.me)}
        {person("Luna", scenario.other)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
        <p className="rounded-lg bg-surface px-2 py-1">
          Io ➔ Luna <Percent value={flows.aToB} />
        </p>
        <p className="rounded-lg bg-surface px-2 py-1">
          Luna ➔ io <Percent value={flows.bToA} />
        </p>
      </div>
      <p className="mt-2 text-[14px]">
        Compatibilità:{" "}
        <span data-testid="demo-reciprocal-score">
          <Percent value={flows.score} />
        </span>
        <MarginText result={flows} />
      </p>
    </Stage>
  );
}

/* ───────────── 4 · Connettersi e confrontare ───────────── */

const CONNECT_MODES = [
  {
    id: "qr",
    label: "QR",
    icon: QrCode,
    caption: "Dal vivo: scansiona il QR sullo schermo dell'altra persona.",
  },
  {
    id: "handle",
    label: "Handle",
    icon: AtSign,
    caption: "A distanza: invia il suo handle completo, emoji incluse.",
  },
  {
    id: "file",
    label: "Scheda",
    icon: FileImage,
    caption: "Offline: scambiate la scheda avatar e confrontate subito.",
  },
] as const;

export function DemoConnect() {
  const cycle = useDemoCycle(CONNECT_MODES.length, 2800);
  const mode = CONNECT_MODES[cycle.index]!;
  return (
    <Stage hint="tocca">
      <div className="flex gap-1.5" role="group" aria-label="Modi per connettersi">
        {CONNECT_MODES.map((m, i) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={i === cycle.index}
              onClick={() => cycle.select(i)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-[12px] ${
                i === cycle.index
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-2 text-foreground"
              }`}
            >
              <Icon size={13} /> {m.label}
            </button>
          );
        })}
      </div>
      <div key={mode.id} className="demo-enter mt-3 grid h-20 place-items-center">
        {mode.id === "qr" && (
          <div className="relative overflow-hidden rounded-xl bg-surface p-2 text-foreground">
            <QrCode size={56} strokeWidth={1.5} />
            <span className="demo-scan" aria-hidden="true" />
          </div>
        )}
        {mode.id === "handle" && (
          <div className="flex items-center gap-2">
            <span className="demo-type overflow-hidden whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-[14px] text-accent">
              @luna🦊🌙⭐
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Send size={14} />
            </span>
          </div>
        )}
        {mode.id === "file" && (
          <div className="flex items-center gap-3">
            <div className="demo-slide flex items-center gap-2 rounded-xl bg-surface p-2 pr-3">
              <Avatar handle="luna" size={36} />
              <span className="text-[12px]">luna.png</span>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
            <Percent value={78} className="text-[18px]" />
          </div>
        )}
      </div>
      <p className="mt-1 text-center text-[12px] text-muted-foreground">{mode.caption}</p>
    </Stage>
  );
}

export function DemoOfflineRequest() {
  return (
    <Stage hint="guarda">
      <div className="flex items-center gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-accent">
          <Mail size={18} />
        </span>
        <div className="relative h-6 flex-1">
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-border" />
          <span className="demo-travel absolute top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground">
            <Lock size={11} />
          </span>
        </div>
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface text-accent">
          <Inbox size={18} />
          <span className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
            <Clock size={9} /> 72 h
          </span>
        </span>
      </div>
      <p className="mt-2 text-center text-[12px] text-muted-foreground">Rubrica → Richieste</p>
    </Stage>
  );
}

export function DemoThreeWay() {
  return (
    <Stage hint="guarda">
      <div className="relative mx-auto h-36 max-w-xs">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g
            className="demo-dash"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="2"
            strokeDasharray="5 5"
          >
            <line x1="100" y1="22" x2="30" y2="98" />
            <line x1="100" y1="22" x2="170" y2="98" />
            <line x1="30" y1="98" x2="170" y2="98" />
          </g>
        </svg>
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <Avatar handle="io" size={40} />
        </div>
        <div className="absolute bottom-0 left-[5%]">
          <Avatar handle="luna" size={40} />
        </div>
        <div className="absolute bottom-0 right-[5%]">
          <Avatar handle="sole" size={40} />
        </div>
        <span className="absolute left-[18%] top-[38%] text-[12px]">
          <Percent value={82} />
        </span>
        <span className="absolute right-[18%] top-[38%] text-[12px]">
          <Percent value={64} />
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[12px]">
          <Percent value={71} />
        </span>
        <span className="demo-pop absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-2 py-0.5 text-[12px]">
          Insieme <Percent value={72} />
        </span>
      </div>
    </Stage>
  );
}

/* ───────────── 5 · I tuoi spazi ───────────── */

const DEMO_TAG_IDS = ["vegan", "tabacco", "queer", "animali"];

export function DemoProfileTags() {
  const [tags, setTags] = useState<ProfileTags>({ vegan: true, tabacco: "cross" });
  return (
    <Stage hint="tocca">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Prova i tag del profilo">
        {PROFILE_TAGS.filter((tag) => DEMO_TAG_IDS.includes(tag.id)).map((tag) => (
          <ProfileTagChip
            key={tag.id}
            tag={tag}
            value={tags[tag.id]}
            onClick={() =>
              setTags((current) => ({ ...current, [tag.id]: nextTagState(current[tag.id]) }))
            }
          />
        ))}
      </div>
    </Stage>
  );
}

export function DemoHidden() {
  const cycle = useDemoCycle(2, 2200);
  const hidden = cycle.index === 1;
  return (
    <Stage hint="tocca">
      <div
        className={`flex items-center gap-2 rounded-xl bg-surface p-2 transition ${hidden ? "opacity-50 grayscale" : ""}`}
      >
        <div className="flex-1">
          <QuestionLabel example="hidden" />
        </div>
        {hidden && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
            fuori dal calcolo
          </span>
        )}
        <button
          type="button"
          aria-label={hidden ? "Ripristina la domanda" : "Nascondi la domanda"}
          onClick={() => cycle.select(hidden ? 0 : 1)}
          className="grid size-8 place-items-center rounded-full bg-background text-muted-foreground"
        >
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </Stage>
  );
}

// Real categories with their real question counts; the first one shows the completed state.
const DEMO_CATEGORIES = TUTORIAL_LIST_CATEGORIES.map((key, i) => {
  const total = categoryQuestionCount(key);
  return { label: categoryLabel(key), total, done: i === 0 ? total : Math.min(total, 3 + i) };
});

export function DemoCategories() {
  const [open, setOpen] = useState<boolean[]>([false, false, false]);
  const [hidden, setHidden] = useState<boolean[]>([false, false, false]);
  const visible = DEMO_CATEGORIES.map((c, i) => ({ ...c, i })).filter((c) => !hidden[c.i]);
  const hiddenOnes = DEMO_CATEGORIES.filter((_, i) => hidden[i]);
  return (
    <Stage hint="tocca">
      <ExpandAllPill
        openStates={visible.map((c) => open[c.i]!)}
        onSet={(value) => setOpen(open.map(() => value))}
      />
      <div className="mt-1 space-y-1">
        {visible.map((c) => (
          <div key={c.label} className="rounded-xl bg-surface">
            <CategoryHeader
              label={c.label}
              open={open[c.i]!}
              onToggle={() => setOpen(open.map((v, j) => (j === c.i ? !v : v)))}
              right={c.done === c.total ? `${c.total} ✓` : `${c.done}/${c.total}`}
              hidden={false}
              onToggleHidden={() => setHidden(hidden.map((v, j) => (j === c.i ? true : v)))}
            />
            {open[c.i] && (
              <div className="demo-enter space-y-1.5 px-3 pb-3" aria-hidden="true">
                <div className="h-2 w-3/4 rounded-full bg-muted" />
                <div className="h-2 w-1/2 rounded-full bg-muted" />
              </div>
            )}
          </div>
        ))}
      </div>
      {hiddenOnes.length > 0 && (
        <div className="demo-enter mt-2 rounded-xl border border-dashed border-border p-2">
          <p className="text-[12px] font-semibold text-muted-foreground">
            Categorie e domande nascoste
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {hiddenOnes.map((c) => (
              <button
                key={c.label}
                type="button"
                aria-label={`Ripristina la categoria ${c.label}`}
                onClick={() => {
                  const i = DEMO_CATEGORIES.indexOf(c);
                  setHidden(hidden.map((v, j) => (j === i ? false : v)));
                }}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-foreground"
              >
                <EyeOff size={12} /> {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Stage>
  );
}

export function DemoFavorite() {
  const [favorite, setFavorite] = useState(false);
  return (
    <Stage hint="tocca">
      <div className="flex items-center gap-3">
        <Avatar handle="luna" size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">Luna</p>
          <p className="text-[12px] text-muted-foreground">
            {favorite ? "Tra i preferiti · solo su questo dispositivo" : "Contatto"}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          onClick={() => setFavorite((v) => !v)}
          className={`grid size-9 place-items-center rounded-full ${
            favorite ? "bg-accent text-accent-foreground" : "demo-critical bg-surface-2 text-accent"
          }`}
        >
          <Star size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </Stage>
  );
}

export function DemoErotismo() {
  const [open, setOpen] = useState(false);
  return (
    <Stage hint="tocca">
      <div className="flex justify-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          Erotismo {open ? <X size={13} /> : <ArrowRight size={13} />}
        </button>
      </div>
      {open && (
        <ul
          className="demo-enter mt-2 flex flex-wrap justify-center gap-1.5"
          aria-label="Categorie di Erotismo"
        >
          {EROTISMO_CATEGORY_LABELS.map((label) => (
            <li
              key={label}
              className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px]"
            >
              <Lock size={11} className="text-muted-foreground" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
    </Stage>
  );
}

/* ───────────── 6 · I tuoi dati ───────────── */

export function DemoZeroServer() {
  return (
    <Stage hint="guarda">
      <div className="flex items-center justify-around gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="relative grid size-14 place-items-center rounded-2xl bg-surface text-accent">
            <Smartphone size={26} />
            <span className="demo-pulse absolute right-2 top-2 size-2 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] text-muted-foreground">il tuo browser (IndexedDB)</span>
        </div>
        <div className="relative h-0 max-w-24 flex-1 border-t-2 border-dashed border-border">
          <X
            size={16}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background text-destructive"
          />
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface text-muted-foreground">
            <Cloud size={26} />
          </span>
          <span className="text-[11px] text-muted-foreground">nessun server</span>
        </div>
      </div>
    </Stage>
  );
}

/**
 * Password protection: the category mean (real maths, 100 − gap of the two clear means) is
 * always visible; the single answer stays encrypted until the example password is entered.
 */
export function DemoPasswordProtection() {
  const demo = TUTORIAL_PASSWORD_DEMO;
  const ref = TUTORIAL_QUESTIONS[demo.question];
  const [active, setActive] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const categoryScore = questionCompat(demo.averages.mine, demo.averages.theirs, 0);
  const questionScore = questionCompat(demo.answers.mine, demo.answers.theirs, 0);
  const locked = active && !unlocked;
  return (
    <Stage hint="tocca">
      <div className="space-y-2">
        <div className="flex justify-end">
          <PasswordPill
            active={active}
            onClick={() => {
              setActive((a) => !a);
              setUnlocked(false);
            }}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[13px]">
          <span className="font-semibold text-brand">{categoryLabel(ref.category)}</span>
          <span data-testid="demo-password-category">
            {active && !unlocked ? "≈" : ""}
            <Percent value={active && !unlocked ? categoryScore : questionScore} />
          </span>
        </div>
        <div className="rounded-xl bg-surface px-3 py-2" data-testid="demo-password-question">
          <p className="text-[13px] leading-snug">{ref.text}</p>
          {locked ? (
            <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock size={12} aria-hidden="true" /> risposte cifrate
              </span>
              <button
                type="button"
                onClick={() => setUnlocked(true)}
                className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
              >
                <KeyRound size={12} aria-hidden="true" /> Sblocca con «{demo.password}»
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[12px]">
              io <Percent value={demo.answers.mine} /> · Luna{" "}
              <Percent value={demo.answers.theirs} /> · <Percent value={questionScore} />
            </p>
          )}
        </div>
      </div>
    </Stage>
  );
}

export function DemoBackupCard() {
  return (
    <Stage hint="guarda">
      <div className="relative mx-auto flex max-w-60 items-center gap-3 overflow-hidden rounded-2xl bg-surface p-3">
        <Avatar handle="luna" size={44} />
        <div className="min-w-0">
          <p className="font-display text-[14px] font-bold text-brand">Luna</p>
          <p className="truncate text-[12px] text-accent">@luna🦊🌙⭐</p>
        </div>
        <span className="demo-pixels" aria-hidden="true" />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        risposte e chiave pubblica nascoste nei pixel
      </p>
    </Stage>
  );
}

const HANDLE_EMOJI = ["🦊", "🌙", "⭐"];
const COLLECTED = ["🐼", "🌻", "🐙", "🍓", "🦉", "🌈", "🐢", "🍀", "🦄"];

export function DemoEmojiCollection() {
  const reduced = useReducedMotion();
  const cycle = useDemoCycle(COLLECTED.length + 4, 650);
  const count = reduced ? COLLECTED.length : Math.min(cycle.index, COLLECTED.length);
  return (
    <Stage hint="guarda">
      <div className="mx-auto grid max-w-xs grid-cols-6 gap-1.5">
        {HANDLE_EMOJI.map((e) => (
          <span
            key={e}
            className="grid aspect-square place-items-center rounded-xl bg-surface text-[18px] ring-2 ring-primary"
          >
            {e}
          </span>
        ))}
        {COLLECTED.map((e, i) => (
          <span
            key={e}
            className={`grid aspect-square place-items-center rounded-xl text-[18px] ${
              i < count ? "demo-enter bg-surface" : "border border-dashed border-border"
            }`}
          >
            {i < count ? e : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        3 del tuo handle + {count} raccolte
      </p>
    </Stage>
  );
}
