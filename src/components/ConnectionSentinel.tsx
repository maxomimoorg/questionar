import { BellRing, MoonStar, PictureInPicture2, Power } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { usePeer } from "@/lib/peer";
import { IDLE_STATUS, Sentinel, formatElapsed, newArrivals, type SentinelStatus } from "@/lib/sentinel";
import { useStore } from "@/lib/store";

type PipApi = { requestWindow: (o?: { width?: number; height?: number }) => Promise<Window> };

function pipApi(): PipApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture ?? null;
}

/** Copies the app styles into the Picture-in-Picture window so tokens and utilities apply. */
function copyStyles(target: Window) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = target.document.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.className = document.documentElement.className;
}

function relayLabel(connected: boolean, mode: string, issue: string | null) {
  if (connected) return { text: "Relay collegato", live: true };
  if (issue === "not_configured") return { text: "Relay non configurato", live: false };
  if (issue === "quota") return { text: "Quota del relay esaurita", live: false };
  if (issue === "unreachable") return { text: "Relay non raggiungibile, riprovo…", live: false };
  if (mode === "offline") return { text: "Rete non disponibile", live: false };
  return { text: "Collegamento in corso…", live: false };
}

function StatusPanel({
  status,
  now,
  relay,
  compact = false,
}: {
  status: SentinelStatus;
  now: number;
  relay: { text: string; live: boolean };
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2 p-4 text-center" : "space-y-4 text-center"}>
      <div className="flex items-center justify-center gap-2 text-[12px] uppercase tracking-[0.2em] text-sentinel-dim">
        <MoonStar size={14} aria-hidden /> In ascolto
      </div>
      <div
        className={`font-display tabular-nums text-sentinel-foreground ${compact ? "text-3xl" : "text-5xl"}`}
        aria-label="Tempo di ascolto attivo"
      >
        {formatElapsed(status.startedAt ? now - status.startedAt : 0)}
      </div>
      <div className="flex items-center justify-center gap-2 text-[14px] text-sentinel-foreground">
        <span
          aria-hidden
          className={`size-2 rounded-full ${relay.live ? "sentinel-breathe bg-sentinel-live" : "bg-sentinel-dim"}`}
        />
        <span>{relay.text}</span>
      </div>
      <div className="text-[14px] text-sentinel-foreground" aria-live="polite">
        <BellRing size={14} className="mr-1 inline" aria-hidden />
        {status.incoming === 0
          ? "Nessuna richiesta in arrivo"
          : status.incoming === 1
            ? "1 richiesta in arrivo"
            : `${status.incoming} richieste in arrivo`}
      </div>
    </div>
  );
}

/** "Resta in ascolto" button plus the dimmed standby view, shown in the address book. */
export function ConnectionSentinel() {
  const { connected, mode, issue, keepAlive } = usePeer();
  const { state } = useStore();
  const [status, setStatus] = useState<SentinelStatus>(IDLE_STATUS);
  const [now, setNow] = useState(() => Date.now());
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const keepAliveRef = useRef(keepAlive);
  keepAliveRef.current = keepAlive;
  const sentinelRef = useRef<Sentinel | null>(null);
  const seenRef = useRef<string[]>([]);

  const incomingHandles = useMemo(
    () => state.requests.filter((r) => r.direction === "incoming").map((r) => r.handle),
    [state.requests],
  );

  // Notify about requests that arrive while the standby is active.
  useEffect(() => {
    const s = sentinelRef.current;
    if (s?.current.active) for (const h of newArrivals(seenRef.current, incomingHandles)) void s.incoming(h);
    seenRef.current = incomingHandles;
  }, [incomingHandles]);

  useEffect(() => {
    if (!status.active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(t);
      document.body.style.overflow = previous;
    };
  }, [status.active]);

  useEffect(() => () => void sentinelRef.current?.stop(), []);

  const start = async () => {
    const s = new Sentinel(() => keepAliveRef.current(), setStatus);
    sentinelRef.current = s;
    seenRef.current = incomingHandles;
    await s.start();
  };

  const stop = async () => {
    pipWin?.close();
    setPipWin(null);
    await sentinelRef.current?.stop();
    sentinelRef.current = null;
  };

  const openPip = async () => {
    const api = pipApi();
    if (!api) return;
    try {
      const win = await api.requestWindow({ width: 280, height: 220 });
      copyStyles(win);
      win.document.body.className = "bg-sentinel m-0";
      win.addEventListener("pagehide", () => setPipWin(null));
      setPipWin(win);
    } catch {
      /* user dismissed or not allowed */
    }
  };

  const relay = relayLabel(connected, mode, issue);
  const supportsPip = Boolean(pipApi());

  if (!status.active) {
    return (
      <div className="mt-3">
        <Button variant="secondary" onClick={() => void start()} className="h-auto w-full rounded-xl px-4 py-3">
          <MoonStar size={18} /> Resta in ascolto
        </Button>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Modalità standby: tiene acceso lo schermo e la connessione al relay e ti avvisa con una
          notifica quando arriva una richiesta.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modalità standby"
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-sentinel px-6 safe-top safe-bottom"
      >
        <div className="sentinel-drift">
          <StatusPanel status={status} now={now} relay={relay} />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2 text-[12px] text-sentinel-dim">
          <span>
            Schermo:{" "}
            {status.wakeLock === "active"
              ? "sempre acceso"
              : status.wakeLock === "unsupported"
                ? "blocco non supportato"
                : status.wakeLock === "denied"
                  ? "blocco negato"
                  : "riacquisto al ritorno"}
          </span>
          <span aria-hidden>·</span>
          <span>
            Notifiche:{" "}
            {status.notifications === "granted"
              ? "attive"
              : status.notifications === "unsupported"
                ? "non supportate"
                : "non consentite"}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {supportsPip && !pipWin && (
            <Button variant="sentinel" onClick={() => void openPip()} className="rounded-xl">
              <PictureInPicture2 size={16} /> Mini finestra
            </Button>
          )}
          <Button variant="sentinel" onClick={() => void stop()} className="rounded-xl">
            <Power size={16} /> Termina standby
          </Button>
        </div>
      </div>
      {pipWin &&
        createPortal(
          <div className="flex min-h-screen items-center justify-center bg-sentinel">
            <StatusPanel status={status} now={now} relay={relay} compact />
          </div>,
          pipWin.document.body,
        )}
    </>
  );
}
