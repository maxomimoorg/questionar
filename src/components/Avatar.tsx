type Props = { handle: string; size?: number; className?: string };

/** Deterministic creature avatar generated from the complete handle. */
export function Avatar({ handle, size = 44, className = "" }: Props) {
  const src = `https://api.dicebear.com/10.x/critters/svg?seed=${encodeURIComponent(handle)}`;
  return (
    <img
      src={src}
      alt={`Avatar di ${handle}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
      className={`shrink-0 rounded-full bg-surface-2 object-cover ${className}`}
    />
  );
}
