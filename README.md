# QuestionAR

L'anti-dating app per connessioni reali: questionario di compatibilità, 100% zero-server
(dati in IndexedDB, scambio P2P cifrato tramite il relay Cloudflare in `relay/`, backup PNG steganografici).
Il questionario generale ed Erotismo si possono proteggere con due password indipendenti: gli altri
vedono medie per ruolo e dispersione per categoria, mentre risposte, commenti e domande personalizzate viaggiano cifrati
(PBKDF2 + AES-256-GCM).

## Documentazione

Il [manuale unico di QuestionAR](docs/DOCUMENTAZIONE.md) raccoglie la documentazione
funzionale e tecnica, con indice interno e rimandi al codice.

- [Architettura, dati locali, P2P e backup PNG](docs/DOCUMENTAZIONE.md#architettura)
- [Avvio e funzionamento offline](docs/DOCUMENTAZIONE.md#avvio-offline)
- [Questionario, categorie ed Erotismo](docs/DOCUMENTAZIONE.md#categorie)
- [Domande Fare/Ricevere e calcolo incrociato](docs/DOCUMENTAZIONE.md#reciprocita)
- [Protezione con password e sblocchi](docs/DOCUMENTAZIONE.md#password)
- [Sicurezza e integrità dei dati](docs/DOCUMENTAZIONE.md#sicurezza)
- [Rubrica, preferiti e onboarding](docs/DOCUMENTAZIONE.md#rubrica)
- [Modalità diagnostica](docs/DOCUMENTAZIONE.md#diagnostica)
- [Sviluppo, test e mappa del codice](docs/DOCUMENTAZIONE.md#sviluppo)

Le [attività aperte](roadmap.md) restano separate dal manuale; le istruzioni per chi
modifica il progetto sono in [AGENTS.md](AGENTS.md).

## Sviluppo

```sh
bun install
bun run dev
bun run test
```

La versione mostrata nel report diagnostico è il campo `version` di `package.json`.

Costruito con TanStack Start, React, TypeScript e Tailwind CSS.
