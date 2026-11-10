# Richieste ricevute da offline

QuestionAR non ha bisogno di restare aperta per ricevere le richieste di connessione.

- Le richieste (`request`, `keyx`, `preview`, `accept`) vengono conservate cifrate dal relay per
  **72 ore** (`TTL` in `src/lib/p2p.ts`, limite `MAX_TTL` in `relay/src/index.ts`) e consegnate al
  successivo `hello`, cioè alla riapertura dell'app.
- Presenza online: se l'app viene chiusa o la rete cade, il relay vede la chiusura del WebSocket e
  il profilo risulta offline in 1–2 secondi. Se il sistema congela l'app in background, la presenza
  scade dopo circa 90 s senza ping (controllo ogni 60 s): offline entro 1,5–2,5 minuti.

Il chiarimento per l'utente è in **Rubrica → Richieste** e nel capitolo «Connettersi e confrontare» del tutorial (Info).
La vecchia modalità "Resta in ascolto" è stata rimossa.
