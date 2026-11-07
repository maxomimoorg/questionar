import type { CategoryKey, Question } from "./questions";
import type { KeyPairJwk } from "./keys";
import type { ProfileTags } from "./profile-tags";

export type Answer = {
  value: number;
  answered: boolean;
  comment?: string;
  critical?: boolean;
  hidden?: boolean;
};

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
  customQuestions: Question[];
  updatedAt: number;
};

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
    answers: raw.answers && typeof raw.answers === "object" ? raw.answers : {},
    customQuestions: Array.isArray(raw.customQuestions) ? raw.customQuestions : [],
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  };
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
  customQuestions: Question[];
  openDrawers: Record<string, boolean>;
  theme: ThemeState;
  emojiCollection: string[];
  contacts: Contact[];
  requests: ConnectionRequest[];
  tags: ProfileTags;
  network: NetworkPrefs;
};

export const EMPTY_STATE: AppState = {
  identity: null,
  bio: "",
  answers: {},
  customQuestions: [],
  openDrawers: {},
  theme: { mode: "dark" },
  emojiCollection: [],
  contacts: [],
  requests: [],
  network: {},
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
