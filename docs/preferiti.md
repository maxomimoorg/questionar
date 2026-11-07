# Preferiti (locali)

La stella sui contatti è un'etichetta **locale e riservata** (`Contact.favorite`):

- si attiva/disattiva dalla pagina di confronto ("Aggiungi/Rimuovi dai preferiti");
- in Rubrica i preferiti sono mostrati per primi con una piccola stella;
- non fa parte di `ProfileSnapshot`: non viaggia via P2P, non finisce nei backup PNG.

La vecchia funzione "Profili consigliati" (lista pubblica `recommends` nello snapshot) è stata
rimossa. Per compatibilità con versioni precedenti `sanitizeSnapshot()` scarta il campo `recommends`
sia in uscita sia in entrata e al caricamento dei dati salvati; i vecchi contatti marcati come
"consigliati" diventano preferiti locali (`migrateContact`).

## Onboarding: griglia emoji congelata

Le 9 emoji proposte al primo accesso vengono salvate in `localStorage`
(`questionar_onboarding_grid`) e riutilizzate a ogni ricarica finché il profilo non è creato;
la chiave viene rimossa solo dopo la creazione riuscita dell'identità (`src/lib/onboarding-grid.ts`).
