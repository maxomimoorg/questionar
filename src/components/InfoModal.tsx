import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  ArrowLeftRight,
  ChevronDown,
  Compass,
  Lock,
  MessagesSquare,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
  Timer,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { createTapCounter } from "@/lib/diagnostics/activation";
import { startDiagnostics } from "@/lib/diagnostics/session";
import { categoryQuestionCount } from "./tutorial/examples";
import { useReducedMotion } from "./tutorial/hooks";
import { Feature } from "./tutorial/kit";
import {
  DemoBackupCard,
  DemoBio,
  DemoCategories,
  DemoComment,
  DemoCompatMap,
  DemoConnect,
  DemoCritical,
  DemoCustomQuestion,
  DemoEmojiCollection,
  DemoErotismo,
  DemoFavorite,
  DemoHidden,
  DemoOfflineRequest,
  DemoProfileTags,
  DemoReciprocal,
  DemoSimilarity,
  DemoSlider,
  DemoThreeWay,
  DemoZeroServer,
} from "./tutorial/demos";

/** One tutorial chapter: its h2 lives in the trigger, features below are h3. */
function Chapter({
  value,
  number,
  icon: Icon,
  title,
  children,
}: {
  value: string;
  number: number;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionPrimitive.Item value={value} id={`tutorial-${value}`} className="tutorial-chapter">
      <AccordionPrimitive.Header asChild>
        <h2 className="m-0">
          <AccordionPrimitive.Trigger className="tutorial-trigger group">
            <span className="tutorial-chapter-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="flex-1 text-left">
              <span className="sr-only">{number}. </span>
              {title}
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </AccordionPrimitive.Trigger>
        </h2>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="space-y-6 pb-6 pt-1">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-relaxed">{children}</p>;
}

function Point({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 rounded-2xl bg-background p-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <p className="text-[13px] leading-snug">
        <strong className="block text-[13px]">{title}</strong>
        <span className="text-muted-foreground">{children}</span>
      </p>
    </li>
  );
}

export function InfoModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const tapCounter = useRef(createTapCounter());
  const reduced = useReducedMotion();
  const [openChapter, setOpenChapter] = useState("cos-e");

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, summary, [tabindex="0"]',
      );
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  // After the previous chapter collapses, bring the newly opened title to the top.
  const openAndReveal = (value: string) => {
    setOpenChapter(value);
    if (!value) return;
    window.setTimeout(() => {
      document
        .getElementById(`tutorial-${value}`)
        ?.scrollIntoView?.({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }, 230);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-overlay p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="questionar-info-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="info-scroll safe-bottom mt-6 max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface px-5 pb-5 shadow-2xl outline-none ring-1 ring-border"
      >
        <div className="tutorial-header">
          <img
            src="/logo.png"
            alt="Logo QuestionAR"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1
              id="questionar-info-title"
              className="select-none text-2xl leading-tight"
              onClick={() => {
                if (tapCounter.current.tap()) {
                  startDiagnostics();
                  onClose();
                }
              }}
            >
              QuestionAR
            </h1>
            <p className="text-[12px] text-muted-foreground">Guida in 6 passi · prova gli esempi</p>
          </div>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Chiudi le informazioni"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <X size={18} />
          </Button>
        </div>

        <AccordionPrimitive.Root
          type="single"
          collapsible
          value={openChapter}
          onValueChange={openAndReveal}
          className="w-full"
        >
          <Chapter value="cos-e" number={1} icon={Compass} title="Cos’è QuestionAR">
            <Lead>
              Un’<strong>anti-dating app</strong>: niente swipe, foto o algoritmi segreti. Rispondi
              a domande sincere e scopri dove tu e l’altra persona vi incontrate.
            </Lead>
            <Feature title="Una mappa, non un voto" demo={<DemoCompatMap />}>
              Nel confronto trovi la stessa mappa con i tuoi dati: totale e categorie, dalla più
              affine. Tocca una barra per aprire le domande: i numeri servono per iniziare a
              parlare.
            </Feature>
            <ul className="grid gap-2 sm:grid-cols-3">
              <Point icon={Timer} title="Con calma">
                Ogni risposta si salva subito e si può cambiare.
              </Point>
              <Point icon={UserCheck} title="Scegli tu">
                Nessun profilo pubblico: condividi solo con chi vuoi.
              </Point>
              <Point icon={MessagesSquare} title="Parlatene">
                I numeri sono un punto di partenza.
              </Point>
            </ul>
          </Chapter>

          <Chapter
            value="rispondere"
            number={2}
            icon={SlidersHorizontal}
            title="Rispondere a modo tuo"
          >
            <Feature title="Sfumature" demo={<DemoSlider />}>
              No = 0%, Sì = 100%, e tutte le vie di mezzo.
            </Feature>
            <Feature title="Commenti" demo={<DemoComment />}>
              Un numero non dice tutto: aggiungi il perché della tua risposta.
            </Feature>
            <Feature title="Domande critiche" demo={<DemoCritical />}>
              Con ⚡ una domanda diventa irrinunciabile: vicinanza e distanza contano molto di più.
            </Feature>
            <Feature title="Domande personalizzate" demo={<DemoCustomQuestion />}>
              Con il tasto + crei le tue domande. <strong>Normale</strong> ha un cursore;{" "}
              <strong>Complementare</strong> ne ha due, Fare e Ricevere.
            </Feature>
            <Feature title="La tua bio" demo={<DemoBio />}>
              Fino a 666 caratteri, con titoli, stili, link e colori.
            </Feature>
          </Chapter>

          <Chapter
            value="reciprocita"
            number={3}
            icon={ArrowLeftRight}
            title="Somiglianza e reciprocità"
          >
            <Feature title="Somiglianza" demo={<DemoSimilarity />}>
              Nella maggior parte delle domande, più le risposte sono vicine, più siete compatibili.
            </Feature>
            <Feature title="Reciprocità: Fare e Ricevere" demo={<DemoReciprocal />}>
              Quando una cosa si dà e si riceve (affetto, intimità, supporto), si confronta quanto
              ami fare con quanto l’altrə ama ricevere. Se manca un lato, vedi una stima col margine
              d’errore in grigio (es. 90% ±45%).
            </Feature>
          </Chapter>

          <Chapter value="connettersi" number={4} icon={Users} title="Connettersi e confrontare">
            <Feature title="Tre modi per connettersi" demo={<DemoConnect />}>
              Dal vivo con il QR, a distanza con l’handle oppure offline con la scheda avatar.
            </Feature>
            <Feature title="Richieste anche da offline" demo={<DemoOfflineRequest />}>
              Non serve tenere l’app aperta: le richieste restano in attesa, cifrate, per 72 ore.
            </Feature>
            <Feature title="Confronto a tre" demo={<DemoThreeWay />}>
              Aggiungi un terzo profilo: c’è spazio anche per le relazioni di gruppo e il poliamore.
            </Feature>
          </Chapter>

          <Chapter value="spazi" number={5} icon={Tags} title="I tuoi spazi">
            <Feature title="Tag del profilo" demo={<DemoProfileTags />}>
              Tocca: spunta → divieto → senza risposta. Non rispondere non significa dire no. I tag
              compaiono nel profilo, nei confronti e nella scheda avatar.
            </Feature>
            <Feature title="Domande nascoste" demo={<DemoHidden />}>
              Con l’occhio una domanda non compare più nei confronti e non conta nel calcolo.
            </Feature>
            <Feature title="Categorie: aprire, contare, nascondere" demo={<DemoCategories />}>
              Apri o chiudi tutto insieme e segui i progressi (es. 3/{categoryQuestionCount("B")} →{" "}
              {categoryQuestionCount("B")} ✓). Le categorie nascoste si ripristinano da «Categorie e
              domande nascoste».
            </Feature>
            <Feature title="Preferiti" demo={<DemoFavorite />}>
              La stella resta solo sul tuo dispositivo: non viene inviata né salvata nei backup.
            </Feature>
            <Feature title="Erotismo, se vuoi" demo={<DemoErotismo />}>
              Un’area facoltativa in fondo al questionario, con categorie chiuse finché non le apri.
              Ogni risposta conta una volta sola nella compatibilità.
            </Feature>
          </Chapter>

          <Chapter value="dati" number={6} icon={Lock} title="I tuoi dati restano tuoi">
            <Feature title="Zero-server" demo={<DemoZeroServer />}>
              Le risposte restano nel tuo dispositivo. Nessun server centrale le raccoglie.
            </Feature>
            <Feature title="La scheda avatar" demo={<DemoBackupCard />}>
              È il backup del tuo profilo e la tua carta d’identità. Inviala come file originale,
              senza comprimerla. Chi la riceve vede il confronto anche offline.
            </Feature>
            <div role="note" className="tutorial-warning">
              <ShieldAlert size={18} className="shrink-0" aria-hidden="true" />
              <p className="text-[13px]">
                <strong>Nascondere non significa cifrare.</strong> Chi riceve la scheda può leggerla
                e inoltrarla: condividila solo con persone fidate.
              </p>
            </div>
            <Feature title="La tua collezione emoji" demo={<DemoEmojiCollection />}>
              Parti dalle 3 emoji del tuo handle e raccogli quelle delle persone con cui ti
              connetti. Le 9 emoji proposte all’inizio non cambiano se ricarichi la pagina.
            </Feature>
          </Chapter>
        </AccordionPrimitive.Root>

        <footer className="mt-6 rounded-2xl bg-background p-4 text-[12px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-2 px-2 py-1 font-semibold tracking-wide text-foreground">
              CC BY-NC-SA 4.0
            </span>
            <span>
              <strong className="text-accent">QuestionAR</strong> è un&apos;opera di Max Omimo ·{" "}
              <a
                href="https://maxomimo.org"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent underline"
              >
                maxomimo.org
              </a>
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-foreground">
              Dettagli della licenza
            </summary>
            <p className="mt-2">
              Quest&apos;opera è distribuita con licenza Creative Commons
              Attribuzione-NonCommerciale-CondividiAlloStessoModo 4.0 Internazionale. Per vedere una
              copia di questa licenza, visita{" "}
              <a
                href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.it"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                creativecommons.org/licenses/by-nc-sa/4.0/deed.it
              </a>
              . L&apos;utilizzo di quest&apos;opera deve essere in conformità con i termini della
              licenza, che includono l&apos;obbligo di fornire attribuzione al titolare del
              copyright originale, di non utilizzare l&apos;opera a scopo commerciale e di
              distribuire le eventuali modifiche all&apos;opera originale sotto la stessa licenza.
            </p>
          </details>
        </footer>

        <div className="mt-5 flex gap-3">
          <Button
            asChild
            variant="secondary"
            className="h-auto flex-1 rounded-2xl px-4 py-3 text-[16px]"
          >
            <a href="https://t.me/questionardate?direct" target="_blank" rel="noreferrer">
              Feedback
            </a>
          </Button>
          <Button onClick={onClose} className="h-auto flex-1 rounded-2xl px-4 py-3 text-[16px]">
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
