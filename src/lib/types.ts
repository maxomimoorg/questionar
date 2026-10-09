import type { CategoryKey, Question } from "./questions";
import type { KeyPairJwk } from "./keys";

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
  accentH: number;
  tintH: number;
};

export type ProfileSnapshot = {
  name: string;
  bio: string;
  tags?: Record<string, boolean>;
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
};

export type ConnectionRequest = {
  handle: string;
  name: string;
  direction: "incoming" | "outgoing";
  emojis: string[];
  createdAt: number;
  snapshot?: ProfileSnapshot;
  publicKey?: JsonWebKey;
};

export type NetworkPrefs = {
  /** Opt-in: use public MQTT brokers when the Cloudflare relay is missing or unavailable. */
  mqttFallback: boolean;
};

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
  tags: Record<string, boolean>;
  network: NetworkPrefs;
};

export const EMPTY_STATE: AppState = {
  identity: null,
  bio: "",
  answers: {},
  customQuestions: [],
  openDrawers: {},
  theme: { mode: "light", accentH: 184, tintH: 184 },
  emojiCollection: [],
  contacts: [],
  requests: [],
  network: { mqttFallback: false },
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
