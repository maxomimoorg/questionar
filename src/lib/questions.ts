// Default questionnaire. Category letters are only used to build question ids.

export type CategoryKey =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "A", label: "Impegno per la stabilità" },
  { key: "B", label: "Tempo di qualità" },
  { key: "C", label: "Autonomia" },
  { key: "D", label: "Intimità fisica" },
  { key: "E", label: "Comunicazione" },
  { key: "F", label: "Linguaggi d'amore" },
  { key: "G", label: "Integrazione sociale" },
  { key: "H", label: "Intimità emotiva" },
  { key: "I", label: "Finanze" },
  { key: "J", label: "Altro" },
];

export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function questionId(category: AnyCategoryKey, text: string) {
  return `${category}-${normalizeText(text)}`;
}

/**
 * How a question is compared:
 * - "similarity": the closer the two answers, the higher the compatibility;
 * - "reciprocal": two sliders (Fare / Ricevere) compared crosswise, what one person likes to
 *   give against what the other likes to receive, and vice versa.
 */
export type QuestionType = "similarity" | "reciprocal";

/**
 * A default question. `legacy` keeps the id of a question whose text was reworded, so answers
 * already saved (and profiles sent by older app versions) keep matching it.
 */
type DefaultEntry =
  | string
  | { text: string; legacy?: string; reciprocal?: true; /** Full id it had in another category. */ from?: string };

/** A question moved from another category: same text/type, old id remapped to the new one. */
const moved = (from: string, entry: DefaultEntry): DefaultEntry =>
  typeof entry === "string" ? { text: entry, from } : { ...entry, from };

const r = (text: string, legacy?: string): DefaultEntry => ({
  text,
  reciprocal: true,
  ...(legacy ? { legacy } : {}),
});

const DEFAULTS: Record<CategoryKey, DefaultEntry[]> = {
  A: [
    "Etichettare la relazione",
    "Fare piani per il futuro",
    "Puntare ad una relazione a lungo termine",
    "Matrimonio",
    "Procreazione",
    "Genitorialità",
    "Cura di animali",
    "Convivenza",
    "Co-proprietà di casa",
    "Impegnarsi a superare le sfide relazionali",
    "Avere potere decisionale paritario",
    "Sostegno reciproco nelle sfide personali",
    "Cercare di accogliere gli errori e perdonarsi",
  ],
  B: [
    "Vedersi con una certa frequenza",
    "Fare delle uscite serali",
    "Passare la notte insieme",
    "Partecipare ad attività condivise",
    "Programmare delle vacanze di coppia",
    "Sincronizzare i reciproci calendari",
    "Farsi a lungo i grattini come anti-stress",
    "Aiutarsi a mantenere uno stile di vita sano",
    "Fare attivismo insieme o comunque supportarsi a livello politico",
    "Nerdare insieme con film, serie e videogiochi",
  ],
  C: [
    "Equilibrio tra tempo insieme e non",
    "Trascorrere del tempo con altre persone",
    "Mantenere delle amicizie indipendenti",
    "Avere altre relazioni indipendenti",
    "Evitare squilibri di potere",
    "Passare del tempo in solitudine",
  ],
  D: [
    r("Coccole e gesti fisici di affetto"),
    "Affettuosità in pubblico",
    "Baciarsi",
    "Uso di preservativo o altre protezioni",
    "Test periodici IST",
    "Attenzione all'igiene personale",
  ],
  E: [
    "Sentirsi tutti i giorni o quasi",
    "Messaggi in chat",
    "Telefonate",
    "Videochiamate",
    "Parlare di passioni ludiche e culturali",
    "Parlare di rapporti con altre persone",
    "Parlare di politica e attualità",
    "Parlare dei propri sentimenti",
    "Onestà e comunicazione non violenta",
    "Fare dei check-up della relazione",
  ],
  F: [
    r("Contatto fisico"),
    r("Parole d'affermazione"),
    r("Regali"),
    r("Atti di servizio"),
    "Tempo di qualità",
    r("Dolcezza, piccole grandi attenzioni, gentilezza"),
    r("Vocali lunghi come audiolibri", "Mandarsi vocali lunghi come audiolibri"),
  ],
  G: [
    "Incontrare meta-partner",
    "Presentarsi le rispettive amicizie",
    "Incontrare membri della famiglia",
    "Uscire con le amicizie acquisite",
    "Presentarsi come coppia",
    "Curare il rapporto con meta-partner",
    "Essere \u201cil +1\u201d ad eventi sociali",
    "Seguirsi sui social",
    "Dichiararsi coppia sui social",
    "Vacanze con la famiglia",
    "Vacanze con meta-partner",
  ],
  H: [
    "Esprimere felicità ed entusiasmo",
    r("Supporto nei momenti difficili", "Offrire supporto nei momenti difficili"),
    r("Condividere vulnerabilità e paure"),
    "Dire \u201cti amo\u201d",
    r("Condividere fantasie sessuali"),
    "Condividere speranze per il futuro",
    "Conoscere i reciproci gusti",
    r("Consigli", "Chiedere consigli"),
    r("Sostegno nel lavoro sulla salute mentale", "Sostenere il lavoro sulla salute mentale"),
    "Esplicitare apertamente i propri confini",
  ],
  I: [
    "Avere un conto co-intestato",
    "Contribuire equamente alle spese",
    r("Supporto economico"),
    r("Regali costosi"),
  ],
  J: [],
};

/**
 * Erotismo: optional separate questionnaire, treated as a special category of the main one
 * (same answers map, same snapshot/backup). Its sub-category keys always start with "X" and
 * never contain "-", so question ids stay `<key>-<text>` like every other question.
 * No content is defined yet: the author will add sub-categories and questions here, e.g.
 *   { key: "XA", label: "…" } in EROTISMO_CATEGORIES and XA: ["…", r("…")] in EROTISMO_DEFAULTS.
 */
export type EroticCategoryKey = `X${string}`;
export type AnyCategoryKey = CategoryKey | EroticCategoryKey;

export const EROTISMO_LABEL = "Erotismo";

export const EROTISMO_CATEGORIES: { key: EroticCategoryKey; label: string }[] = [
  { key: "XA", label: "Vanilla" },
  { key: "XB", label: "BD" },
  { key: "XC", label: "DS" },
  { key: "XD", label: "SM" },
  { key: "XE", label: "Fet" },
];

const EROTISMO_DEFAULTS: Record<EroticCategoryKey, DefaultEntry[]> = {
  XA: [
    moved("D-chemsexsessoconsostanze", "Chem-sex (sesso con sostanze)"),
    moved("D-raggiungerelorgasmo", "Raggiungere l'orgasmo"),
    moved("D-sessoorale", r("Sesso orale")),
    moved("D-petting", r("Petting")),
    moved("D-masturbazionereciproca", r("Masturbazione")),
    moved("D-penetrazioneconoggetti", r("Penetrazione con oggetti")),
    moved("D-penetrazionegenitale", r("Penetrazione genitale")),
    moved("D-usodigiocattolisessuali", "Uso di giocattoli sessuali"),
    moved("D-giocokinkyfetishbdsm", r("Gioco kinky (fetish/BDSM)")),
    moved("D-sessoa3opiu", "Sesso a 3 o più"),
  ],
  XB: [],
  XC: [],
  XD: [],
  XE: [],
};

export function isEroticCategory(key: string): key is EroticCategoryKey {
  return /^X[^-]*$/.test(key);
}

/** Category key encoded in a question id (`A-…`, `XA-…`). */
export function categoryOfId(id: string): string {
  return id.split("-")[0] ?? "";
}

export function isEroticQuestionId(id: string): boolean {
  return isEroticCategory(categoryOfId(id));
}

export const ALL_CATEGORIES: { key: AnyCategoryKey; label: string }[] = [
  ...CATEGORIES,
  ...EROTISMO_CATEGORIES,
];

export type Question = {
  id: string;
  category: AnyCategoryKey;
  text: string;
  custom: boolean;
  /** Missing means "similarity". */
  type?: QuestionType;
};

function buildDefaults(cats: { key: AnyCategoryKey }[], table: Record<string, DefaultEntry[]>) {
  return cats.flatMap((cat) =>
  (table[cat.key] ?? []).map((entry) => {
    const e = typeof entry === "string" ? { text: entry } : entry;
    return {
      id: questionId(cat.key, e.legacy ?? e.text),
      category: cat.key,
      text: e.text,
      custom: false,
      type: e.reciprocal ? ("reciprocal" as const) : ("similarity" as const),
    };
  }),
  );
}

/** Main and Erotismo default questions: one list, so every id is counted once in totals. */
export const DEFAULT_QUESTIONS: Question[] = [
  ...buildDefaults(CATEGORIES, DEFAULTS),
  ...buildDefaults(EROTISMO_CATEGORIES, EROTISMO_DEFAULTS),
];

/** Old id → current id of questions moved between categories (saved answers, older peers). */
export const MOVED_QUESTION_IDS: Record<string, string> = Object.fromEntries(
  [...CATEGORIES, ...EROTISMO_CATEGORIES].flatMap((cat) =>
    (({ ...DEFAULTS, ...EROTISMO_DEFAULTS }) as Record<string, DefaultEntry[]>)[cat.key]?.flatMap((entry) =>
      typeof entry !== "string" && entry.from
        ? [[entry.from, questionId(cat.key, entry.legacy ?? entry.text)]]
        : [],
    ) ?? [],
  ),
);

const RECIPROCAL_IDS = new Set(
  DEFAULT_QUESTIONS.filter((q) => q.type === "reciprocal").map((q) => q.id),
);

/** Comparison mode of a question id. Custom and unknown questions are always "similarity". */
export function questionType(id: string): QuestionType {
  return RECIPROCAL_IDS.has(id) ? "reciprocal" : "similarity";
}

export function isReciprocal(q: Pick<Question, "id">): boolean {
  return questionType(q.id) === "reciprocal";
}
