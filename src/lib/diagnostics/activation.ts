// 5 consecutive taps within a short window activate diagnostics.

export const TAPS_REQUIRED = 5;
export const TAP_WINDOW_MS = 3000;
/** A pause longer than this between two taps restarts the count. */
export const TAP_MAX_GAP_MS = 800;

export function createTapCounter(opts: { now?: () => number } = {}) {
  const now = opts.now ?? (() => Date.now());
  let taps: number[] = [];
  return {
    /** Returns true exactly on the activating tap. */
    tap(): boolean {
      const t = now();
      const last = taps[taps.length - 1];
      if (last !== undefined && t - last > TAP_MAX_GAP_MS) taps = [];
      taps.push(t);
      taps = taps.filter((x) => t - x <= TAP_WINDOW_MS);
      if (taps.length >= TAPS_REQUIRED) {
        taps = [];
        return true;
      }
      return false;
    },
    reset() {
      taps = [];
    },
  };
}
