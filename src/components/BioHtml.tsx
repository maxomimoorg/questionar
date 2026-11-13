import { useMemo } from "react";

import { sanitizeBio } from "@/lib/bio";

/** Renders a bio through the allow-list, also for contacts saved before sanitizing existed. */
export function BioHtml({ html, className = "" }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeBio(html), [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
