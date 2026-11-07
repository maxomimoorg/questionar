# Modalità diagnostica locale

Attivazione: 5 tap rapidi (pause ≤ 0,8 s, entro 3 s) sul titolo "QuestionAR" nel popup Info.
Una barra rossa fissa indica la modalità attiva e permette di terminarla.

Flusso: 1) controlli automatici → 2) checklist manuale → 3) riepilogo. Il file viene scaricato solo con
"Esporta report diagnostico". "Cancella dati diagnostici" e "Termina" eliminano buffer, esiti e il
database di prova `questionar-diagnostics`. Nulla viene inviato in rete; i dati dell'app non vengono letti né modificati.

## Report (`schema: questionar-diagnostics`, `version: 1`)

| Campo | Significato |
|---|---|
| `session` | id effimero (non persistente), inizio/fine ISO |
| `app` | `version`: versione reale dell'app letta da `package.json` al build (`vite.config.ts` la inietta come `VITE_APP_VERSION`; `unknown` solo se manca); `build`: modalità di build |
| `platform` | famiglia browser, versione principale, sistema operativo (niente user agent completo) |
| `checks[]` | `id` stabile, `status` (`pass`/`fail`/`skip`/`not_applicable`), `durationMs`, `code` normalizzato, `facts` tecnici; `source: automatic` |
| `scenarios[]` | esito dichiarato (`passed`/`failed`/`not_run`/`not_applicable`), atteso, passaggi svolti, nota filtrata; `source: manual_declared` |
| `events[]` | max 200 eventi / 30 min da una lista consentita (relay, p2p, rete, visibilità, errori normalizzati) |
| `summary` | conteggi per esito |
| `limits` | cosa il report **non** attesta |

`skip` significa non eseguito o non verificabile in questo contesto (es. service worker in sviluppo,
nessun endpoint relay di test sicuro): non è un successo. I backup restano non cifrati.
