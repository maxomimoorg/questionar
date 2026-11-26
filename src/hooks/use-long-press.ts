import { useRef } from "react";

export const LONG_PRESS_MS = 650;
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/**
 * Pointer handlers for a button with a short tap (`onTap`) and a long press (`onLongPress`).
 * After a long press the following click is swallowed, so the tap action never fires too.
 * Keyboard activation (Enter/Space) still triggers the tap through onClick.
 */
export function useLongPress(onTap: () => void, onLongPress?: () => void, ms = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return {
    onPointerDown: (e: { clientX: number; clientY: number }) => {
      fired.current = false;
      if (!onLongPress) return;
      stop();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        start.current = null;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: { clientX: number; clientY: number }) => {
      if (!timer.current || !start.current) return;
      const distance = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
      if (distance > LONG_PRESS_MOVE_TOLERANCE_PX) stop();
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
