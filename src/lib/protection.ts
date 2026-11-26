// Two-compartment password protection of a profile (Generale / Erotismo).
// The owner always sees everything; what leaves the device for a protected section is only the
// per-category means of the owner's answers (in clear) plus an AES-GCM box with that section's
// answers, comments and custom questions. Passwords never leave this module's callers' device.

import {
  decryptJson,
  deriveKey,
  encryptJson,
  newSalt,
  openWithPassword,
  type ProtectedBox,
} from "./password-crypto";
import {
  PROTECTED_SECTIONS,
  resolveQuestionType,
  sanitizeCustomQuestions,
  sectionOfCategory,
  sectionOfQuestionId,
  type ProtectedSection,
  type Question,
  type QuestionDefinition,
} from "./questions";
import {
  giveOf,
  receiveOf,
  sanitizeAnswers,
  type Answer,
  type CategoryAggregate,
  type CategoryAverages,
  type OwnerProtection,
  type OwnerSecret,
  type ProfileSnapshot,
} from "./types";

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

/** Italian error text for an invalid new password, or null when it can be used. */
export function passwordProblem(password: string): string | null {
  if (password.trim().length < MIN_PASSWORD_LENGTH)
    return `Usa almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Usa al massimo ${MAX_PASSWORD_LENGTH} caratteri.`;
  return null;
}

/** What one protected compartment contains once opened. */
export type SectionPayload = {
  answers: Record<string, Answer>;
  customQuestions: Question[];
};

const AVERAGES = { main: "mainAverages", erotic: "eroticAverages" } as const;
const BOX = { main: "mainProtected", erotic: "eroticProtected" } as const;

export function boxOf(snap: Partial<ProfileSnapshot> | undefined, section: ProtectedSection) {
  return snap?.[BOX[section]];
}

export function averagesOf(snap: Partial<ProfileSnapshot> | undefined, section: ProtectedSection) {
  return snap?.[AVERAGES[section]];
}

const inSection = (q: Pick<Question, "id" | "category">, section: ProtectedSection) =>
  sectionOfCategory(q.category) === section && sectionOfQuestionId(q.id) === section;

/** Answers and custom questions of one section. */
export function sectionPayload(
  answers: Record<string, Answer>,
  customQuestions: Question[],
  section: ProtectedSection,
): SectionPayload {
  return {
    answers: Object.fromEntries(
      Object.entries(answers).filter(([id]) => sectionOfQuestionId(id) === section),
    ),
    customQuestions: customQuestions.filter((q) => inSection(q, section)),
  };
}

/** Everything except one section's answers and custom questions. */
function withoutSection(
  answers: Record<string, Answer>,
  customQuestions: Question[],
  section: ProtectedSection,
) {
  return {
    answers: Object.fromEntries(
      Object.entries(answers).filter(([id]) => sectionOfQuestionId(id) !== section),
    ),
    customQuestions: customQuestions.filter((q) => sectionOfCategory(q.category) !== section),
  };
}

const roundedMean = (values: number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const nullableMean = (values: number[]) => (values.length ? roundedMean(values) : null);

/**
 * Aggregate statistics of one section: answered, visible questions only. The overall `mean`
 * keeps its legacy definition; role means and dispersion let contacts estimate the real maths
 * without receiving any single answer, comment, critical flag or custom-question definition.
 */
export function categoryAverages(
  answers: Record<string, Answer>,
  questions: (QuestionDefinition & { category: string })[],
  hiddenCategories: string[] = [],
  section: ProtectedSection,
): Record<string, CategoryAggregate> {
  const groups = new Map<
    string,
    { values: number[]; similarity: number[]; give: number[]; receive: number[]; votes: number[] }
  >();
  for (const q of questions) {
    if (sectionOfCategory(q.category) !== section || hiddenCategories.includes(q.category))
      continue;
    const a = answers[q.id];
    if (!a?.answered || a.hidden) continue;
    const cur = groups.get(q.category) ?? {
      values: [],
      similarity: [],
      give: [],
      receive: [],
      votes: [],
    };
    groups.set(q.category, cur);
    cur.values.push(a.value);
    if (resolveQuestionType(q.id, questions) === "reciprocal") {
      const give = giveOf(a);
      const receive = receiveOf(a);
      if (give !== undefined) {
        cur.give.push(give);
        cur.votes.push(give);
      }
      if (receive !== undefined) {
        cur.receive.push(receive);
        cur.votes.push(receive);
      }
    } else {
      cur.similarity.push(a.value);
      cur.votes.push(a.value);
    }
  }
  return Object.fromEntries(
    [...groups.entries()].map(([category, group]) => {
      const mean = group.votes.reduce((sum, value) => sum + value, 0) / group.votes.length;
      const variance =
        group.votes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / group.votes.length;
      return [
        category,
        {
          mean: roundedMean(group.values),
          simMean: nullableMean(group.similarity),
          giveMean: nullableMean(group.give),
          recvMean: nullableMean(group.receive),
          stdDev: Math.round(Math.sqrt(variance)),
        } satisfies CategoryAggregate,
      ];
    }),
  );
}

/** Next keyVersion of a section: never reused, even after a removal. */
export function nextKeyVersion(p: OwnerProtection, section: ProtectedSection): number {
  return Math.max(p.lastVersion?.[section] ?? 0, p[section]?.keyVersion ?? 0) + 1;
}

/** Sets or changes a section's password: new salt and a new keyVersion every time. */
export function withPassword(
  p: OwnerProtection,
  section: ProtectedSection,
  password: string,
): OwnerProtection {
  const keyVersion = nextKeyVersion(p, section);
  return {
    ...p,
    [section]: { password, salt: newSalt(), keyVersion },
    lastVersion: { ...p.lastVersion, [section]: keyVersion },
  };
}

/** Removes a section's password; its data travels in clear again. */
export function withoutPassword(p: OwnerProtection, section: ProtectedSection): OwnerProtection {
  const next: OwnerProtection = { ...p };
  delete next[section];
  return next;
}

// The owner's derived keys, cached in memory per salt+version so snapshots encrypt quickly.
const ownerKeys = new Map<string, { password: string; key: Promise<CryptoKey> }>();

function ownerKey(secret: OwnerSecret): Promise<CryptoKey> {
  const id = `${secret.keyVersion}|${secret.salt}`;
  const hit = ownerKeys.get(id);
  if (hit && hit.password === secret.password) return hit.key;
  const key = deriveKey(secret.password, secret.salt);
  ownerKeys.set(id, { password: secret.password, key });
  key.catch(() => ownerKeys.delete(id));
  return key;
}

/**
 * The shareable snapshot with each password-protected section moved into its encrypted box.
 * `questions`: the owner's question list (defaults + own custom), used for the clear means.
 */
export async function protectSnapshot(
  base: ProfileSnapshot,
  protection: OwnerProtection,
  questions: (QuestionDefinition & { category: string })[],
): Promise<ProfileSnapshot> {
  let snap: ProfileSnapshot = { ...base };
  for (const section of PROTECTED_SECTIONS) {
    const secret = protection[section];
    if (!secret) continue;
    const payload = sectionPayload(base.answers, base.customQuestions, section);
    const box = await encryptJson(await ownerKey(secret), secret.salt, secret.keyVersion, payload);
    snap = {
      ...snap,
      ...withoutSection(snap.answers, snap.customQuestions, section),
      [AVERAGES[section]]: categoryAverages(
        base.answers,
        questions,
        base.hiddenCategories,
        section,
      ),
      [BOX[section]]: box,
    };
  }
  return snap;
}

/** Only valid answers and custom questions of the box's own section are accepted. */
export function sanitizeSectionPayload(raw: unknown, section: ProtectedSection): SectionPayload {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof SectionPayload, unknown>
  >;
  return sectionPayload(
    sanitizeAnswers(r.answers),
    sanitizeCustomQuestions(r.customQuestions),
    section,
  );
}

/** Opens a box with an already derived key (throws WrongPasswordError). */
export async function openSection(
  key: CryptoKey,
  box: ProtectedBox,
  section: ProtectedSection,
): Promise<SectionPayload> {
  return sanitizeSectionPayload(await decryptJson(key, box), section);
}

/** Opens a box with a password (throws WrongPasswordError); returns the key for reuse. */
export async function openSectionWithPassword(
  password: string,
  box: ProtectedBox,
  section: ProtectedSection,
): Promise<{ key: CryptoKey; payload: SectionPayload }> {
  const { key, value } = await openWithPassword(password, box);
  return { key, payload: sanitizeSectionPayload(value, section) };
}

/** Wait before the next attempt after N consecutive wrong passwords: 0s, 1s, 2s, then 5s. */
export const ATTEMPT_DELAYS_S = [0, 1, 2, 5] as const;

export function attemptDelaySeconds(failures: number): number {
  return ATTEMPT_DELAYS_S[Math.min(Math.max(0, failures), ATTEMPT_DELAYS_S.length - 1)]!;
}

/** Opened compartments of one contact (kept in memory only). */
export type UnlockedSections = Partial<Record<ProtectedSection, SectionPayload>>;

/** A contact as the comparison sees it: clear data + opened boxes; locked sections → means. */
export type ResolvedProfile = {
  answers: Record<string, Answer>;
  customQuestions: Question[];
  hiddenCategories: string[];
  /** Sections still protected for this viewer. */
  locked: ProtectedSection[];
  /** Clear per-category aggregates of the locked sections (scalar means in old snapshots). */
  averages: CategoryAverages;
};

export function resolveSnapshot(
  snap: ProfileSnapshot | undefined,
  unlocked: UnlockedSections = {},
): ResolvedProfile {
  let answers: Record<string, Answer> = { ...(snap?.answers ?? {}) };
  let customQuestions: Question[] = [...(snap?.customQuestions ?? [])];
  const locked: ProtectedSection[] = [];
  let averages: CategoryAverages = {};
  for (const section of PROTECTED_SECTIONS) {
    if (!boxOf(snap, section)) continue;
    // A protected section never mixes with clear data of the same section.
    const rest = withoutSection(answers, customQuestions, section);
    answers = rest.answers;
    customQuestions = rest.customQuestions;
    const open = unlocked[section];
    if (open) {
      answers = { ...answers, ...open.answers };
      customQuestions = [
        ...customQuestions,
        ...open.customQuestions.filter((q) => !customQuestions.some((x) => x.id === q.id)),
      ];
    } else {
      locked.push(section);
      averages = { ...averages, ...(averagesOf(snap, section) ?? {}) };
    }
  }
  return {
    answers,
    customQuestions,
    hiddenCategories: snap?.hiddenCategories ?? [],
    locked,
    averages,
  };
}

/** The protected-section fields of a snapshot or backup, copied only when present. */
export function protectedFieldsOf(src: Partial<ProfileSnapshot>): Partial<ProfileSnapshot> {
  return {
    ...(src.mainProtected
      ? { mainAverages: src.mainAverages ?? {}, mainProtected: src.mainProtected }
      : {}),
    ...(src.eroticProtected
      ? { eroticAverages: src.eroticAverages ?? {}, eroticProtected: src.eroticProtected }
      : {}),
  };
}

/** Sections of a snapshot or backup that travel encrypted. */
export function protectedSectionsOf(src: Partial<ProfileSnapshot>): ProtectedSection[] {
  return PROTECTED_SECTIONS.filter((s) => Boolean(boxOf(src, s)));
}

/** The encrypted boxes of a snapshot or backup, by section. */
export function boxesOf(
  src: Partial<ProfileSnapshot>,
): Partial<Record<ProtectedSection, ProtectedBox>> {
  const out: Partial<Record<ProtectedSection, ProtectedBox>> = {};
  for (const s of PROTECTED_SECTIONS) {
    const box = boxOf(src, s);
    if (box) out[s] = box;
  }
  return out;
}
