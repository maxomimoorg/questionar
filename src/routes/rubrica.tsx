import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Download,
  Search,
  Star,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { EmojiCollection } from "@/components/EmojiCollection";
import { percentColor } from "@/lib/color";
import { averageCompatDetail, formatCompat } from "@/lib/compat";
import { usePeer } from "@/lib/peer";
import { exportBackupPng, importBackupPng } from "@/lib/stego";
import { useStore } from "@/lib/store";
import { MarginText } from "@/components/MarginText";
import { emojisFromHandle, isValidHandle } from "@/lib/handle";
import { handleOf, sortFavoritesFirst } from "@/lib/types";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ handle: z.string().optional() });

export const Route = createFileRoute("/rubrica")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Rubrica connessioni — QuestionAR" },
      {
        name: "description",
        content:
          "Cerca handle, gestisci richieste e connessioni, condividi il tuo QR e salva il backup del questionario.",
      },
      { property: "og:title", content: "Rubrica connessioni — QuestionAR" },
      {
        property: "og:description",
        content:
          "Gestisci le tue connessioni QuestionAR, il QR del tuo handle e i backup locali.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RubricaPage,
});

function HandleDisplay({ handle }: { handle: string }) {
  const emojis = emojisFromHandle(handle);
  const emojiStr = emojis.join("");
  const username = emojiStr ? handle.slice(0, handle.length - emojiStr.length) : handle;
  return (
    <div className="flex min-w-0 items-center text-[12px] text-muted-foreground">
      <span className="truncate">@{username}</span>
      {emojiStr && <span className="shrink-0">{emojiStr}</span>}
    </div>
  );
}

function RubricaPage() {
  const { state, questions, resetProfile, removeContact, applyBackup, mySnapshot } = useStore();
  const {
    sendRequest,
    accept,
    reject,
    cancel,
    linkFromBackup,
    connected,
    mode,
    issue,
  } = usePeer();
  const navigate = useNavigate();
  const { handle: prefill } = Route.useSearch();
  const [searchOpen, setSearchOpen] = useState(Boolean(prefill));
  const [query, setQuery] = useState(prefill ?? "");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const myHandle = handleOf(state.identity);
  const qrLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/rubrica?handle=${encodeURIComponent(myHandle)}`;
  }, [myHandle]);

  useEffect(() => {
    if (!canvasRef.current || !qrLink) return;
    const isDark = state.theme.mode === "dark";
    void QRCode.toCanvas(canvasRef.current, qrLink, {
      width: 220,
      margin: 2,
      color: {
        dark: isDark ? "#F8FAFC" : "#2F5257",
        light: isDark ? "#16272B" : "#FFFFFF",
      },
    });
  }, [qrLink, state.theme.mode]);

  const incoming = state.requests.filter((r) => r.direction === "incoming");
  const outgoing = state.requests.filter((r) => r.direction === "outgoing");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Handle copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const compatOf = (handle: string) => {
    const contact = state.contacts.find((c) => c.handle === handle);
    if (!contact?.snapshot) return null;
    const ids = new Set(questions.map((q) => q.id));
    for (const q of contact.snapshot.customQuestions ?? []) ids.add(q.id);
    return averageCompatDetail([...ids], [
      {
        answers: state.answers,
        hiddenCategories: state.hiddenCategories,
        customQuestions: state.customQuestions,
      },
      {
        answers: contact.snapshot.answers,
        hiddenCategories: contact.snapshot.hiddenCategories ?? [],
        customQuestions: contact.snapshot.customQuestions ?? [],
      },
    ]);
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const snap = mySnapshot();
      const blob = await exportBackupPng({
        v: 1,
        name: snap.name,
        handle: myHandle,
        bio: snap.bio,
        ...(snap.tags ? { tags: snap.tags } : {}),
        answers: snap.answers,
        hiddenCategories: snap.hiddenCategories ?? [],
        customQuestions: snap.customQuestions,
        savedAt: Date.now(),
        ...(state.identity?.keys?.publicKey ? { pub: state.identity.keys.publicKey } : {}),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `questionar-${myHandle}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Immagine della tua creatura salvata con il questionario dentro");
    } catch {
      toast.error("Non è stato possibile creare il backup");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const payload = await importBackupPng(file);
      applyBackup(payload);
      toast.success("Backup aggiunto al tuo questionario");
    } catch {
      toast.error("Nessun backup leggibile: serve il file PNG originale");
    } finally {
      setBusy(false);
    }
  };

  const doLinkFromBackup = async (file: File) => {
    setBusy(true);
    try {
      const payload = await importBackupPng(file);
      if (payload.handle === myHandle) {
        toast.error("Questo è il tuo stesso backup");
        return;
      }
      await linkFromBackup(payload.handle, payload.name || payload.handle, {
        name: payload.name,
        bio: payload.bio,
        ...(payload.tags ? { tags: payload.tags } : {}),
        answers: payload.answers,
        ...(payload.hiddenCategories ? { hiddenCategories: payload.hiddenCategories } : {}),
        customQuestions: payload.customQuestions,
        updatedAt: payload.savedAt,
      }, payload.pub);
      toast.success(`Confronto disponibile con @${payload.handle}`);
      void navigate({ to: "/confronto", search: { b: payload.handle } });
    } catch {
      toast.error("Nessun backup leggibile: serve il file PNG originale");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell safe-bottom space-y-4 pt-4">
      {/* Ricerca */}
      <section className="section-card">
        <h2 className="text-[16px]">Aggiungi connessione</h2>
        {searchOpen ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="handle online, es. luna🦊🌊⭐"
                className="flex-1 rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
              />
              <Button
                onClick={() => {
                  const h = query.trim();
                  if (!h) return;
                  if (h === myHandle) {
                    toast.error("Questo è il tuo handle", { id: "handle-self" });
                    return;
                  }
                  if (!isValidHandle(h)) {
                    toast.error("Handle non valido", {
                      id: "handle-invalid",
                      description:
                        "Serve un handle completo: da 4 a 16 lettere o numeri seguiti dalle sue 3 emoji.",
                    });
                    return;
                  }
                  void sendRequest(h);
                  setQuery("");
                }}
                size="icon" className="size-10 rounded-xl"
                aria-label="Cerca utente online e invia richiesta"
              >
                <UserPlus size={18} />
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <span className="absolute w-full border-t border-input" />
              <span className="relative bg-card px-2 text-[12px] text-muted-foreground">oppure</span>
            </div>

            <button
              disabled={busy}
              onClick={() => linkRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-foreground disabled:opacity-60"
            >
              <Upload size={18} /> Confronta con un backup PNG
            </button>
            <input
              ref={linkRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void doLinkFromBackup(file);
                e.target.value = "";
              }}
            />

            <button
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              className="w-full rounded-xl bg-background px-4 py-2 text-[14px] text-muted-foreground"
            >
              Annulla
            </button>
          </div>
        ) : (
          <Button
            onClick={() => setSearchOpen(true)}
            className="mt-3 h-auto w-full rounded-xl px-4 py-3"
          >
            <Search size={18} /> Cerca e confronta
          </Button>
        )}
        <p className="mt-2 text-[12px] text-muted-foreground">
          {issue
            ? `${
                issue === "not_configured"
                  ? "Il server relay non è configurato (VITE_RELAY_URL mancante)."
                  : issue === "quota"
                    ? "È stata superata la quota massima di messaggi del server relay."
                    : "Il server relay è temporaneamente non raggiungibile o offline."
              } Puoi comunque caricare il backup PNG che ti ha inviato un utente per confrontare i profili.`
            : mode === "offline"
              ? "Rete non disponibile."
              : connected
              ? "Puoi cercare un utente online tramite handle o caricare il backup PNG che ti ha inviato per confrontare subito i profili."
              : "Collegamento in corso…"}
        </p>
      </section>

      {/* Richieste */}
      <section className="section-card">
        <h2 className="text-[16px]">Richieste</h2>
        {incoming.length === 0 && outgoing.length === 0 && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Nessuna richiesta in sospeso.
          </p>
        )}
        <p className="mt-1 text-[12px] text-muted-foreground">
          Puoi chiudere l’app quando vuoi: le richieste ricevute mentre sei offline restano in
          attesa fino a 72 ore e arrivano appena la riapri.
        </p>
        <div className="mt-2 space-y-2">
          {incoming.map((r) => (
            <div
              key={r.handle}
              className="flex items-center gap-3 rounded-2xl bg-background p-2"
            >
              <Avatar handle={r.handle} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{r.name}</div>
                <div className="truncate text-[12px] text-muted-foreground">@{r.handle}</div>
              </div>
              <Button
                aria-label="Accetta"
                onClick={() => void accept(r.handle)}
                size="icon" className="rounded-full"
              >
                <Check size={16} />
              </Button>
              <button
                aria-label="Rifiuta"
                onClick={() => void reject(r.handle)}
                className="grid size-9 place-items-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {outgoing.map((r) => (
            <div
              key={r.handle}
              className="flex items-center gap-3 rounded-2xl bg-background p-2"
            >
              <Avatar handle={r.handle} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{r.name}</div>
                <div className="truncate text-[12px] text-muted-foreground">@{r.handle}</div>
              </div>
              <button
                onClick={() => void cancel(r.handle)}
                className="rounded-xl bg-destructive px-3 py-1.5 text-[14px] text-destructive-foreground"
              >
                Annulla
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Connessioni */}
      <section className="section-card">
        <h2 className="text-[16px]">Connessioni</h2>
        {state.contacts.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Ancora nessuna connessione: cerca un handle o condividi il tuo QR.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* Local favorites first, so key contacts are found at a glance. */}
            {sortFavoritesFirst(state.contacts).map((c) => {
              const compat = compatOf(c.handle);
              return (
                <div key={c.handle} className="relative rounded-2xl bg-background p-2">
                  <div
                    onClick={() => navigate({ to: "/confronto", search: { b: c.handle } })}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate({ to: "/confronto", search: { b: c.handle } });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar handle={c.handle} size={38} />
                        <span
                          className={`shrink-0 size-2 rounded-full ${
                            c.online ? "bg-accent" : "bg-muted-foreground/40"
                          }`}
                        />
                        <span
                          className="shrink-0 text-[14px] font-bold"
                          style={{
                            color:
                              compat === null
                                ? "var(--color-muted-foreground)"
                                : percentColor(compat.score),
                          }}
                        >
                          {formatCompat(compat)}<MarginText result={compat} />
                        </span>
                        {c.favorite && (
                          <Star
                            size={12}
                            fill="currentColor"
                            className="shrink-0 text-accent"
                            role="img"
                            aria-label="Preferito"
                          />
                        )}
                      </div>
                      <button
                        aria-label="Elimina connessione"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(c.handle);
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-destructive"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-1 truncate text-[14px] font-semibold">
                      {c.name}
                    </div>
                    <HandleDisplay handle={c.handle} />
                  </div>

                  {confirmDelete === c.handle && (
                    <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/95 p-2 text-center">
                      <div>
                        <p className="text-[12px]">Eliminare questa connessione?</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-xl bg-surface-2 px-3 py-1 text-[14px]"
                          >
                            No
                          </button>
                          <button
                            onClick={() => {
                              removeContact(c.handle);
                              setConfirmDelete(null);
                            }}
                            className="rounded-xl bg-destructive px-3 py-1 text-[14px] text-destructive-foreground"
                          >
                            Sì
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* QR */}
      <section className="section-card text-center">
        <h2 className="text-[16px]">Il tuo QR</h2>
        <div className="mx-auto mt-2 inline-block rounded-2xl border border-border bg-surface p-3"><canvas ref={canvasRef} className="block" /></div>
        <button
          onClick={() => copy(myHandle)}
          className="mx-auto mt-1 flex items-center gap-1 text-[14px] font-normal text-muted-foreground"
        >
          @{myHandle} <Copy size={14} />
        </button>
      </section>

      {/* Backup */}
      <section className="section-card">
        <h2 className="text-[16px]">Backup</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Verrà scaricata un'immagine della tua creatura avatar che contiene al suo interno
          le domande e le risposte del tuo questionario. Condividila solo come file PNG: le
          immagini compresse in JPG delle chat perdono i dati.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            disabled={busy}
            onClick={() => void doExport()}
            className="h-auto rounded-2xl px-4 py-3 disabled:opacity-60"
          >
            <Download size={16} /> Esporta
          </Button>
          <Button
            disabled={busy}
            onClick={() => importRef.current?.click()}
            className="h-auto rounded-2xl px-4 py-3 disabled:opacity-60"
          >
            <Upload size={16} /> Importa
          </Button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
            e.target.value = "";
          }}
        />
        {confirmWipe ? (
          <div className="mt-2 rounded-2xl bg-background p-3 text-center">
            <p className="text-[14px]">Eliminare del tutto il profilo e i dati?</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setConfirmWipe(false)}
                className="flex-1 rounded-xl bg-surface-2 px-3 py-2"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  await resetProfile();
                  setConfirmWipe(false);
                  void navigate({ to: "/" });
                }}
                className="flex-1 rounded-xl bg-destructive px-3 py-2 text-destructive-foreground"
              >
                Elimina
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmWipe(true)}
            className="mt-2 w-full rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground"
          >
            Elimina profilo
          </button>
        )}
      </section>

      <EmojiCollection />
    </div>
  );
}

/** Rough oklch() -> hex conversion, enough for the QR foreground. */
