import { Link, useRouterState } from "@tanstack/react-router";
import { BookUser, Info, Moon, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { InfoModal } from "./InfoModal";
import { useStore } from "@/lib/store";
import { handleOf } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function Header() {
  const { state, toggleMode } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [shrunk, setShrunk] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
            <Button variant="link"
              onClick={copyHandle}
              className="h-auto max-w-full justify-start truncate p-0 text-left text-[12px] font-normal text-muted-foreground"
            >
              @{handle}
            </Button>
          )}
        </div>

        <div className="relative flex items-center gap-1">
          <Button asChild variant="secondary" size="icon" className="header-action"><Link
            to={onRubrica ? "/" : "/rubrica"}
            onClick={(e) => e.stopPropagation()}
            aria-label={onRubrica ? "Vai al profilo" : "Apri la rubrica"}
          >
            {onRubrica ? <UserRound size={18} /> : <BookUser size={18} />}
          </Link></Button>
          <Button
            variant="secondary" size="icon" title="Informazioni sull'app"
            aria-label="Informazioni sull'app"
            onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
            className="header-action"
          >
            <Info size={18} />
          </Button>
          <Button variant="secondary" size="icon" className="header-action"
            aria-label="Cambia tema" title={state.theme.mode === "dark" ? "Modalità chiara" : "Modalità scura"}
            onClick={(e) => { e.stopPropagation(); toggleMode(); }}>
            {state.theme.mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

        </div>
      </div>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </header>
  );
}
