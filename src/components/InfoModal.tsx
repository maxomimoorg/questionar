import { ArrowRight, Check, Eye, EyeOff, Inbox, MessageSquare, Plus, QrCode, ShieldCheck, Sparkles, Star, Users, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PROFILE_TAGS, ProfileTagChip } from "./ProfileTags";
import { nextTagState, type ProfileTags } from "@/lib/profile-tags";

import { Avatar } from "./Avatar";
import { MarginText } from "./MarginText";
import { percentColor } from "@/lib/color";
import { reciprocalFlows } from "@/lib/compat";
import { createTapCounter } from "@/lib/diagnostics/activation";
import { startDiagnostics } from "@/lib/diagnostics/session";

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

type DemoAnswer = { value: number; answered: true; giveValue?: number; receiveValue?: number };

const RECIPROCAL_SCENARIOS: { label: string; me: DemoAnswer; other: DemoAnswer }[] = [
  {
    label: "Vi completate",
    me: { value: 55, answered: true, giveValue: 90, receiveValue: 20 },
    other: { value: 55, answered: true, giveValue: 20, receiveValue: 90 },
  },
  {
    label: "Entrambi solo fare",
    me: { value: 50, answered: true, giveValue: 100, receiveValue: 0 },
    other: { value: 50, answered: true, giveValue: 100, receiveValue: 0 },
  },
  {
    label: "Risposta a metà",
    me: { value: 80, answered: true, giveValue: 80 },
    other: { value: 45, answered: true, giveValue: 20, receiveValue: 70 },
  },
];

/** Uses the real reciprocal maths so the tutorial shows the same numbers as the comparison. */
export function DemoReciprocal() {
  const [index, setIndex] = useState(0);
  const scenario = RECIPROCAL_SCENARIOS[index]!;
  const flows = reciprocalFlows(scenario.me, scenario.other, 0);
  const bar = (label: string, value: number | undefined) => (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-full bg-muted">
        {value !== undefined && (
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${value}%`, backgroundColor: percentColor(value) }}
          />
        )}
      </div>
      <b className="w-9 text-right tabular-nums">{value === undefined ? "–" : `${value}%`}</b>
    </div>
  );
  const flow = (value: number | null) =>
    value === null ? (
      <span className="text-muted-foreground">in attesa di risposta</span>
    ) : (
      <b style={{ color: percentColor(value) }}>{value}%</b>
    );
  return (
    <div className="rounded-2xl bg-background p-3">
      <p className="text-[14px]">Contatto fisico</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold">Io</p>
          {bar("Fare", scenario.me.giveValue)}
          {bar("Ricevere", scenario.me.receiveValue)}
        </div>
        <div className="space-y-1">
          <p className="text-[12px] font-semibold">Luna</p>
          {bar("Fare", scenario.other.giveValue)}
          {bar("Ricevere", scenario.other.receiveValue)}
        </div>
      </div>
      <div className="mt-3 space-y-0.5 text-[12px]">
        <p>Io faccio ➔ Luna riceve: {flow(flows.aToB)}</p>
        <p>Luna fa ➔ io ricevo: {flow(flows.bToA)}</p>
        <p className="text-[14px]">
          Compatibilità:{" "}
          <b
            style={{
              color:
                flows.score === null ? "var(--color-muted-foreground)" : percentColor(flows.score),
            }}
            data-testid="demo-reciprocal-score"
          >
            {flows.score === null ? "–" : `${flows.score}%`}
          </b>
          <MarginText result={flows} />
        </p>
        {flows.partial && (
          <p className="text-muted-foreground">
            Stima parziale: non hai ancora risposto a “Ricevere”, quindi conta solo un verso.
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Esempi di reciprocità">
        {RECIPROCAL_SCENARIOS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={`rounded-full px-3 py-1 text-[12px] ${
              i === index ? "bg-accent text-accent-foreground" : "bg-surface-2 text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
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

export function DemoFavorite() {
  const [favorite, setFavorite] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-background p-3">
      <Avatar handle="luna" size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">Luna</p>
        <p className="text-[12px] text-muted-foreground">{favorite ? "Tra i tuoi preferiti" : "Contatto"}</p>
      </div>
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
        onClick={() => setFavorite((v) => !v)}
        className={`grid size-9 place-items-center rounded-full ${favorite ? "bg-accent text-accent-foreground" : "bg-surface-2 text-accent"}`}
      >
        <Star size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function DemoProfileTags() {
  const [tags, setTags] = useState<ProfileTags>({ vegan: true, tabacco: "cross" });
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Prova i tag del profilo">
        {PROFILE_TAGS.filter((tag) => tag.id === "vegan" || tag.id === "tabacco").map((tag) => (
          <ProfileTagChip key={tag.id} tag={tag} value={tags[tag.id]} onClick={() => setTags((current) => ({ ...current, [tag.id]: nextTagState(current[tag.id]) }))} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">Spunta → divieto → senza risposta. Nessuna etichetta è definitiva.</p>
    </div>
  );
}

export function InfoModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const tapCounter = useRef(createTapCounter());
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]');
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);
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
        className="info-scroll safe-bottom mt-6 max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl outline-none ring-1 ring-border"
      >
        <div className="mb-3 flex items-start gap-3">
          <img src="/logo.png" alt="Logo QuestionAR" width={40} height={40} className="size-10 shrink-0 rounded-lg object-contain" />
          <h1
            id="questionar-info-title"
            className="flex-1 select-none text-2xl"
            onClick={() => {
              if (tapCounter.current.tap()) {
                startDiagnostics();
                onClose();
              }
            }}
          >
            QuestionAR
          </h1>
          <Button variant="secondary" size="icon"
            aria-label="Chiudi le informazioni"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-surface-2 text-accent"
          >
            <X size={18} />
          </Button>
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
          <strong>Somiglianza o reciprocità:</strong> la maggior parte delle domande misura
          quanto vi somigliate su valori e stile di vita: più le risposte sono vicine, più siete
          compatibili. Alcune domande, invece, parlano di qualcosa che si <em>dà</em> e si{" "}
          <em>riceve</em>: linguaggi d’amore, intimità fisica ed emotiva, supporto economico.
          Lì trovi <strong>due slider, “Fare” e “Ricevere”</strong>.
        </p>
        <p className="mt-2 text-[14px]">
          Nel confronto non si paragonano tra loro i due “Fare”, ma quanto tu ami fare con
          quanto l’altra persona ama ricevere, e viceversa. Se a entrambi piace solo dare e a
          nessuno ricevere, sulla carta vi somigliate, ma nella realtà nessuno dei due si sente
          accolto: la reciprocità lo mette in luce. Le regole del calcolo e delle domande
          critiche restano le stesse.
        </p>
        <p className="mt-2 text-[14px]">
          Puoi anche rispondere a uno solo dei due slider: la domanda vale come{" "}
          <strong>risposta parziale</strong>. Il confronto usa solo il verso che si può
          calcolare e mostra la compatibilità come <strong>stima</strong>, seguita in grigio dal
          margine d'errore con “±” (per esempio 90% ±45%): è quanto potrebbe cambiare il
          risultato quando arriverà la risposta mancante. Anche le medie di categoria e il
          totale mostrano il loro margine.
        </p>
        <div className="mt-2">
          <DemoReciprocal />
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
          <strong>Commenti alle risposte:</strong> Un numero non racconta tutto. Aggiungi un
          commento per dare contesto alle tue preferenze e alle motivazioni dietro le tue scelte.
        </p>
        <div className="mt-2">
          <DemoComment />
        </div>

        <h3 className="mt-5 text-[16px]">2. Tag del profilo: stili di vita e preferenze rapide</h3>
        <p className="mt-2 text-[14px]">
          Vegan, tabacco, non-monogamia, prole, queer e gli altri tag raccontano a colpo
          d’occhio cosa ti caratterizza. Un tocco conferma con la <strong>spunta</strong>;
          un secondo indica disinteresse o rifiuto con il <strong>simbolo di divieto</strong>;
          un terzo rimuove la scelta e torna a <strong>senza risposta</strong>.
          Non rispondere non significa dire no.
        </p>
        <div className="mt-2"><DemoProfileTags /></div>
        <p className="mt-2 text-[14px]">
          I tag scelti sono visibili nel tuo profilo, nei confronti diretti e impressi
          nella scheda avatar PNG: piccoli segnali, non scatole in cui rinchiuderti.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><Plus size={18} className="shrink-0" />3. Domande personalizzate e Bio</h3>
        <p className="mt-2 text-[14px]">
          Le domande standard non ti bastano? Con il tasto <strong>+</strong> puoi creare
          un quesito tutto tuo e scegliere la categoria appropriata. Porta nel confronto
          quello che conta davvero per te, anche quando non rientra nei copioni abituali.
        </p>
        <p className="mt-2 text-[14px]">
          Scegli anche il <strong>tipo</strong>: <strong>Normale</strong> (predefinito) ha un
          solo cursore e premia le risposte vicine; <strong>Complementare</strong> ha due
          cursori, <strong>Fare</strong> e <strong>Ricevere</strong>, confrontati in modo
          incrociato come le domande a reciprocità, con stime e margine d’errore se manca un lato.
        </p>
        <p className="mt-2 text-[14px]">
          La <strong>Bio</strong> non è un semplice blocco di testo: hai fino a
          <strong> 666 caratteri</strong> e un editor con titoli, stili, link e colori.
          Dai forma alla tua identità, senza ridurla a uno slogan.
        </p>

        <h3 className="mt-5 text-[16px]">4. Modalità di Connessione e Confronto</h3>
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
            Nelle domande con “Fare” e “Ricevere” vedi invece due tracce incrociate,
            <em> “Io faccio ➔ Luna riceve”</em> e <em>“Luna fa ➔ io ricevo”</em>, ciascuna con
            il proprio punteggio: la compatibilità della domanda è la loro media. Se manca un
            “Fare” o un “Ricevere”, quel verso resta “in attesa di risposta” e la
            compatibilità diventa una stima parziale.
          </p>
          <p className="mt-2 text-[14px]">
            <strong>La creatura avatar come ponte:</strong> il file PNG non è solo un’immagine,
            ma contiene i dati del profilo nascosti al suo interno. Puoi inviarlo come allegato o
            caricarlo dalla galleria: anche offline, potrai vedere il confronto. Quando poi sarai
            online, potrai trasformare quel confronto in una connessione P2P reale.
          </p>
        </div>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><Users size={18} className="shrink-0" />5. Confronto a tre e compatibilità per categoria</h3>
        <p className="mt-2 text-[14px]">
          Non tutte le connessioni sono a due. Puoi aggiungere un <strong>terzo profilo</strong>{" "}
          contemporaneamente e confrontare le risposte di tre persone: spazio anche alle
          dinamiche di gruppo e alle relazioni poliamorose, senza dare per scontato un unico modello.
        </p>
        <p className="mt-2 text-[14px]">
          La percentuale di compatibilità non è solo globale: trovi un indice per
          <strong> ogni categoria tematica</strong>. Puoi cliccare su qualsiasi quesito per
          approfondire le risposte dell’altra persona. Il numero apre una conversazione,
          non decide al posto vostro.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><ShieldCheck size={18} className="shrink-0" />6. Zero-server e scheda steganografica</h3>
        <p className="mt-2 text-[14px]">
          Nessun server centrale raccoglie le tue risposte intime: i dati restano nel tuo
          <strong> browser e dispositivo, in IndexedDB</strong>. Sei tu a decidere con chi
          condividerli. Scegli persone fidate e non far girare il tuo profilo incontrollatamente sul web:
          chi riceve la scheda può leggerne i dati e inoltrarla.
        </p>
        <p className="mt-2 text-[14px]">
          La scheda PNG è una sorta di <strong>“carta d’identità crittografica”</strong> del
          profilo, con la tua chiave pubblica e le risposte nascoste nei pixel tramite
          <strong> steganografia</strong>. Nascondere non significa cifrare: tratta il file
          con la stessa cura che riservi alle tue risposte.
        </p>
        <p className="mt-2 text-[14px]">
          Scambiala come file originale via chat, email o trasferimento diretto, senza
          comprimerla o modificarla: le alterazioni dei pixel possono rovinare i dati.
          Una volta ricevuta, puoi caricarla e vedere la compatibilità anche
          <strong> completamente offline</strong>, senza aspettare che l’altra persona sia online.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><Sparkles size={18} className="shrink-0" />7. La tua collezione emoji</h3>
        <p className="mt-2 text-[14px]">
          Parti dalle <strong>tre emoji del tuo handle</strong>. Ogni connessione scambiata
          ti permette di collezionare anche le emoji dei profili collegati, visibili nella
          tua <strong>Rubrica</strong>. Una piccola costellazione delle persone incontrate,
          non una classifica di conquiste.
        </p>
        <p className="mt-2 text-[14px]">
          Le <strong>9 emoji proposte</strong> alla creazione del profilo restano le stesse
          anche se ricarichi la pagina o riapri il browser: niente “rilanci” a caso per pescare
          quelle rare. Vengono sostituite solo dopo che il profilo è stato creato.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><Star size={18} className="shrink-0" />8. Preferiti: solo per te</h3>
        <p className="mt-2 text-[14px]">
          Nella pagina di confronto la stella serve ad <strong>aggiungere o rimuovere dai
          preferiti</strong> un contatto. In Rubrica i preferiti compaiono per primi, con una
          piccola stella accanto alla compatibilità, così trovi subito le persone chiave.
        </p>
        <div className="mt-2"><DemoFavorite /></div>
        <p className="mt-2 text-[14px]">
          È un’etichetta <strong>locale e riservata</strong>: resta solo sul tuo dispositivo, non
          viene inviata ai contatti né inserita nei backup PNG.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><Inbox size={18} className="shrink-0" />9. Richieste anche da offline</h3>
        <p className="mt-2 text-[14px]">
          Non serve tenere l’app sempre aperta. Se la chiudi o il telefono la mette in pausa, le
          richieste di connessione che ricevi restano in attesa, cifrate, per <strong>72 ore</strong>{" "}
          e ti arrivano appena riapri QuestionAR: le trovi in <strong>Rubrica → Richieste</strong>.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><EyeOff size={18} className="shrink-0" />10. Categorie: aprire, contare, nascondere</h3>
        <p className="mt-2 text-[14px]">
          Il pulsante <strong>«Espandi tutte» / «Comprimi tutte»</strong> apre o chiude in un colpo
          tutte le categorie, sia nel questionario sia nel confronto. Accanto a ogni categoria vedi
          quante domande hai completato su quelle visibili (es. <strong>3/12</strong>); quando le hai
          completate tutte compare la spunta (<strong>12 ✓</strong>). Una domanda Fare/Ricevere conta
          come completata solo con entrambi gli slider.
        </p>
        <p className="mt-2 text-[14px]">
          Con l’occhio nell’intestazione puoi <strong>nascondere un’intera categoria</strong>: le sue
          domande escono da conteggi e confronti. Le domande che avevi nascosto una a una restano
          nascoste anche quando ripristini la categoria. Tutto si ritrova nella sezione{" "}
          <strong>Categorie e domande nascoste</strong>, con comandi separati per ripristinare la
          categoria intera o la singola domanda.
        </p>

        <h3 className="mt-5 flex items-center gap-2 text-[16px]"><ArrowRight size={18} className="shrink-0" />11. Sezione facoltativa Erotismo</h3>
        <p className="mt-2 text-[14px]">
          In fondo al questionario trovi l’accesso a <strong>Erotismo</strong>: un’area facoltativa,
          organizzata per categorie che restano chiuse finché non scegli di aprirle. Non serve per
          completare il questionario principale. Nel confronto ha una pagina dedicata; le sue
          risposte contano una sola volta nella compatibilità generale.
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
          <Button asChild variant="secondary" className="flex-1 rounded-2xl px-4 py-3 text-[16px] h-auto"><a
            href="https://t.me/maxomimo"
            target="_blank"
            rel="noreferrer"
          >
            Feedback
          </a></Button>
          <Button
            onClick={onClose}
            className="h-auto flex-1 rounded-2xl px-4 py-3 text-[16px]"
          >
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
