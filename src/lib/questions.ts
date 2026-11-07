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

export function questionId(category: CategoryKey, text: string) {
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
type DefaultEntry = string | { text: string; legacy?: string; reciprocal?: true };

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
    "Chem-sex (sesso con sostanze)",
    "Raggiungere l'orgasmo",
    "Baciarsi",
    r("Sesso orale"),
    r("Petting"),
    r("Masturbazione", "Masturbazione reciproca"),
    r("Penetrazione con oggetti"),
    r("Penetrazione genitale"),
    "Uso di giocattoli sessuali",
    "Uso di preservativo o altre protezioni",
    "Test periodici IST",
    r("Gioco kinky (fetish/BDSM)"),
    "Sesso a 3 o più",
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

export type Question = {
  id: string;
  category: CategoryKey;
  text: string;
  custom: boolean;
  /** Missing means "similarity". */
  type?: QuestionType;
};

export const DEFAULT_QUESTIONS: Question[] = CATEGORIES.flatMap((cat) =>
  DEFAULTS[cat.key].map((entry) => {
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
