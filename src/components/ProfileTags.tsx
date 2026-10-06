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
  tags: Record<string, boolean> | undefined;
  className?: string;
}) {
  const active = PROFILE_TAGS.filter((tag) => tags?.[tag.id]);
  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {active.map(({ id, label, icon: Icon }) => (
        <span
          key={id}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[12px] text-accent-foreground ring-1 ring-accent"
        >
          <Icon size={12} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}