import { Check, Eye, EyeOff, MessageSquare, QrCode, Sparkles, X, Zap } from "lucide-react";

import { Avatar } from "./Avatar";
import logo from "@/assets/questionar-logo.png.asset.json";

function DemoSlider() {
  return (
    <div className="rounded-2xl bg-background p-3">
      <p className="text-[12px] text-muted-foreground">Trascina per sfumare la risposta</p>
      <div className="relative mt-3 h-8">
        <div className="absolute inset-x-0 top-1/2 flex h-2.5 -translate-y-1/2 overflow-hidden rounded-full">
          <div className="relative h-full flex-1 bg-muted">
            <span className="demo-fill-left absolute inset-y-0" />
          </div>
          <div className="mx-px" />
          <div className="relative h-full flex-1 bg-muted">
            <span className="demo-fill-right absolute inset-y-0 left-0" />
          </div>
        </div>
        <div className="demo-thumb absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-md ring-2 ring-background">
          <X className="demo-glyph demo-glyph-cross" size={16} strokeWidth={3.5} />
          <span className="demo-glyph demo-glyph-question text-[13px] font-extrabold">?</span>
          <Check className="demo-glyph demo-glyph-check" size={16} strokeWidth={3.5} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-muted-foreground">
        <span>No · 0%</span>
        <span>Sì · 100%</span>
      </div>
    </div>
  );
}

function DemoCritical() {
  return (
    <div className="demo-critical rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[14px]">Vuoi convivere?</p>
        <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
          <Zap size={15} />
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Una domanda critica pesa molto di più nel calcolo.
      </p>
    </div>
  );
}

function DemoHidden() {
  return (
    <div className="rounded-2xl bg-background p-3">
      <div className="demo-hidden flex items-center gap-2 rounded-xl bg-surface p-2">
        <p className="flex-1 text-[14px]">Domanda riservata</p>
        <span className="grid size-8 place-items-center rounded-full bg-background text-muted-foreground">
          <EyeOff size={15} />
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground">
        <Eye size={13} /> Nascosta = fuori dai confronti e dal calcolo.
      </p>
    </div>
  );
}

function DemoComment() {
  return (
    <div className="rounded-2xl bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
          <MessageSquare size={15} />
        </span>
        <p className="demo-type overflow-hidden whitespace-nowrap text-[14px] italic text-muted-foreground">
          Dipende molto da come ci si organizza…
        </p>
      </div>
    </div>
  );
}

function DemoConnect() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-background p-3">
      <span className="demo-pop grid size-12 place-items-center rounded-2xl bg-surface-2 text-accent">
        <QrCode size={22} />
      </span>
      <span className="demo-pop demo-delay-1 rounded-2xl bg-surface-2 px-3 py-2 text-[14px] text-accent">
        @handle🦊🌙⭐
      </span>
      <span className="demo-pop demo-delay-2">
        <Avatar handle="questionar" size={44} />
      </span>
    </div>
  );
}

export function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom mt-6 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-popover p-5 shadow-2xl ring-1 ring-border"
      >
        <div className="mb-3 flex items-start gap-3">
          <img src={logo.url} alt="Logo QuestionAR" width={40} height={40} className="size-10 shrink-0 rounded-lg object-contain" />
          <h1 className="flex-1 text-2xl">QuestionAR</h1>
          <button
            aria-label="Chiudi le informazioni"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="text-[16px]">L’anti-dating app per connessioni reali</h2>
        <p className="mt-2 text-[14px]">
          QuestionAR nasce come reazione alla cultura dello swipe: quell'abitudine frenetica
          delle app tradizionali che riduce le persone a una galleria fotografica e a un
          giudizio estetico effimero.
        </p>
        <p className="mt-2 text-[14px]">
          QuestionAR è pensato prima di tutto per riflettere sul tuo tipo di relazione ideale,
          approfondendo insieme a chi stai conoscendo che tipo di compatibilità potreste avere.
        </p>

        <h2 className="mt-5 text-[16px]">Come funziona QuestionAR?</h2>

        <h3 className="mt-4 text-[16px]">1. Compilazione del Questionario</h3>
        <p className="mt-2 text-[14px]">
          <strong>Sfumature di risposta:</strong> Per ogni quesito puoi scegliere risposte
          secche (No = 0%, Sì = 100%) oppure regolare lo slider per rappresentare le tue
          sfumature di indecisione o preferenza.
        </p>
        <div className="mt-2">
          <DemoSlider />
        </div>

        <p className="mt-3 text-[14px]">
          <strong>Domande Critiche (Dealbreaker):</strong> Puoi contrassegnare determinati
          quesiti come "critici". Questo aumenterà la sensibilità dell'algoritmo nei calcoli di
          compatibilità, dando un peso maggiore alla vicinanza o distanza su quel tema
          specifico.
        </p>
        <div className="mt-2">
          <DemoCritical />
        </div>

        <p className="mt-3 text-[14px]">
          <strong>Controllo della Privacy:</strong> Puoi scegliere di nascondere singole
          domande. In questo modo non saranno visibili nei confronti e non influiranno sul
          calcolo della compatibilità.
        </p>
        <div className="mt-2">
          <DemoHidden />
        </div>

        <p className="mt-3 text-[14px]">
          <strong>Bio e Commenti:</strong> Usa i campi testo a tua disposizione nei commenti
          delle singole risposte e nella bio per contestualizzare le tue preferenze e
          raccontare le motivazioni dietro le tue scelte.
        </p>
        <div className="mt-2">
          <DemoComment />
        </div>

        <h3 className="mt-5 text-[16px]">2. Modalità di Connessione e Confronto</h3>
        <p className="mt-2 text-[14px]">
          Per aggiungere un nuovo profilo ed effettuare la comparazione dei dati, puoi
          utilizzare tre modalità:
        </p>
        <div className="mt-2">
          <DemoConnect />
        </div>
        <p className="mt-3 text-[14px]">
          <strong>Scanner QR (In presenza):</strong> Scansiona direttamente il codice QR
          mostrato sullo schermo dell'altra persona per un confronto immediato dal vivo.
        </p>
        <p className="mt-2 text-[14px]">
          <strong>Handle utente (A distanza):</strong> Inserisci e invia l'handle univoco
          completo della persona con cui stai comunicando.
        </p>
        <p className="mt-2 text-[14px]">
          <strong>File di Backup:</strong> Invia o carica il file della creatura avatar. Ti
          permetterà di confrontare subito i profili e rimandare la connessione a quando sarete
          online nello stesso momento.
        </p>
        <div className="mt-4 rounded-2xl bg-surface p-3">
          <p className="text-[14px]">
            <strong>Come avviene il confronto?</strong> Dopo aver scelto una modalità, i profili
            vengono confrontati domanda per domanda. Il cursore doppio mostra le vostre risposte
            affiancate e la compatibilità si calcola in base a quanto siete vicini su ogni tema.
          </p>
          <p className="mt-2 text-[14px]">
            <strong>La creatura avatar come ponte:</strong> il file PNG non è solo un’immagine,
            ma contiene i dati del profilo nascosti al suo interno. Puoi inviarlo come allegato o
            caricarlo dalla galleria: anche offline, potrai vedere il confronto. Quando poi sarai
            online, potrai trasformare quel confronto in una connessione P2P reale.
          </p>
        </div>

        <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-accent">
          <Sparkles size={16} /> Ogni nuova connessione arricchisce la tua collezione esclusiva
          di emoji!
        </p>

        <footer className="mt-8 rounded-2xl bg-surface p-4 text-[12px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden
              className="rounded-md bg-surface-2 px-2 py-1 font-semibold tracking-wide text-foreground"
            >
              CC BY-NC-SA 4.0
            </span>
            <span>
              <strong className="text-accent">QuestionAR</strong> è un&apos;opera di Max Omimo
            </span>
          </div>
          <p className="mt-3">
            Quest&apos;opera è distribuita con licenza Creative Commons
            Attribuzione-NonCommerciale-CondividiAlloStessoModo 4.0 Internazionale. Per vedere
            una copia di questa licenza, visita{" "}
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
          <a
            href="https://maxomimo.org"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block font-semibold text-accent underline"
          >
            maxomimo.org
          </a>
        </footer>

        <div className="mt-6 flex gap-3">
          <a
            href="https://t.me/maxomimo"
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-2xl bg-surface-2 px-4 py-3 text-center text-[16px] text-foreground"
          >
            Feedback
          </a>
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-accent px-4 py-3 text-[16px] text-accent-foreground"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
