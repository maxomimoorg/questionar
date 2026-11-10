import { useCallback, useEffect, useState } from "react";

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
