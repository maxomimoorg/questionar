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

export type ProfileSnapshot = {
  name: string;
  bio: string;
  tags?: ProfileTags;
  answers: Record<string, Answer>;
  customQuestions: Question[];
  recommends: string[];
  updatedAt: number;
};

export type Contact = {
  handle: string;
  name: string;
  compatibility?: number;
  online?: boolean;
  recommended?: boolean;
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

export function handleOf(identity: Identity | null | undefined) {
  if (!identity) return "";
  return `${identity.username}${identity.emojis.join("")}`;
}

export type { CategoryKey, Question };
