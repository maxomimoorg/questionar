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
    "Baciarsi",
    "Affettuosità in pubblico",
    "Attenzione all'igiene personale",
    r("Massaggi"),
    "Uso di preservativo o altre protezioni",
    "Test periodici IST",
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
 *   { key: "XA", label: "…" } in EROTISMO_CATEGORIES and XA: ["…", r("…")] in EROTISMO_DEFAULTS.
 */
export type EroticCategoryKey = `X${string}`;
export type AnyCategoryKey = CategoryKey | EroticCategoryKey;

export const EROTISMO_LABEL = "Erotismo";

export const EROTISMO_CATEGORIES: { key: EroticCategoryKey; label: string }[] = [
  { key: "XA", label: "Vanilla" },
  { key: "XB", label: "Bondage e Disciplina" },
  { key: "XC", label: "Dominazione e Sottomissione" },
  { key: "XD", label: "Sadismo e Masochismo" },
  { key: "XE", label: "Feticismo" },
  { key: "XF", label: "Altre dinamiche" },
];

const EROTISMO_DEFAULTS: Record<EroticCategoryKey, DefaultEntry[]> = {
  XA: [
    r("Massaggi sensuali"),
    moved("D-penetrazionegenitale", r("Penetrazione genitale")),
    moved("D-raggiungerelorgasmo", "Raggiungere l'orgasmo"),
    moved("D-sessoorale", r("Sesso orale")),
    moved("D-petting", r("Petting e strusciamenti")),
    moved("D-masturbazionereciproca", r("Masturbazione")),
    moved("D-usodigiocattolisessuali", "Uso di giocattoli sessuali"),
    moved("D-penetrazioneconoggetti", r("Penetrazione con oggetti")),
  ],
  XB: [
    r("Shibari"),
    r("Mummificazione"),
    r("Sospensione"),
    "Formalità",
    r("Routine"),
    r("Punizioni correttive"),
  ],
  XC: [
    r("Servizio e compiti"),
    r("Negazione/Privazione"),
    r("Silenziamento"),
    "Dinamica 24/7",
    r("Proprietà personale"),
    r("Adorazione"),
    r("Dominazione finanziaria"),
    r("Umiliazione"),
  ],
  XD: [
    r("Impact"),
    r("Temperatura"),
    r("Aghi"),
    r("Lame"),
    r("Iperstimolazione"),
    r("Privazione sensoriale"),
    r("Solletico"),
    r("Tortura"),
  ],
  XE: [
    r("Adorazione di parti del corpo"),
    "Pene",
    "Vulva",
    "Ano",
    "Mani",
    "Seno",
    "Bocca",
    "Sperma",
    "Squirt",
    "Saliva",
    "Sangue",
    "Piedi",
    "Ascelle",
    "Peli",
    "Sudore",
    "Urina",
    "Feci",
    "Odori",
    "Sapori",
    "Materiali specifici",
    "Oggetti specifici",
    "Luoghi specifici",
  ],
  XF: [
    "Esibizionismo",
    "Voyeurismo",
    "Scambismo",
    moved("D-sessoa3opiu", "Sesso a 3 o più"),
    moved("D-chemsexsessoconsostanze", "Chem-sex (sesso con sostanze)"),
  ],
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

const DEFAULT_IDS = new Set(DEFAULT_QUESTIONS.map((q) => q.id));

export function isDefaultQuestionId(id: string): boolean {
  return DEFAULT_IDS.has(id);
}

/** Only these two values are valid question types; anything else is treated as missing. */
export function isQuestionType(v: unknown): v is QuestionType {
  return v === "similarity" || v === "reciprocal";
}

/**
 * Comparison mode of a default question id. Custom and unknown ids are "similarity" here: a
 * custom question's own type is resolved with resolveQuestionType / isReciprocal.
 */
export function questionType(id: string): QuestionType {
  return RECIPROCAL_IDS.has(id) ? "reciprocal" : "similarity";
}

/** A custom question definition as far as its comparison mode is concerned. */
export type QuestionDefinition = Pick<Question, "id"> & { type?: unknown };

/**
 * Comparison mode of any question id. Default questions always keep their built-in type, whatever
 * a definition says. A custom question is "reciprocal" (Complementare) when any of the given
 * definitions with that id says so — twin questions created by different people share the id —
 * and "similarity" (Normale) otherwise, including definitions saved before types existed.
 */
export function resolveQuestionType(
  id: string,
  definitions: Iterable<QuestionDefinition> = [],
): QuestionType {
  if (DEFAULT_IDS.has(id)) return questionType(id);
  for (const d of definitions) if (d.id === id && d.type === "reciprocal") return "reciprocal";
  return "similarity";
}

/** True for Fare/Ricevere questions: built-in reciprocal ones and custom Complementare ones. */
export function isReciprocal(q: QuestionDefinition): boolean {
  return resolveQuestionType(q.id, [q]) === "reciprocal";
}

/** Labels shown when creating a custom question. */
export const CUSTOM_TYPE_LABELS: Record<QuestionType, string> = {
  similarity: "Normale",
  reciprocal: "Complementare",
};

/**
 * Keeps only well-formed custom question definitions (IndexedDB, snapshots, P2P, PNG backups).
 * Ids stay exactly as saved (category + text); a missing or invalid type becomes "similarity",
 * so data from older versions loads as Normale without errors. Ids of default questions and
 * duplicates are dropped: defaults are never redefined by a custom entry.
 */
export function sanitizeCustomQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const q = item as { id?: unknown; text?: unknown; category?: unknown; type?: unknown };
    if (typeof q.id !== "string" || q.id.length === 0 || q.id.length > 400) continue;
    if (typeof q.text !== "string" || q.text.trim().length === 0) continue;
    if (DEFAULT_IDS.has(q.id) || seen.has(q.id)) continue;
    const fromId = categoryOfId(q.id);
    const category =
      typeof q.category === "string" && /^[A-Za-z0-9_]{1,24}$/.test(q.category)
        ? q.category
        : fromId;
    seen.add(q.id);
    out.push({
      id: q.id,
      category: category as AnyCategoryKey,
      text: q.text,
      custom: true,
      type: q.type === "reciprocal" ? "reciprocal" : "similarity",
    });
  }
  return out;
}
