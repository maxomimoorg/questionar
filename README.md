# QuestionAR

L'anti-dating app per connessioni reali: questionario di compatibilità, 100% zero-server
(dati in IndexedDB, scambio P2P cifrato tramite il relay Cloudflare in `relay/`, backup PNG steganografici).

## Documentazione

- [Modalità diagnostica](docs/diagnostics.md)
- [Richieste ricevute da offline](docs/richieste-offline.md)
- [Preferiti locali e griglia emoji dell'onboarding](docs/preferiti.md)
- [Avvio rapido, caratteri inclusi e offline](docs/avvio-rapido.md)
- [Domande a reciprocità Fare/Ricevere e calcolo incrociato](docs/reciprocita.md)

## Sviluppo

```sh
bun install
bun run dev
bun run test
```

La versione mostrata nel report diagnostico è il campo `version` di `package.json`.

Costruito con TanStack Start, React, TypeScript e Tailwind CSS.
