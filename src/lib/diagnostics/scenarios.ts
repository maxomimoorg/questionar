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
  {
    id: "manual.categories",
    title: "Categorie: espandi/comprimi, conteggi, occultamento",
    prerequisites: ["Profilo di prova"],
    steps: [
      "Nel questionario, nel confronto, in Erotismo e nel confronto Erotismo usa «Espandi tutte» e «Comprimi tutte», anche con categorie miste",
      "Rispondi a 3 domande di una categoria e controlla il conteggio (es. 3/13); nascondi una domanda senza risposta (3/12) e una con risposta (2/11)",
      "Rispondi solo a «Fare» in una domanda doppia: non deve contare come completata",
      "Nascondi una domanda, poi la sua categoria; ripristina la categoria: la domanda resta tra le nascoste singolarmente",
      "Con la categoria nascosta, ripristina la singola domanda: resta nel gruppo della categoria nascosta",
      "Ripeti in Erotismo (se ha categorie) e verifica che la sezione vuota mostri un messaggio chiaro",
    ],
    expected:
      "Conteggi coerenti, spunta solo a completamento, elementi nascosti esclusi da conteggi e confronti, stato individuale mai sovrascritto.",
  },
  {
    id: "manual.erotismo-compare",
    title: "Confronto Erotismo e totale generale",
    prerequisites: ["Due profili di prova collegati"],
    steps: [
      "Apri il confronto e tocca la riga Erotismo",
      "Controlla compatibilità della sezione, per categoria e per domanda",
      "Esporta e reimporta il backup PNG: le categorie nascoste restano tali",
    ],
    expected: "Le domande di Erotismo contano una sola volta nel totale; i dati e le categorie nascoste sopravvivono a backup e scambio.",
  },
];
