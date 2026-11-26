// Collaudo del trio canonico Io/Luna/Sole (src/test/fixtures/trio.ts) con la matematica reale
// dei confronti. Tutti i valori attesi sono scritti a mano: se cambia una formula o una risposta
// del trio, questi test devono fallire.
import { describe, expect, it } from "vitest";

import {
  averageCompatDetail,
  formatCompat,
  multiCompatDetail,
  typeAmong,
  type AverageResult,
  type Participant,
} from "@/lib/compat";
import { categoryBreakdown } from "@/lib/compat-map";
import { comparisonQuestions, participantOf } from "@/lib/compare-people";
import {
  passwordProblem,
  openSectionWithPassword,
  resolveSnapshot,
  boxOf,
  type UnlockedSections,
} from "@/lib/protection";
import { WrongPasswordError } from "@/lib/password-crypto";
import { ALL_CATEGORIES, DEFAULT_QUESTIONS, PROTECTED_SECTIONS, questionId } from "@/lib/questions";
import { sanitizeSnapshot, type CategoryAverages, type Question } from "@/lib/types";
import {
  TRIO_NAMES,
  TRIO_PASSWORDS,
  q,
  trioParticipant,
  trioProfile,
  trioSnapshot,
  type TrioName,
} from "./fixtures/trio";

// ---- helpers --------------------------------------------------------------------------------

type Cell = string;
type Key = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
type Table = Record<Key | "XA" | "XB" | "XC" | "XD" | "XE" | "XF" | "TOT", Cell>;
const fmt = (d: AverageResult | null): Cell =>
  d ? `${formatCompat(d)}${d.margin > 0 ? ` ±${d.margin}` : ""}` : "–";

/** One comparison as the app computes it: Io's own questions + the others' custom ones. */
function table(viewer: TrioName, people: Participant[]): Table {
  const own: Question[] = [...DEFAULT_QUESTIONS, ...trioProfile(viewer).customQuestions];
  const others = people.slice(1).flatMap((p) => (p.customQuestions ?? []) as Question[]);
  const questions = comparisonQuestions(own, others);
  const out = {} as Record<string, Cell>;
  for (const c of ALL_CATEGORIES) out[c.key] = "nasc.";
  for (const bar of categoryBreakdown(ALL_CATEGORIES, questions, people))
    out[bar.key] = fmt(bar.detail);
  const visible = questions.filter((x) =>
    people.every(
      (p) => !p.answers[x.id]?.hidden && !(p.hiddenCategories ?? []).includes(x.category),
    ),
  );
  out["TOT"] = fmt(
    averageCompatDetail(
      visible.map((x) => x.id),
      people,
    ),
  );
  return out as Table;
}

const clear = (...names: TrioName[]) =>
  table(
    names[0]!,
    names.map((n) => trioParticipant(n)),
  );

/** A contact as Io's device sees it: received (sanitised) snapshot, optionally unlocked. */
async function received(name: "luna" | "sole", unlock = false): Promise<Participant> {
  const snap = sanitizeSnapshot(await trioSnapshot(name));
  const unlocked: UnlockedSections = {};
  if (unlock) {
    for (const s of PROTECTED_SECTIONS) {
      const box = boxOf(snap, s);
      const pw = (TRIO_PASSWORDS[name] as Partial<Record<string, string>>)[s];
      if (box && pw) unlocked[s] = (await openSectionWithPassword(pw, box, s)).payload;
    }
  }
  const view = resolveSnapshot(snap, unlocked);
  return participantOf({ handle: name, name, mine: false, ...view });
}

const only = (t: Table, keys: (keyof Table)[]) => Object.fromEntries(keys.map((k) => [k, t[k]]));
const legacyMeans = (averages: CategoryAverages | undefined) =>
  Object.fromEntries(
    Object.entries(averages ?? {}).map(([category, value]) => [
      category,
      typeof value === "number" ? value : value.mean,
    ]),
  );

// ---- the profiles themselves ------------------------------------------------------------------

describe("trio: i profili", () => {
  it("usa solo domande esistenti e password valide", () => {
    expect(() => q("A", "Domanda che non esiste")).toThrow(/inesistente/);
    for (const name of TRIO_NAMES) {
      for (const pw of Object.values(TRIO_PASSWORDS[name])) expect(passwordProblem(pw)).toBeNull();
    }
  });

  it("protegge sezioni diverse: Io e Sole l'Erotismo, Luna il Generale", async () => {
    const io = sanitizeSnapshot(await trioSnapshot("io"));
    const luna = sanitizeSnapshot(await trioSnapshot("luna"));
    const sole = sanitizeSnapshot(await trioSnapshot("sole"));
    expect([Boolean(io.mainProtected), Boolean(io.eroticProtected)]).toEqual([false, true]);
    expect([Boolean(luna.mainProtected), Boolean(luna.eroticProtected)]).toEqual([true, false]);
    expect([Boolean(sole.mainProtected), Boolean(sole.eroticProtected)]).toEqual([false, true]);
  });

  it("ha tag diversi per ogni persona, conservati alla ricezione", async () => {
    const active = async (n: TrioName) => {
      const tags = sanitizeSnapshot(await trioSnapshot(n)).tags ?? {};
      return Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== false));
    };
    expect(await active("io")).toEqual({
      vegan: true,
      animali: true,
      alcol: "cross",
      "non-monogamia": true,
    });
    expect(await active("luna")).toEqual({
      vegan: true,
      sport: true,
      queer: true,
      tabacco: "cross",
    });
    expect(await active("sole")).toEqual({
      tabacco: true,
      alcol: true,
      prole: "cross",
      spirituale: true,
    });
  });

  it("ripulisce la bio ostile di Luna quando arriva", async () => {
    const bio = sanitizeSnapshot(await trioSnapshot("luna")).bio;
    expect(bio).toBe("<p>Ciao, sono <i>Luna</i></p>");
  });

  it("non manda mai le password, né in chiaro né nei box", async () => {
    for (const name of TRIO_NAMES) {
      const json = JSON.stringify(await trioSnapshot(name));
      for (const pw of Object.values(TRIO_PASSWORDS[name])) expect(json).not.toContain(pw);
    }
  });
});

// ---- clear comparisons (every section readable) --------------------------------------------

describe("trio: confronti senza password", () => {
  it("Io–Luna", () => {
    expect(clear("io", "luna")).toEqual({
      A: "109%",
      B: "74%",
      C: "107%",
      D: "102% ±8",
      E: "47%",
      F: "–",
      G: "nasc.",
      H: "100%",
      I: "95% ±13",
      J: "80%",
      XA: "110%",
      XB: "97% ±17",
      XC: "–",
      XD: "-20%",
      XE: "–",
      XF: "9%",
      TOT: "74% ±2",
    });
  });

  it("Io–Sole", () => {
    expect(clear("io", "sole")).toEqual({
      A: "109%",
      B: "64%",
      C: "-13%",
      D: "47%",
      E: "–",
      F: "–",
      G: "90%",
      H: "–",
      I: "38%",
      J: "–",
      XA: "nasc.",
      XB: "–",
      XC: "–",
      XD: "-16%",
      XE: "–",
      XF: "46%",
      TOT: "50%",
    });
  });

  it("Luna–Sole", () => {
    expect(clear("luna", "sole")).toEqual({
      A: "109%",
      B: "69%",
      C: "-7%",
      D: "60% ±8",
      E: "–",
      F: "–",
      G: "nasc.",
      H: "–",
      I: "65%",
      J: "–",
      XA: "nasc.",
      XB: "–",
      XC: "–",
      XD: "106%",
      XE: "–",
      XF: "70%",
      TOT: "75% ±1",
    });
  });

  it("a tre", () => {
    expect(clear("io", "luna", "sole")).toEqual({
      A: "114%",
      B: "71%",
      C: "27%",
      D: "70% ±6",
      E: "–",
      F: "–",
      G: "nasc.",
      H: "–",
      I: "65%",
      J: "–",
      XA: "nasc.",
      XB: "–",
      XC: "–",
      XD: "22%",
      XE: "–",
      XF: "42%",
      TOT: "66% ±1",
    });
  });

  it("supera il 100%: Impegno 109% a due e 114% a tre, Vanilla 110%", () => {
    expect(clear("io", "luna").A).toBe("109%");
    expect(clear("io", "luna", "sole").A).toBe("114%");
    expect(clear("io", "luna").XA).toBe("110%");
  });

  it("scende sotto lo 0%: Sadismo e Masochismo -20% (Io–Luna) e -16% (Io–Sole)", () => {
    expect(clear("io", "luna").XD).toBe("-20%");
    expect(clear("io", "sole").XD).toBe("-16%");
  });

  it("Autonomia va oltre in entrambe le direzioni: 107% con Luna, -13% con Sole", () => {
    expect(clear("io", "luna").C).toBe("107%");
    expect(clear("io", "sole").C).toBe("-13%");
  });
});

// ---- the critical-question grids ------------------------------------------------------------

const score = (id: string, names: TrioName[]) =>
  multiCompatDetail(
    id,
    names.map((n) => trioParticipant(n)),
  )?.score ?? null;

describe("trio: matrici delle domande critiche", () => {
  it("a due (Comunicazione, Io–Luna): 0/1/2 critiche × pieno/parziale/nullo", () => {
    const e = (text: string) => score(q("E", text), ["io", "luna"]);
    expect([e("Sentirsi tutti i giorni o quasi"), e("Messaggi in chat"), e("Telefonate")]).toEqual([
      100, 50, 0,
    ]);
    expect([
      e("Videochiamate"),
      e("Parlare di passioni ludiche e culturali"),
      e("Parlare di rapporti con altre persone"),
    ]).toEqual([110, 25, -25]);
    expect([
      e("Parlare di politica e attualità"),
      e("Parlare dei propri sentimenti"),
      e("Onestà e comunicazione non violenta"),
    ]).toEqual([120, 20, -30]);
  });

  it("a tre, nessuna critica: pieno 100, parziale 63, nullo 33", () => {
    const t = ["io", "luna", "sole"] as TrioName[];
    expect(score(q("B", "Vedersi con una certa frequenza"), t)).toBe(100);
    expect(score(q("XF", "Esibizionismo"), t)).toBe(63);
    expect(score(q("XF", "Voyeurismo"), t)).toBe(33);
  });

  it("a tre, una critica: pieno 110, parziale 53, nullo 20", () => {
    const t = ["io", "luna", "sole"] as TrioName[];
    expect(score(q("B", "Fare delle uscite serali"), t)).toBe(110);
    expect(score(q("B", "Farsi a lungo i grattini come anti-stress"), t)).toBe(53);
    expect(score(q("B", "Nerdare insieme con film, serie e videogiochi"), t)).toBe(20);
  });

  it("a tre, due critiche: pieno 120, parziale 53, nullo 20", () => {
    const t = ["io", "luna", "sole"] as TrioName[];
    expect(score(q("B", "Passare la notte insieme"), t)).toBe(120);
    expect(score(q("XF", "Scambismo"), t)).toBe(53);
    expect(score(q("XF", "Sesso a 3 o più"), t)).toBe(20);
  });

  it("a tre, tre critiche: pieno 130, parziale 53, nullo 17", () => {
    const t = ["io", "luna", "sole"] as TrioName[];
    expect(score(q("B", "Partecipare ad attività condivise"), t)).toBe(130);
    expect(score(q("B", "Programmare delle vacanze di coppia"), t)).toBe(53);
    expect(score(q("B", "Sincronizzare i reciproci calendari"), t)).toBe(17);
  });
});

// ---- other cases ----------------------------------------------------------------------------

describe("trio: altri casi", () => {
  it("Fare/Ricevere a metà: stima con margine d'errore", () => {
    const io = trioParticipant("io");
    const luna = trioParticipant("luna");
    // Luna risponde solo a Ricevere: Io dà 90 vs Luna riceve 70 = 80; Luna→Io sconosciuto (0–100),
    // quindi il vero punteggio sta fra (80+0)/2 = 40 e (80+100)/2 = 90 → margine 40.
    expect(multiCompatDetail(q("D", "Coccole e gesti fisici di affetto"), [io, luna])).toEqual({
      score: 80,
      partial: true,
      margin: 40,
    });
    // Io risponde solo a Fare: Io→Luna 60 vs 60 = 100, Luna→Io sconosciuto.
    expect(multiCompatDetail(q("I", "Regali costosi"), [io, luna])).toEqual({
      score: 100,
      partial: true,
      margin: 50,
    });
  });

  it("laboratorio: un solo flusso calcolabile (Io solo Fare, Luna solo Ricevere)", () => {
    const r = multiCompatDetail(q("XB", "Mummificazione"), [
      trioParticipant("io"),
      trioParticipant("luna"),
    ]);
    expect(r).toEqual({ score: 100, partial: true, margin: 50 });
  });

  it("domanda nascosta da Sole: esclusa a tre, contata tra Io e Luna", () => {
    const id = q("B", "Aiutarsi a mantenere uno stile di vita sano");
    expect(score(id, ["io", "luna", "sole"])).toBeNull();
    expect(score(id, ["io", "luna"])).toBe(100);
  });

  it("categorie nascoste: niente Integrazione sociale con Luna, niente Vanilla con Sole", () => {
    expect(clear("io", "luna").G).toBe("nasc.");
    expect(clear("io", "sole").G).toBe("90%");
    expect(clear("io", "sole").XA).toBe("nasc.");
  });

  it("domanda personalizzata gemella: Normale per Io, Complementare per Luna → Fare/Ricevere 80%", () => {
    const id = questionId("J", "Cucinare insieme");
    const io = trioParticipant("io");
    const luna = trioParticipant("luna");
    expect(typeAmong(id, [io])).toBe("similarity");
    expect(typeAmong(id, [io, luna])).toBe("reciprocal");
    // Io dà 80 vs Luna riceve 40 → 60; Luna dà 80 vs Io riceve 80 → 100.
    expect(multiCompatDetail(id, [io, luna])?.score).toBe(80);
    // La domanda di Sole esiste solo per lei: mai confrontabile.
    expect(clear("io", "sole").J).toBe("–");
  });
});

// ---- views on Io's device: locked, unlocked ---------------------------------------------------

describe("trio: viste sul dispositivo di Io", () => {
  it("Luna con il Generale bloccato: medie per categoria (≈), Erotismo esatto", async () => {
    const t = table("io", [trioParticipant("io"), await received("luna")]);
    expect(t).toEqual({
      A: "≈70% ±19",
      B: "≈61% ±18",
      C: "≈91% ±12",
      D: "≈84% ±12",
      E: "≈48% ±16",
      F: "–",
      G: "nasc.",
      H: "≈100% ±12",
      I: "≈64% ±22",
      J: "≈71% ±12",
      XA: "110%",
      XB: "97% ±17",
      XC: "–",
      XD: "-20%",
      XE: "–",
      XF: "9%",
      TOT: "≈61% ±12",
    });
  });

  it("Sole con l'Erotismo bloccato: Generale esatto, Erotismo stimato", async () => {
    const t = table("io", [trioParticipant("io"), await received("sole")]);
    expect(t).toEqual({
      A: "109%",
      B: "64%",
      C: "-13%",
      D: "47%",
      E: "–",
      F: "–",
      G: "90%",
      H: "–",
      I: "38%",
      J: "–",
      XA: "nasc.",
      XB: "–",
      XC: "–",
      XD: "≈0% ±12",
      XE: "–",
      XF: "≈36% ±25",
      TOT: "≈52% ±4",
    });
  });

  it("sbloccati con la password giusta: identici alla vista senza password", async () => {
    const io = trioParticipant("io");
    const luna = await received("luna", true);
    const sole = await received("sole", true);
    expect(table("io", [io, luna])).toEqual(clear("io", "luna"));
    expect(table("io", [io, sole])).toEqual(clear("io", "sole"));
    expect(table("io", [io, luna, sole])).toEqual(clear("io", "luna", "sole"));
  });

  it("a tre: sbloccare Luna non sblocca Sole", async () => {
    const t = table("io", [
      trioParticipant("io"),
      await received("luna", true),
      await received("sole"),
    ]);
    const full = clear("io", "luna", "sole");
    const main: Key[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    expect(only(t, main)).toEqual(only(full, main));
    expect(t.XD).toBe("≈27% ±8");
    expect(t.XF).toBe("≈31% ±18");
  });

  it("a tre, entrambi bloccati: stime dove rispondono tutti e tre", async () => {
    const t = table("io", [trioParticipant("io"), await received("luna"), await received("sole")]);
    expect(only(t, ["A", "B", "C", "D", "G", "I", "XA", "XD", "XF"])).toEqual({
      A: "≈83% ±13",
      B: "≈61% ±14",
      C: "≈30% ±8",
      D: "≈63% ±10",
      G: "nasc.",
      I: "≈53% ±14",
      XA: "nasc.",
      XD: "≈27% ±8",
      XF: "≈31% ±18",
    });
  });

  it("commenti privati: quello di Luna resta nel box finché non si sblocca", async () => {
    const id = q("H", "Dire \u201cti amo\u201d");
    const sent = await trioSnapshot("luna");
    expect(JSON.stringify(sent)).not.toContain("Commento privato di Luna");
    expect((await received("luna")).answers[id]).toBeUndefined();
    expect((await received("luna", true)).answers[id]?.comment).toBe("Commento privato di Luna");
    // Io non protegge il Generale: il suo commento viaggia con la risposta.
    expect(sanitizeSnapshot(await trioSnapshot("io")).answers[id]?.comment).toBe(
      "Solo quando lo sento davvero",
    );
  });

  it("le medie in chiaro escludono le categorie nascoste e le risposte bloccate", async () => {
    const luna = sanitizeSnapshot(await trioSnapshot("luna"));
    expect(legacyMeans(luna.mainAverages)).toEqual({
      A: 72,
      B: 57,
      C: 93,
      D: 86,
      E: 38,
      H: 70,
      I: 51,
      J: 60,
    });
    expect(luna.mainAverages?.["I"]).toEqual({
      mean: 51,
      simMean: 55,
      giveMean: 25,
      recvMean: 70,
      stdDev: 28,
    });
    expect(Object.keys(luna.answers).every((id) => id.startsWith("X"))).toBe(true);
    expect(luna.customQuestions).toEqual([]);
    expect(legacyMeans(sanitizeSnapshot(await trioSnapshot("io")).eroticAverages)).toEqual({
      XA: 71,
      XB: 53,
      XD: 0,
      XF: 100,
    });
    expect(legacyMeans(sanitizeSnapshot(await trioSnapshot("sole")).eroticAverages)).toEqual({
      XD: 100,
      XF: 50,
    });
  });

  it("i vecchi snapshot con sole medie scalari mantengono il punteggio e guadagnano ±12%", async () => {
    const legacy = sanitizeSnapshot({
      ...(await trioSnapshot("luna")),
      mainAverages: { I: 30 },
    });
    const participant = participantOf({
      handle: "luna",
      name: "luna",
      mine: false,
      ...resolveSnapshot(legacy),
    });
    const ids = DEFAULT_QUESTIONS.filter((question) => question.category === "I").map(
      (question) => question.id,
    );
    // Media complessiva di Io in Finanze: 50; vecchio fallback: 100 − |50 − 30| = 80.
    expect(averageCompatDetail(ids, [trioParticipant("io"), participant])).toMatchObject({
      score: 80,
      margin: 12,
      estimated: true,
    });
    expect(legacy.mainAverages).toEqual({ I: 30 });
  });

  it("la password di un'altra persona non apre il box", async () => {
    const box = sanitizeSnapshot(await trioSnapshot("luna")).mainProtected!;
    await expect(
      openSectionWithPassword(TRIO_PASSWORDS.sole.erotic, box, "main"),
    ).rejects.toBeInstanceOf(WrongPasswordError);
  });
});
