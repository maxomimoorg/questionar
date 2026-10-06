import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookUser, Info, Moon, Sun, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { InfoModal } from "./InfoModal";
import { PALETTE, useStore } from "@/lib/store";
import { handleOf } from "@/lib/types";

export function Header() {
  const { state, toggleMode, setAccent, setTint } = useStore();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [shrunk, setShrunk] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const identity = state.identity;
  const handle = handleOf(identity);
  const onRubrica = path.startsWith("/rubrica");

  useEffect(() => {
    const onScroll = () => setShrunk(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const copyHandle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(handle);
      toast.success("Handle copiato");
    } catch {
      toast.error("Impossibile copiare l'handle");
    }
  };

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setPaletteOpen(true);
    }, 450);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!longPressed.current) toggleMode();
  };

  return (
    <header
      className="safe-top sticky top-0 z-40 glass-bar border-b border-border/60"
      onClick={() => {
        if (shrunk) window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <div
        className={`app-shell flex items-center gap-3 transition-all duration-200 ${
          shrunk ? "py-1.5" : "py-3"
        }`}
      >
        <Avatar handle={handle || "questionar"} size={shrunk ? 30 : 46} />
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={`truncate font-semibold text-foreground transition-all ${
              shrunk ? "text-[14px]" : "text-[16px]"
            }`}
          >
            {identity?.name ?? "QuestionAR"}
          </div>
          {handle && (
            <button
              onClick={copyHandle}
              className="max-w-full truncate text-left text-[12px] font-normal text-muted-foreground"
            >
              @{handle}
            </button>
          )}
        </div>

        <div className="relative flex items-center gap-1">
          <Link
            to={onRubrica ? "/" : "/rubrica"}
            onClick={(e) => e.stopPropagation()}
            aria-label={onRubrica ? "Vai al profilo" : "Apri la rubrica"}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            {onRubrica ? <UserRound size={18} /> : <BookUser size={18} />}
          </Link>
          <button
            aria-label="Informazioni sull'app"
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <Info size={18} />
          </button>
          <button
            aria-label="Cambia tema"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              startPress();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              endPress();
            }}
            onPointerLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            {state.theme.mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {paletteOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-64 rounded-2xl bg-popover p-3 shadow-xl ring-1 ring-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 text-[12px] text-muted-foreground">
                Tinta dello sfondo
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {PALETTE.map((p, i) => (
                  <button
                    key={`tint-${p.label}`}
                    aria-label={`Sfondo ${p.label}`}
                    onClick={() => setTint(i)}
                    className={`size-6 rounded-full ring-2 ${
                      state.theme.tintH === p.h ? "ring-accent" : "ring-border"
                    }`}
                    style={{ backgroundColor: `oklch(0.88 0.06 ${p.h})` }}
                  />
                ))}
              </div>
              <div className="mb-2 mt-3 text-[12px] text-muted-foreground">
                Elementi in risalto
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {PALETTE.map((p, i) => (
                  <button
                    key={`accent-${p.label}`}
                    aria-label={`Accento ${p.label}`}
                    onClick={() => setAccent(i)}
                    className={`size-6 rounded-full ring-2 ${
                      state.theme.accentH === p.h ? "ring-accent" : "ring-border"
                    }`}
                    style={{ backgroundColor: `oklch(0.7 0.15 ${p.h})` }}
                  />
                ))}
              </div>
              <button
                onClick={() => setPaletteOpen(false)}
                className="mt-3 w-full rounded-xl bg-surface-2 px-3 py-2 text-[14px]"
              >
                Chiudi
              </button>
            </div>
          )}

        </div>
      </div>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </header>
  );
}
