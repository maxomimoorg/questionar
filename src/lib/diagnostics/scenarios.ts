import type { ScenarioDef } from "./types";

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "manual.navigation",
    title: "Apertura, ricarica e navigazione",
    prerequisites: ["App aperta nel browser", "Facoltativo: PWA installata"],
    steps: [
      "Apri l'app e attendi il caricamento completo",
      "Ricarica la pagina",
      "Naviga tra Questionario, Rubrica e Confronto",
      "Ripeti dalla PWA installata, se disponibile",
    ],
    expected: "Ogni pagina si apre senza errori né schermate vuote, anche dopo la ricarica.",
  },
  {
    id: "manual.offline",
    title: "Offline e recupero della connessione",
    prerequisites: ["App caricata almeno una volta in versione pubblicata"],
    steps: [
      "Disattiva la rete (modalità aereo o DevTools → Offline)",
      "Ricarica l'app e naviga tra le pagine",
      "Riattiva la rete",
      "Verifica che lo stato di connessione torni disponibile",
    ],
    expected: "L'app si apre offline dalla cache e si riconnette senza intervento al ritorno della rete.",
  },
  {
    id: "manual.persistence",
    title: "Persistenza dopo ricarica",
    prerequisites: ["Preferibilmente un profilo di prova (profilo browser separato)"],
    steps: ["Modifica una risposta di prova", "Ricarica la pagina", "Controlla che la modifica sia presente"],
    expected: "La modifica resta salvata; nessun dato reale viene cancellato.",
  },
  {
    id: "manual.backup",
    title: "Backup PNG: esporta, importa, rifiuta file non valido",
    prerequisites: ["Profilo di prova", "Un'immagine PNG qualsiasi non generata dall'app"],
    steps: [
      "Esporta il backup PNG",
      "Importa il backup appena esportato",
      "Prova a importare il PNG non valido",
    ],
    expected: "Il backup valido viene ripristinato; il file non valido viene rifiutato con un messaggio chiaro.",
  },
  {
    id: "manual.relay",
    title: "Connessione e riconnessione relay/WebRTC",
    prerequisites: ["Due profili di prova su dispositivi o profili browser separati", "Nessun contatto reale"],
    steps: [
      "Collega i due profili di prova",
      "Interrompi la rete su uno dei due e ripristinala",
      "Verifica che la connessione si ristabilisca",
    ],
    expected: "La connessione torna attiva senza duplicati né perdite di stato.",
  },
  {
    id: "manual.a11y",
    title: "Tastiera e leggibilità degli errori",
    prerequisites: [],
    steps: [
      "Usa solo Tab, Maiusc+Tab, Invio ed Esc per navigare e aprire/chiudere il popup informativo",
      "Provoca un errore visibile (es. importa un file non valido)",
    ],
    expected: "Il focus è sempre visibile e non resta intrappolato; i messaggi d'errore sono chiari e leggibili.",
  },
];
