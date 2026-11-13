// Trio di collaudo canonico: Io (profilo proprietario), Luna e Sole (profili di confronto).
//
// Tre profili completi (bio, tag, risposte, commenti, domande personalizzate, categorie nascoste,
// password) pensati per coprire in un colpo solo la varietà di casi delle funzioni di confronto.
// I test di flussi complessi partono da qui invece di inventare profili temporanei; i casi nuovi
// si aggiungono nella sezione LABORATORIO in fondo, così restano disponibili per gli sviluppi
// successivi. Ogni testo di domanda è cercato in src/lib/questions.ts: se una domanda cambia,
// il trio fallisce subito invece di confrontare id inesistenti.
//
// Mappa dei casi: punteggi per categoria senza password (vista del proprietario), calcolati con
// la matematica reale e verificati in src/test/trio.test.ts. "–" = categoria mostrata senza
// punteggio (nessuna domanda risposta da tutti), "nasc." = categoria nascosta da qualcuno
// (nessuna barra né cassetto). "±N" = margine d'errore di una risposta Fare/Ricevere parziale.
//
//   Categoria               | Ruolo                                           | Io–Luna | Io–Sole | Luna–Sole | Trio
//   A Impegno per stabilità | affine oltre misura (critiche condivise)        |   109   |   109   |    109    |  114
//   B Tempo di qualità      | matrice critiche a tre (0/1/2/3 profili)        |    74   |    64   |     69    |   71
//   C Autonomia             | stessa categoria: oltre misura vs rottura       |   107   |   -13   |     -7    |   27
//   D Intimità fisica       | reciproca parziale + critiche, Io salta 2       |  102 ±8 |    47   |   60 ±8   | 70 ±6
//   E Comunicazione         | matrice critiche a due (0/1/2 × pieno/parz./nullo) | 47   |    –    |     –     |   –
//   F Linguaggi d'amore     | senza risposte                                  |    –    |    –    |     –     |   –
//   G Integrazione sociale  | nascosta da Luna                                |  nasc.  |    90   |   nasc.   | nasc.
//   H Intimità emotiva      | commenti privati                                |   100   |    –    |     –     |   –
//   I Finanze               | Fare/Ricevere incrociato, Io parziale           | 95 ±13  |    38   |     65    |   65
//   J Altro                 | domanda personalizzata Normale/Complementare    |    80   |    –    |     –     |   –
//   XA Vanilla              | Erotismo affine oltre misura, nascosta da Sole  |   110   |  nasc.  |   nasc.   | nasc.
//   XB Bondage e Disciplina | reciproche, parziale dal laboratorio            | 97 ±17  |    –    |     –     |   –
//   XD Sadismo e Masochismo | Erotismo incompatibile oltre misura             |   -20   |   -16   |    106    |   22
//   XF Altre dinamiche      | laboratorio: completa la matrice critiche a tre |     9   |    46   |     70    |   42
//   XC, XE                  | senza risposte                                  |    –    |    –    |     –     |   –
//   Totale                  |                                                 |  74 ±2  |    50   |   75 ±1   | 66 ±1
//
// Matrice critiche a tre (domanda per domanda, trio): 0 critiche pieno/parziale/nullo = B
// "Vedersi…", XF "Esibizionismo", XF "Voyeurismo"; 1 = B "Fare delle uscite serali", "Farsi a
// lungo i grattini…", "Nerdare insieme…"; 2 = B "Passare la notte insieme", XF "Scambismo",
// XF "Sesso a 3 o più"; 3 = B "Partecipare…", "Programmare delle vacanze…", "Sincronizzare…".
// Nota: XA e XD sono domande Fare/Ricevere risposte con un solo valore (formato delle versioni
// precedenti): il calcolo incrociato coincide con il confronto diretto.
//
// Password: Io protegge l'Erotismo, Luna il Generale, Sole l'Erotismo (vedi TRIO_PASSWORDS).
// I valori attesi esatti sono scritti a mano nei test (src/test/trio.test.ts), non ricalcolati.

import { buildSnapshot } from "@/lib/store";
import { protectSnapshot, withPassword } from "@/lib/protection";
import {
  DEFAULT_QUESTIONS,
  questionId,
  type AnyCategoryKey,
  type ProtectedSection,
  type Question,
} from "@/lib/questions";
import type { Participant } from "@/lib/compat";
import type { ProfileTags } from "@/lib/profile-tags";
import {
  EMPTY_STATE,
  handleOf,
  reciprocalValue,
  type Answer,
  type AppState,
  type Contact,
  type Identity,
  type ProfileSnapshot,
} from "@/lib/types";

export type TrioName = "io" | "luna" | "sole";
export const TRIO_NAMES: readonly TrioName[] = ["io", "luna", "sole"];

export type TrioProfile = {
  identity: Identity;
  bio: string;
  tags: ProfileTags;
  answers: Record<string, Answer>;
  hiddenCategories: string[];
  customQuestions: Question[];
  /** Sections this person protects with a password when sending their snapshot. */
  passwords: Partial<Record<ProtectedSection, string>>;
};

export const TRIO_PASSWORDS = {
  io: { erotic: "io-eros-segreto" },
  luna: { main: "luna-generale" },
  sole: { erotic: "sole-eros" },
} as const satisfies Record<TrioName, Partial<Record<ProtectedSection, string>>>;

/** Id of a default question, looked up by its exact text so the trio follows questions.ts. */
export function q(category: AnyCategoryKey, text: string): string {
  const found = DEFAULT_QUESTIONS.find((x) => x.category === category && x.text === text);
  if (!found) throw new Error(`Trio: domanda inesistente in ${category}: "${text}"`);
  return found.id;
}

// ---- answer helpers -------------------------------------------------------------------------

type Extra = Partial<Pick<Answer, "comment" | "hidden">>;

/** Single-slider answer. */
const ans = (value: number, extra: Extra = {}): Answer => ({ value, answered: true, ...extra });
/** Single-slider answer flagged as critical. */
const crit = (value: number, extra: Extra = {}): Answer => ({
  ...ans(value, extra),
  critical: true,
});
/** Fare/Ricevere answer; leave a side undefined for a partial answer. */
const fare = (
  give: number | undefined,
  receive: number | undefined,
  extra: Extra & { critical?: boolean } = {},
): Answer => ({
  value: reciprocalValue(give, receive),
  answered: true,
  ...(give !== undefined ? { giveValue: give } : {}),
  ...(receive !== undefined ? { receiveValue: receive } : {}),
  ...extra,
});

/** One question answered by up to three people: [id, Io, Luna, Sole]. */
type Row = [
  id: string,
  io?: Answer | undefined,
  luna?: Answer | undefined,
  sole?: Answer | undefined,
];

// ---- custom questions -----------------------------------------------------------------------

const CUSTOM_COOK = questionId("J", "Cucinare insieme");
const CUSTOM_BACKPACK = questionId("J", "Viaggiare zaino in spalla");

const IO_CUSTOM: Question[] = [
  { id: CUSTOM_COOK, category: "J", text: "Cucinare insieme", custom: true, type: "similarity" },
];
/** Same id as Io's: Luna made it Complementare, so the pair compares it as Fare/Ricevere. */
const LUNA_CUSTOM: Question[] = [
  { id: CUSTOM_COOK, category: "J", text: "Cucinare insieme", custom: true, type: "reciprocal" },
];
/** Only Sole has it: never comparable with the others. */
const SOLE_CUSTOM: Question[] = [
  {
    id: CUSTOM_BACKPACK,
    category: "J",
    text: "Viaggiare zaino in spalla",
    custom: true,
    type: "similarity",
  },
];

// ---- the canonical rows ---------------------------------------------------------------------

/** A: same answers for everybody, six questions critical for all three → oltre misura. */
const A_ROWS: Row[] = (
  [
    ["Etichettare la relazione", 90, true],
    ["Fare piani per il futuro", 85, false],
    ["Puntare ad una relazione a lungo termine", 100, true],
    ["Matrimonio", 40, false],
    ["Procreazione", 20, false],
    ["Genitorialità", 30, false],
    ["Cura di animali", 70, false],
    ["Convivenza", 60, false],
    ["Co-proprietà di casa", 50, false],
    ["Impegnarsi a superare le sfide relazionali", 100, true],
    ["Avere potere decisionale paritario", 95, true],
    ["Sostegno reciproco nelle sfide personali", 100, true],
    ["Cercare di accogliere gli errori e perdonarsi", 90, true],
  ] as const
).map(([text, v, c]) => {
  const a = c ? crit(v) : ans(v);
  return [q("A", text), a, a, a];
});

/** B: the critical-question matrix of the three-way comparison. */
const B_ROWS: Row[] = [
  [q("B", "Vedersi con una certa frequenza"), ans(70), ans(70), ans(70)], // 0 critiche, pieno
  [q("B", "Fare delle uscite serali"), crit(70), ans(70), ans(70)], // 1 critica, pieno
  [q("B", "Passare la notte insieme"), crit(90), crit(90), ans(90)], // 2 critiche, pieno
  [q("B", "Partecipare ad attività condivise"), crit(80), crit(80), crit(80)], // 3, pieno
  [q("B", "Programmare delle vacanze di coppia"), crit(100), crit(45), crit(100)], // 3, parziale
  [q("B", "Sincronizzare i reciproci calendari"), crit(100), crit(0), crit(0)], // 3, Io isolato
  [q("B", "Farsi a lungo i grattini come anti-stress"), ans(60), ans(60), crit(5)],
  [
    q("B", "Aiutarsi a mantenere uno stile di vita sano"),
    ans(50),
    ans(50),
    ans(50, { hidden: true }),
  ],
  [
    q("B", "Fare attivismo insieme o comunque supportarsi a livello politico"),
    ans(100),
    ans(0),
    ans(50),
  ],
  [q("B", "Nerdare insieme con film, serie e videogiochi"), ans(100), ans(100), crit(0)],
];

/** C: Luna is aligned with Io beyond measure, Sole is the opposite beyond measure. */
const C_ROWS: Row[] = [
  [q("C", "Equilibrio tra tempo insieme e non"), crit(100), ans(100), crit(0)],
  [q("C", "Trascorrere del tempo con altre persone"), crit(90), ans(85), crit(10)],
  [q("C", "Mantenere delle amicizie indipendenti"), crit(100), ans(100), ans(0)],
  [q("C", "Avere altre relazioni indipendenti"), ans(100), crit(95), crit(0)],
  [q("C", "Evitare squilibri di potere"), ans(80), ans(80), ans(20)],
  [q("C", "Passare del tempo in solitudine"), crit(100), crit(100), crit(0)],
];

/** D: partial Fare/Ricevere from Luna, shared critical questions, two questions Io skipped. */
const D_ROWS: Row[] = [
  [q("D", "Coccole e gesti fisici di affetto"), fare(90, 90), fare(undefined, 70), fare(60, 60)],
  [q("D", "Baciarsi"), ans(100), ans(100), ans(80)],
  [q("D", "Attenzione all'igiene personale"), crit(100), crit(100), crit(100)],
  [q("D", "Uso di preservativo o altre protezioni"), crit(100), ans(100), crit(0)],
  [q("D", "Test periodici IST"), crit(100), ans(95), ans(20)],
  [q("D", "Affettuosità in pubblico"), undefined, ans(60), ans(90)],
  [q("D", "Massaggi"), undefined, fare(80, 80), undefined],
];

/** E: the critical-question matrix of a two-way comparison (Io–Luna). */
const E_ROWS: Row[] = [
  [q("E", "Sentirsi tutti i giorni o quasi"), ans(80), ans(80)], // 0 critiche, pieno → 100
  [q("E", "Messaggi in chat"), ans(80), ans(30)], // 0, parziale → 50
  [q("E", "Telefonate"), ans(100), ans(0)], // 0, nullo → 0
  [q("E", "Videochiamate"), crit(70), ans(70)], // 1, pieno → 110
  [q("E", "Parlare di passioni ludiche e culturali"), crit(90), ans(35)], // 1, parziale → 25
  [q("E", "Parlare di rapporti con altre persone"), ans(100), crit(0)], // 1, nullo → -25
  [q("E", "Parlare di politica e attualità"), crit(60), crit(60)], // 2, pieno → 120
  [q("E", "Parlare dei propri sentimenti"), crit(100), crit(45)], // 2, parziale → 20
  [q("E", "Onestà e comunicazione non violenta"), crit(100), crit(0)], // 2, nullo → -30
  [q("E", "Fare dei check-up della relazione"), ans(50), ans(55)], // 0, quasi pieno → 95
];

/** G: hidden as a whole by Luna; only Io and Sole compare it. */
const G_ROWS: Row[] = [
  [q("G", "Presentarsi le rispettive amicizie"), ans(80), ans(10), ans(60)],
  [q("G", "Incontrare membri della famiglia"), ans(30), ans(100), ans(30)],
];

/** H: one question with private comments (they must never leak while protected). */
const H_ROWS: Row[] = [
  [
    q("H", "Dire \u201cti amo\u201d"),
    ans(70, { comment: "Solo quando lo sento davvero" }),
    ans(70, { comment: "Commento privato di Luna" }),
  ],
];

/** I: crosswise Fare/Ricevere, a partial answer from Io, a critical dealbreaker from Sole. */
const I_ROWS: Row[] = [
  [q("I", "Avere un conto co-intestato"), ans(0), ans(20), crit(100)],
  [q("I", "Contribuire equamente alle spese"), ans(90), ans(90), ans(90)],
  [q("I", "Supporto economico"), fare(80, 20), fare(20, 80), fare(80, 20)],
  [q("I", "Regali costosi"), fare(60, undefined), fare(30, 60)],
];

/** J: twin custom question, Normale for Io and Complementare for Luna. */
const J_ROWS: Row[] = [
  [CUSTOM_COOK, ans(80), fare(80, 40)],
  [CUSTOM_BACKPACK, undefined, undefined, ans(90)],
];

/** XA: shared criticals on four questions → 110; Sole hides the whole category. */
const XA_ROWS: Row[] = (
  [
    ["Massaggi sensuali", 90, true],
    ["Penetrazione genitale", 80, true],
    ["Raggiungere l'orgasmo", 100, true],
    ["Sesso orale", 70, true],
    ["Petting e strusciamenti", 85, false],
    ["Masturbazione", 60, false],
    ["Uso di giocattoli sessuali", 50, false],
    ["Penetrazione con oggetti", 30, false],
  ] as const
).map(([text, v, c]) => {
  const a = c ? crit(v) : ans(v);
  return [q("XA", text), a, a, ans(50)];
});

const XB_ROWS: Row[] = [
  [q("XB", "Shibari"), fare(80, 20), fare(10, 90)],
  [q("XB", "Formalità"), ans(40), ans(40)],
];

/** XD: Io says no, Luna and Sole say yes; criticals push it below zero. */
const XD_ROWS: Row[] = (
  [
    ["Impact", true, true, false],
    ["Temperatura", true, true, false],
    ["Aghi", true, false, false],
    ["Lame", true, false, false],
    ["Iperstimolazione", false, true, false],
    ["Privazione sensoriale", false, true, false],
    ["Solletico", false, false, false],
    ["Tortura", false, false, true],
  ] as const
).map(([text, ic, lc, sc]) => [
  q("XD", text),
  ic ? crit(0) : ans(0),
  lc ? crit(100) : ans(100),
  sc ? crit(100) : ans(100),
]);

// ---- LABORATORIO ----------------------------------------------------------------------------
// Casi aggiunti quando un test ha bisogno di una situazione che il trio non copriva ancora.
// Non toglierli: restano parte del trio per gli sviluppi successivi. Per ogni nuovo caso,
// aggiornare la mappa in cima al file e i valori attesi in src/test/trio.test.ts.

const LAB_ROWS: Row[] = [
  // Reciproca parziale incrociata: Io risponde solo a Fare, Luna solo a Ricevere → un solo flusso.
  [q("XB", "Mummificazione"), fare(70, undefined), fare(undefined, 70)],
  // Completa la matrice delle critiche a tre (B copre 0/1/2/3 solo in parte): domande Normali
  // di Altre dinamiche, ognuna risposta da tutti e tre.
  [q("XF", "Esibizionismo"), ans(100), ans(45), ans(100)], // 0 critiche, parziale
  [q("XF", "Voyeurismo"), ans(100), ans(0), ans(0)], // 0 critiche, nullo (Io isolato)
  [q("XF", "Scambismo"), crit(100), crit(45), ans(100)], // 2 critiche, parziale
  [q("XF", "Sesso a 3 o più"), crit(100), crit(0), ans(0)], // 2 critiche, nullo (Io isolato)
];

const ROWS: Row[] = [
  ...A_ROWS,
  ...B_ROWS,
  ...C_ROWS,
  ...D_ROWS,
  ...E_ROWS,
  ...G_ROWS,
  ...H_ROWS,
  ...I_ROWS,
  ...J_ROWS,
  ...XA_ROWS,
  ...XB_ROWS,
  ...XD_ROWS,
  ...LAB_ROWS,
];

function answersOf(index: 1 | 2 | 3): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const row of ROWS) {
    const a = row[index];
    if (a) out[row[0]] = a;
  }
  return out;
}

// ---- the three profiles ---------------------------------------------------------------------

const BASE: Record<TrioName, TrioProfile> = {
  io: {
    identity: { name: "Io", username: "ioprova", emojis: ["🐙", "🌙", "🔥"], createdAt: 1 },
    bio: '<p>Sono <b>Io</b>, il profilo di prova. <a href="https://example.org">Il mio sito</a></p>',
    tags: { vegan: true, animali: true, alcol: "cross", "non-monogamia": true },
    answers: answersOf(1),
    hiddenCategories: [],
    customQuestions: IO_CUSTOM,
    passwords: TRIO_PASSWORDS.io,
  },
  luna: {
    identity: { name: "Luna", username: "lunaprova", emojis: ["🌙", "🦊", "✨"], createdAt: 2 },
    // Hostile markup on purpose: it must be neutralised whenever Luna's snapshot is received.
    bio: '<p>Ciao, sono <i>Luna</i><img src=x onerror="alert(1)"><script>alert(2)</script></p>',
    tags: { vegan: true, sport: true, queer: true, tabacco: "cross" },
    answers: answersOf(2),
    hiddenCategories: ["G"],
    customQuestions: LUNA_CUSTOM,
    passwords: TRIO_PASSWORDS.luna,
  },
  sole: {
    identity: { name: "Sole", username: "soleprova", emojis: ["🌻", "🐝", "🔆"], createdAt: 3 },
    bio: "Sole, amante dei viaggi e del mare.",
    tags: { tabacco: true, alcol: true, prole: "cross", spirituale: true },
    answers: answersOf(3),
    hiddenCategories: ["XA"],
    customQuestions: SOLE_CUSTOM,
    passwords: TRIO_PASSWORDS.sole,
  },
};

export type TrioPatch = Partial<Omit<TrioProfile, "answers">> & {
  /** Answers to add or replace; `undefined` removes the answer. */
  answers?: Record<string, Answer | undefined>;
};

/** A fresh copy of one profile, optionally varied for a single test without touching the trio. */
export function trioProfile(name: TrioName, patch: TrioPatch = {}): TrioProfile {
  const base = structuredClone(BASE[name]);
  const { answers, ...rest } = patch;
  const merged = { ...base.answers };
  for (const [id, a] of Object.entries(answers ?? {})) {
    if (a) merged[id] = a;
    else delete merged[id];
  }
  return { ...base, ...structuredClone(rest), answers: merged };
}

export const trioHandle = (name: TrioName) => handleOf(BASE[name].identity);

/** The comparison view of a profile with everything readable (its owner's view). */
export function trioParticipant(p: TrioName | TrioProfile): Participant {
  const profile = typeof p === "string" ? trioProfile(p) : p;
  return {
    answers: profile.answers,
    hiddenCategories: profile.hiddenCategories,
    customQuestions: profile.customQuestions,
  };
}

/** The app state of a profile on its own device; `protect: false` drops its passwords. */
export function trioState(
  p: TrioName | TrioProfile,
  { contacts = [], protect = true }: { contacts?: Contact[]; protect?: boolean } = {},
): AppState {
  const profile = typeof p === "string" ? trioProfile(p) : p;
  let protection: AppState["protection"] = {};
  if (protect) {
    for (const [section, pw] of Object.entries(profile.passwords) as [ProtectedSection, string][])
      protection = withPassword(protection, section, pw);
  }
  return {
    ...EMPTY_STATE,
    identity: profile.identity,
    bio: profile.bio,
    tags: { ...EMPTY_STATE.tags, ...profile.tags },
    answers: profile.answers,
    hiddenCategories: profile.hiddenCategories,
    customQuestions: profile.customQuestions,
    contacts,
    protection,
  };
}

const snapshotCache = new Map<string, Promise<ProfileSnapshot>>();

/**
 * The snapshot a profile sends (handle/QR, P2P, PNG), with its sections encrypted unless
 * `protect: false`. Unpatched snapshots are derived once per test file (PBKDF2 is slow).
 */
export async function trioSnapshot(
  p: TrioName | TrioProfile,
  { protect = true }: { protect?: boolean } = {},
): Promise<ProfileSnapshot> {
  const build = () => {
    const state = trioState(p, { protect });
    return protectSnapshot(buildSnapshot(state, 10), state.protection, [
      ...DEFAULT_QUESTIONS,
      ...state.customQuestions,
    ]);
  };
  if (typeof p !== "string") return build();
  const key = `${p}|${protect}`;
  if (!snapshotCache.has(key)) snapshotCache.set(key, build());
  return structuredClone(await snapshotCache.get(key)!);
}

/** An address-book entry holding a received snapshot. */
export function trioContact(name: TrioName, snapshot: ProfileSnapshot): Contact {
  const { identity } = BASE[name];
  return { handle: handleOf(identity), name: identity.name, emojis: identity.emojis, snapshot };
}

/** Io's device with Luna and Sole in the address book (their snapshots as they send them). */
export async function ioWithContacts({
  protect = true,
}: { protect?: boolean } = {}): Promise<AppState> {
  const contacts = [
    trioContact("luna", await trioSnapshot("luna", { protect })),
    trioContact("sole", await trioSnapshot("sole", { protect })),
  ];
  return trioState("io", { contacts });
}
