import {
  Baby,
  Cigarette,
  Dumbbell,
  Leaf,
  Megaphone,
  PawPrint,
  Pill,
  Rainbow,
  Sparkles,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";

/** Existing boolean values stay valid in IndexedDB, peer snapshots and QAR1 backups. */
export type ProfileTagState = boolean | "cross";
export type ProfileTags = Record<string, ProfileTagState>;

export function isActiveTag(value: ProfileTagState | undefined) {
  return value === true || value === "cross";
}

export function nextTagState(value: ProfileTagState | undefined): ProfileTagState {
  return value === true ? "cross" : value === "cross" ? false : true;
}
const TAG_IDS = new Set<string>();

/**
 * Keeps only known tag ids with a valid state (true, false or "cross"); everything else coming
 * from IndexedDB, peers or PNG cards is dropped. Returns undefined when nothing valid is left.
 */
export function sanitizeProfileTags(raw: unknown): ProfileTags | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  if (TAG_IDS.size === 0) for (const tag of PROFILE_TAGS) TAG_IDS.add(tag.id);
  const out: ProfileTags = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!TAG_IDS.has(id)) continue;
    if (value === true || value === false || value === "cross") out[id] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export type ProfileTag = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const PROFILE_TAGS: ProfileTag[] = [
  { id: "vegan", label: "vegan", icon: Leaf },
  { id: "animali", label: "animali", icon: PawPrint },
  { id: "tabacco", label: "tabacco", icon: Cigarette },
  { id: "alcol", label: "alcol", icon: Wine },
  { id: "droghe", label: "droghe", icon: Pill },
  { id: "sport", label: "sport", icon: Dumbbell },
  { id: "non-monogamia", label: "non-monogamia", icon: Users },
  { id: "prole", label: "prole", icon: Baby },
  { id: "queer", label: "queer", icon: Rainbow },
  { id: "spirituale", label: "spirituale", icon: Sparkles },
  { id: "attivista", label: "attivista", icon: Megaphone },
];
