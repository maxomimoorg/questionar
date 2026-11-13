import { useMemo } from "react";

import { avatarDataUri } from "@/lib/avatar";

type Props = { handle: string; size?: number; className?: string };

/** Deterministic creature avatar generated on the device from the complete handle. */
export function Avatar({ handle, size = 44, className = "" }: Props) {
  const src = useMemo(() => avatarDataUri(handle), [handle]);
  return (
    <img
      src={src}
      alt={`Avatar di ${handle}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-surface-2 object-cover ${className}`}
    />
  );
}
