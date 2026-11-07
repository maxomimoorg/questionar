# Standby Sentinella Connessioni

Attivazione manuale: **Rubrica → Richieste → "Resta in ascolto"**. Codice: `src/lib/sentinel.ts`
(logica, API del browser iniettabili per i test) e `src/components/ConnectionSentinel.tsx` (vista).

All'attivazione (serve un tocco dell'utente):

1. **Notifiche** — `Notification.requestPermission()`; se concesse, ogni nuova richiesta in arrivo
   genera una notifica locale (via service worker quando disponibile, necessario su mobile).
   Toccando la notifica si torna all'app.
2. **Screen Wake Lock** — `navigator.wakeLock.request("screen")`; il browser lo rilascia quando la
   scheda va in secondo piano, quindi viene riacquisito al ritorno in primo piano.
3. **Vista a risparmio energetico** — schermo nero (pixel OLED spenti) con testo attenuato e una
   lenta deriva anti burn-in: tempo di ascolto, stato del relay, contatore richieste in arrivo.
   Se il browser supporta Document Picture-in-Picture compare "Mini finestra".
4. **Keep-alive** — ogni 20 s un ping sul WebSocket del relay (il relay risponde `pong` senza
   risvegliare lo storage); se il collegamento è caduto, viene tentata la riconnessione.
5. **Termina standby** — ferma il battito, chiude la mini finestra e rilascia il wake lock.

Vincoli: nessun nuovo server o dipendenza, solo il relay Cloudflare esistente. Il sistema operativo
può comunque sospendere la pagina (schermo bloccato, risparmio batteria aggressivo).
