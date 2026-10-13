import {
  Baby,
  Check,
  Ban,
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
import { Button } from "@/components/ui/button";
import { isActiveTag, type ProfileTags, type ProfileTagState } from "@/lib/profile-tags";

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

export function CompactProfileTags({
  tags,
  className = "",
}: {
  tags: ProfileTags | undefined;
  className?: string;
}) {
  const active = PROFILE_TAGS.filter((tag) => isActiveTag(tags?.[tag.id]));
  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {active.map((tag) => (
        <ProfileTagChip key={tag.id} tag={tag} value={tags?.[tag.id]} />
      ))}
    </div>
  );
}

export function ProfileTagChip({ tag, value, onClick }: {
  tag: ProfileTag;
  value: ProfileTagState | undefined;
  onClick?: () => void;
}) {
  const active = isActiveTag(value);
  const cross = value === "cross";
  const Icon = tag.icon;
  const label = `${tag.label}: ${cross ? "divieto" : active ? "spunta" : "senza risposta"}`;
  const className = `profile-tag ${active ? "profile-tag-active" : "profile-tag-inactive"} ${cross ? "profile-tag-cross" : ""}`;
  const content = <><Icon size={12} aria-hidden="true" /><span>{tag.label}</span>{active && (cross ? <Ban size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />)}</>;
  return onClick ? (
    <Button type="button" variant="ghost" size="sm" aria-label={label} aria-pressed={active} onClick={onClick} className={className}>{content}</Button>
  ) : <span aria-label={label} className={className}>{content}</span>;
}