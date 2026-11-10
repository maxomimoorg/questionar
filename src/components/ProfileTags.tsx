import { Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isActiveTag,
  PROFILE_TAGS,
  type ProfileTag,
  type ProfileTags,
  type ProfileTagState,
} from "@/lib/profile-tags";

export function CompactProfileTags({
  tags,
  compareWith,
  className = "",
}: {
  tags: ProfileTags | undefined;
  /** When set, chips whose state differs from this profile are shown dimmed. */
  compareWith?: ProfileTags;
  className?: string;
}) {
  const active = PROFILE_TAGS.filter((tag) => isActiveTag(tags?.[tag.id]));
  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {active.map((tag) => (
        <ProfileTagChip
          key={tag.id}
          tag={tag}
          value={tags?.[tag.id]}
          muted={compareWith !== undefined && tags?.[tag.id] !== compareWith[tag.id]}
        />
      ))}
    </div>
  );
}

export function ProfileTagChip({
  tag,
  value,
  muted = false,
  onClick,
}: {
  tag: ProfileTag;
  value: ProfileTagState | undefined;
  /** Presentation only: dims the chip without changing its state or data. */
  muted?: boolean;
  onClick?: () => void;
}) {
  const active = isActiveTag(value);
  const cross = value === "cross";
  const Icon = tag.icon;
  const label = `${tag.label}: ${cross ? "divieto" : active ? "spunta" : "senza risposta"}`;
  const className = `profile-tag ${active ? "profile-tag-active" : "profile-tag-inactive"} ${cross ? "profile-tag-cross" : ""} ${muted ? "profile-tag-muted" : ""}`;
  const content = (
    <>
      <Icon size={12} aria-hidden="true" />
      <span>{tag.label}</span>
      {active &&
        (cross ? <Ban size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />)}
    </>
  );
  return onClick ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={className}
    >
      {content}
    </Button>
  ) : (
    <span aria-label={label} className={className}>
      {content}
    </span>
  );
}
