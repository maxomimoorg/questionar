import type { CategoryKey, ProtectedSection, Question } from "./questions";
import {
  ALL_CATEGORIES,
  MOVED_QUESTION_IDS,
  sanitizeCustomQuestions,
  sectionOfCategory,
} from "./questions";
import { sanitizeBox, type ProtectedBox } from "./password-crypto";
import type { KeyPairJwk } from "./keys";
import type { ProfileTags } from "./profile-tags";

export type Answer = {
  /** Single-slider answer; for reciprocal questions the rounded mean of Fare and Ricevere. */
  value: number;
  answered: boolean;
  comment?: string;
  critical?: boolean;
  hidden?: boolean;
  /** Reciprocal questions only: "Fare" slider, 0–100. */
  giveValue?: number;
  /** Reciprocal questions only: "Ricevere" slider, 0–100. */
  receiveValue?: number;
};

/**
 * "Fare" side of an answer. Answers saved with a single slider (neither side set) use their
 * value for both sides; when only "Ricevere" was answered, "Fare" is unknown (undefined).
 */
export function giveOf(a: Answer): number | undefined {
  if (a.giveValue !== undefined) return a.giveValue;
  return a.receiveValue === undefined ? a.value : undefined;
}

/** "Ricevere" side of an answer, with the same single-value fallback and partial rule. */
export function receiveOf(a: Answer): number | undefined {
  if (a.receiveValue !== undefined) return a.receiveValue;
  return a.giveValue === undefined ? a.value : undefined;
}

/** A reciprocal answer is partial when it is answered but only one of Fare/Ricevere is known. */
export function isPartialAnswer(a: Answer | undefined): boolean {
  if (!a?.answered) return false;
  return (giveOf(a) === undefined) !== (receiveOf(a) === undefined);
}

/** The single `value` kept for older app versions: mean of the known sides. */
export function reciprocalValue(give: number | undefined, receive: number | undefined): number {
  const known = [give, receive].filter((v): v is number => v !== undefined);
  if (known.length === 0) return 50;
  return Math.round(known.reduce((s, v) => s + v, 0) / known.length);
}

function percent(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.round(Math.min(100, Math.max(0, v)));
}

/** Keeps only valid answer fields; Fare/Ricevere are kept only when they are real percentages. */
export function sanitizeAnswers(raw: unknown): Record<string, Answer> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Answer> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const present = new Set(entries.map(([id]) => id));
  for (const [rawId, value] of entries) {
    if (!value || typeof value !== "object") continue;
    // Questions moved to another category keep their answers under the new id.
    const movedTo = MOVED_QUESTION_IDS[rawId];
    if (movedTo && present.has(movedTo)) continue;
    const id = movedTo ?? rawId;
    const a = value as Partial<Record<keyof Answer, unknown>>;
    const give = percent(a.giveValue);
    const receive = percent(a.receiveValue);
    out[id] = {
      value: percent(a.value) ?? 50,
      answered: a.answered === true,
      ...(typeof a.comment === "string" ? { comment: a.comment } : {}),
      ...(a.critical === true ? { critical: true } : {}),
      ...(a.hidden === true ? { hidden: true } : {}),
      ...(give !== undefined ? { giveValue: give } : {}),
      ...(receive !== undefined ? { receiveValue: receive } : {}),
    };
  }
  return out;
}

/** Keeps only plausible category keys (deduplicated). */
export function sanitizeHiddenCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter((c): c is string => typeof c === "string" && /^[A-Za-z0-9_]{1,24}$/.test(c)),
    ),
  );
}

export type Identity = {
  name: string;
  username: string;
  emojis: string[];
  keys?: KeyPairJwk | null;
  createdAt: number;
};

export type ThemeState = {
  mode: "light" | "dark";
};

/**
 * What leaves the device (P2P preview/profile, PNG backup). It never carries the address book
 * or the "favorite" marks: those stay strictly local.
 */
export type ProfileSnapshot = {
  name: string;
  bio: string;
  tags?: ProfileTags;
  answers: Record<string, Answer>;
  /** Categories hidden as a whole (main and Erotismo). Older versions omit it. */
  hiddenCategories?: string[];
  customQuestions: Question[];
  updatedAt: number;
  /**
   * Generale protected by password: per-category means of the owner's answers stay readable,
   * while its answers, comments and custom questions travel only inside `mainProtected`.
   */
  mainAverages?: Record<string, number>;
  mainProtected?: ProtectedBox;
  /** Same two fields for the Erotismo questionnaire, with its own independent password. */
  eroticAverages?: Record<string, number>;
  eroticProtected?: ProtectedBox;
};

const CATEGORY_KEYS = new Set<string>(ALL_CATEGORIES.map((c) => c.key));

/** Clear per-category means of one protected section: known keys of that section, 0–100. */
export function sanitizeAverages(
  raw: unknown,
  section: ProtectedSection,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!CATEGORY_KEYS.has(k) || sectionOfCategory(k) !== section) continue;
    const value = percent(v);
    if (value !== undefined) out[k] = value;
  }
  return out;
}

/**
 * Keeps only the shareable fields of a snapshot. Older app versions also sent a public
 * "recommends" list of other handles: it is dropped on send, on receive and on load.
 */
export function sanitizeSnapshot(snap: ProfileSnapshot): ProfileSnapshot {
  const raw = snap as ProfileSnapshot & Record<string, unknown>;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    bio: typeof raw.bio === "string" ? raw.bio : "",
    ...(raw.tags ? { tags: raw.tags } : {}),
    answers: sanitizeAnswers(raw.answers),
    hiddenCategories: sanitizeHiddenCategories(raw.hiddenCategories),
    customQuestions: sanitizeCustomQuestions(raw.customQuestions),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    ...protectedFields(raw, "main"),
    ...protectedFields(raw, "erotic"),
  };
}

/** A protected section is kept only with a well-formed box; passwords are never copied. */
function protectedFields(raw: Record<string, unknown>, section: ProtectedSection) {
  const box = sanitizeBox(raw[`${section}Protected`]);
  if (!box) return {};
  return {
    [`${section}Averages`]: sanitizeAverages(raw[`${section}Averages`], section) ?? {},
    [`${section}Protected`]: box,
  };
}

/** The owner's password of one section, kept only in this device's IndexedDB. */
export type OwnerSecret = { password: string; salt: string; keyVersion: number };

/**
 * Password protection of the owner's two questionnaires. `lastVersion` remembers the highest
 * keyVersion ever used per section, so a removed and re-set password never reuses a version.
 */
export type OwnerProtection = {
  main?: OwnerSecret;
  erotic?: OwnerSecret;
  lastVersion?: Partial<Record<ProtectedSection, number>>;
};

/** Keeps only well-formed owner secrets (IndexedDB load). */
export function sanitizeProtection(raw: unknown): OwnerProtection {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Partial<Record<keyof OwnerProtection, unknown>>;
  const out: OwnerProtection = {};
  for (const section of ["main", "erotic"] as const) {
    const s = r[section] as Partial<OwnerSecret> | undefined;
    if (
      s &&
      typeof s.password === "string" &&
      s.password.length > 0 &&
      typeof s.salt === "string" &&
      typeof s.keyVersion === "number" &&
      Number.isInteger(s.keyVersion) &&
      s.keyVersion > 0
    )
      out[section] = { password: s.password, salt: s.salt, keyVersion: s.keyVersion };
  }
  const lv = r.lastVersion as Record<string, unknown> | undefined;
  if (lv && typeof lv === "object") {
    const last: Partial<Record<ProtectedSection, number>> = {};
    for (const section of ["main", "erotic"] as const) {
      const v = lv[section];
      if (typeof v === "number" && Number.isInteger(v) && v > 0) last[section] = v;
    }
    out.lastVersion = last;
  }
  return out;
}

export type Contact = {
  handle: string;
  name: string;
  compatibility?: number;
  online?: boolean;
  /**
   * Local, private "favorite" star used to spot key contacts in the address book.
   * Never shared: it is not part of ProfileSnapshot, P2P messages or backups.
   */
  favorite?: boolean;
  emojis: string[];
  snapshot?: ProfileSnapshot;
  roomKey?: string;
  /** Peer public key pinned on first contact (end-to-end encryption). */
  publicKey?: JsonWebKey;
  /** True only when the key came from the person's own backup or the user compared fingerprints. */
  keyVerified?: boolean;
};

export type ConnectionRequest = {
  handle: string;
  name: string;
  direction: "incoming" | "outgoing";
  emojis: string[];
  createdAt: number;
  snapshot?: ProfileSnapshot;
  publicKey?: JsonWebKey;
  keyVerified?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type NetworkPrefs = {};

export type AppState = {
  identity: Identity | null;
  bio: string;
  answers: Record<string, Answer>;
  hiddenCategories: string[];
  customQuestions: Question[];
  openDrawers: Record<string, boolean>;
  theme: ThemeState;
  emojiCollection: string[];
  contacts: Contact[];
  requests: ConnectionRequest[];
  tags: ProfileTags;
  network: NetworkPrefs;
  /** Local only: never part of ProfileSnapshot, P2P messages, backups or diagnostics. */
  protection: OwnerProtection;
};

export const EMPTY_STATE: AppState = {
  identity: null,
  bio: "",
  answers: {},
  hiddenCategories: [],
  customQuestions: [],
  openDrawers: {},
  theme: { mode: "dark" },
  emojiCollection: [],
  contacts: [],
  requests: [],
  network: {},
  protection: {},
  tags: {
    vegan: false,
    animali: false,
    tabacco: false,
    alcol: false,
    droghe: false,
    sport: false,
    "non-monogamia": false,
    prole: false,
    queer: false,
    spirituale: false,
    attivista: false,
  },
};

type LegacyContact = Contact & { recommended?: boolean };

/** Migrates saved contacts: old "recommended" becomes the local favorite; snapshots are cleaned. */
export function migrateContact(c: Contact): Contact {
  const { recommended, ...rest } = c as LegacyContact;
  const favorite = Boolean(rest.favorite ?? recommended);
  return {
    ...rest,
    ...(favorite ? { favorite: true } : { favorite: false }),
    ...(rest.snapshot ? { snapshot: sanitizeSnapshot(rest.snapshot) } : {}),
  };
}

/** Stable order with favorites first; the rest keeps the address-book order. */
export function sortFavoritesFirst(contacts: Contact[]): Contact[] {
  return [...contacts.filter((c) => c.favorite), ...contacts.filter((c) => !c.favorite)];
}

export function migrateRequest(r: ConnectionRequest): ConnectionRequest {
  return r.snapshot ? { ...r, snapshot: sanitizeSnapshot(r.snapshot) } : r;
}

export function handleOf(identity: Identity | null | undefined) {
  if (!identity) return "";
  return `${identity.username}${identity.emojis.join("")}`;
}

export type { CategoryKey, Question };
