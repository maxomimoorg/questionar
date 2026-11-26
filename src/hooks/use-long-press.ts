import { useRef } from "react";

export const LONG_PRESS_MS = 650;

/**
 * Pointer handlers for a button with a short tap (`onTap`) and a long press (`onLongPress`).
 * After a long press the following click is swallowed, so the tap action never fires too.
 * Keyboard activation (Enter/Space) still triggers the tap through onClick.
 */
export function useLongPress(onTap: () => void, onLongPress?: () => void, ms = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      fired.current = false;
      if (!onLongPress) return;
      stop();
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, ms);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (onLongPress) e.preventDefault();
    },
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}
