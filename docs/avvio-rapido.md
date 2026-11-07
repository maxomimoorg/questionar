# Avvio rapido e offline

## Caratteri inclusi nell'app

Nunito (400, 600, 700) e Quicksand (500, 600, 700) arrivano dai pacchetti `@fontsource/nunito` e
`@fontsource/quicksand`, importati in cima a `src/styles.css` (solo il sottoinsieme latino, che copre
l'italiano). Vengono pubblicati insieme all'app: all'avvio non c'è nessuna richiesta a Google Fonts.

## Service worker (`public/sw.js`)

| Risorsa | Strategia |
| --- | --- |
| Pagine (`/`, `/rubrica`, `/confronto`) | Rete prima; dopo 2,5 s senza risposta si mostra la copia salvata, che la rete aggiorna in background. Offline: copia salvata. |
| File di build con hash (`/assets/…`, inclusi i font) | Cache prima: il nome cambia quando cambia il contenuto. |
| Altri file statici (icone, manifest, logo) | Copia salvata subito, aggiornata in background. |

Le pagine non vengono servite dalla cache quando la rete risponde in tempo: così puntano sempre a
script presenti sul server dopo un nuovo deploy.

## Dove non si registra

La registrazione avviene solo in `src/lib/sw-register.ts`. Non si registra in sviluppo, dentro un
iframe, sugli host di anteprima Lovable o con `?sw=off` (che rimuove anche il worker e le cache
`questionar-*`). Per forzare l'aggiornamento dopo una modifica al worker, incrementa `CACHE`.
