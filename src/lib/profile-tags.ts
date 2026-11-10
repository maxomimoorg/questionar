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
