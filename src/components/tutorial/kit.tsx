import { Hand, Play } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/** True when the device asks for reduced motion: demos then stay on a still, readable frame. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * Steps through 0..length-1 every `ms` milliseconds, like a tiny looping video.
 * It stops for good as soon as the person interacts (`select`/`stop`) or prefers reduced motion.
 */
export function useDemoCycle(length: number, ms: number) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running || reduced || length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [running, reduced, length, ms]);
  const stop = useCallback(() => setRunning(false), []);
  const select = useCallback((i: number) => {
    setRunning(false);
    setIndex(i);
  }, []);
  return { index, playing: running && !reduced, stop, select };
}

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
          {hint === "tocca" ? "Prova a toccare" : hint === "trascina" ? "Prova a trascinare" : "Esempio"}
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
