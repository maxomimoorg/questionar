import { Hand, Play } from "lucide-react";
import { type ReactNode } from "react";

/** Uniform frame for every demo; `hint` tells whether it can be touched or only watched. */
export function Stage({
  children,
  hint,
  className = "",
}: {
  children: ReactNode;
  hint?: "tocca" | "trascina" | "guarda";
  className?: string;
}) {
  return (
    <div className={`demo-stage ${className}`}>
      {hint && (
        <span className="demo-hint" aria-hidden="true">
          {hint === "guarda" ? <Play size={10} /> : <Hand size={10} />}
          {hint === "tocca"
            ? "Prova a toccare"
            : hint === "trascina"
              ? "Prova a trascinare"
              : "Esempio"}
        </span>
      )}
      {children}
    </div>
  );
}

/** One feature of the tutorial: short title, live demo, one-line caption. */
export function Feature({
  title,
  demo,
  children,
}: {
  title: string;
  demo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[15px]">{title}</h3>
      {demo}
      <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
