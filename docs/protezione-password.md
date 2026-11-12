# Protezione con password

Ogni profilo può proteggere con una password **il questionario generale** (gestito in `/`) e,
con una password **separata e indipendente**, **il questionario Erotismo** (gestito in
`/erotismo`). L'architettura resta zero-server: cifratura e decifratura avvengono solo nel
browser, con la Web Crypto API.

La password non blocca l'app sul proprio dispositivo (il proprietario vede sempre tutto in
chiaro): protegge ciò che vedono gli altri nel confronto. La comunica direttamente il
proprietario a chi vuole.

## Cosa vede chi confronta

| Dato del questionario protetto                             | Senza password | Con la password |
| ---------------------------------------------------------- | -------------- | --------------- |
| Medie per categoria (e quindi istogramma e totale stimati) | sì, in chiaro  | sì              |
| Risposte, commenti, domande critiche e nascoste            | no, cifrati    | sì              |
| Domande personalizzate di quella sezione                   | no, cifrate    | sì              |
| Categorie nascoste (`hiddenCategories`), bio, tag, nome    | sì, in chiaro  | sì              |

Senza password i punteggi sono **stime dalle medie**: per ogni categoria si confrontano le due
medie (100 − distanza) e il risultato è contrassegnato con «≈». Le categorie con una sola domanda
rivelano di fatto quella risposta tramite la media: è una scelta voluta, senza mitigazioni.

## Due scomparti cifrati

Nel `ProfileSnapshot` (`src/lib/types.ts`) ogni sezione protetta occupa due campi:

- Generale: `mainAverages` (medie in chiaro) e `mainProtected`.
- Erotismo: `eroticAverages` (medie in chiaro) e `eroticProtected`.

Ogni box `{ salt, iv, ciphertext, keyVersion }` contiene `{ answers, customQuestions }` della
sola sezione. I campi in chiaro (`answers`, `customQuestions`) non contengono mai dati di una
sezione protetta. Senza password i dati restano nei campi in chiaro, come nelle versioni
precedenti; un'app più vecchia ignora i nuovi campi.

### Crittografia

- Derivazione: PBKDF2-HMAC-SHA-256, 600 000 iterazioni, salt casuale a 128 bit.
- Cifratura: AES-256-GCM, IV casuale a 96 bit **a ogni cifratura**, tag di 128 bit.
- Una password sbagliata (o un box alterato) produce l'errore controllato `WrongPasswordError`.

Implementazione: `src/lib/password-crypto.ts` (primitive) e `src/lib/protection.ts`
(scomparti, medie, ciclo di vita).

## Canali

Vale identico per entrambi i canali, perché tutti passano da `mySnapshot()` (sempre
asincrono e già cifrato) e da `sanitizeSnapshot`:

- **Handle / QR** (relay P2P): il profilo inviato contiene i box; il canale è inoltre cifrato
  end-to-end come prima.
- **Scheda avatar PNG** (steganografia): gli stessi campi finiscono nel backup. Reimportando il
  proprio backup su un altro dispositivo l'app chiede le proprie password per ripristinare anche
  le sezioni protette (e le riattiva con lo stesso `keyVersion`); si può saltare.

Le password in chiaro restano solo nello stato locale del proprietario (`protection`, in
IndexedDB): non entrano mai nello snapshot, nei messaggi P2P, nei backup o nella diagnostica.

## Ciclo di vita della password (`keyVersion`)

- Attivare o **modificare** la password genera un nuovo salt e incrementa `keyVersion`.
- **Rimuovere** la password riporta i dati in chiaro; se poi se ne imposta una nuova,
  `keyVersion` riparte dal valore successivo all'ultimo usato (mai riutilizzato).
- Chi riceve, dopo uno sblocco riuscito, salva in IndexedDB (database `questionar-unlocks`) la
  sola **chiave derivata non estraibile** associata a contatto + sezione + `keyVersion`: ai
  riavvii il questionario resta sbloccato. Quando il contatto cambia password (nuovo
  `keyVersion`) la chiave salvata viene eliminata e la password va reinserita.

## Tentativi errati

Ritardo progressivo sui tentativi errati consecutivi per contatto e sezione: 0 s, 1 s, 2 s,
poi 5 s. Un tentativo prima della scadenza non viene nemmeno provato.

## Confronto a due e a tre

- **A due**: se il questionario dell'altro è protetto, istogramma e totale usano le medie (≈);
  nell'elenco delle domande compare una card che chiede la password. Dopo lo sblocco appare il
  messaggio «Questionario sbloccato» e la card lascia il posto alle risposte normali.
- **A tre** (`/confronto?b=…&c=…`): ogni partecipante è gestito da solo. Sbloccare B non sblocca
  C; se entrambi sono protetti compaiono due card distinte. Le risposte di chi è sbloccato o non
  protetto restano visibili accanto alle tue anche se il terzo è ancora bloccato; le coppie che
  coinvolgono chi è bloccato sono stimate dalle medie.

## Interfaccia

- Pulsante a pillola a sinistra di «Espandi/Comprimi tutte» (`PasswordPill` in
  `src/components/CategoryControls.tsx`): «Proteggi con password» con lucchetto aperto, oppure
  «Password attiva» evidenziato con la chiave.
- Il modale mostra subito la password in chiaro con **Copia**, **Modifica** e **Rimuovi**.
- Tutorial: capitolo 6, «Proteggi con password», con la demo `DemoPasswordProtection`.

## Test

- `src/test/password-crypto.test.ts`: derivazione, cifratura/decifratura, password errata,
  indipendenza degli scomparti, nessuna password nello snapshot.
- `src/test/password-protection-ui.test.tsx`: pillola in `/` e `/erotismo`, modale, copia,
  modifica, rimozione.
- `src/test/compare-password.test.ts`: medie + card, sblocco, ritardo progressivo, persistenza e
  invalidazione per `keyVersion`, confronto a tre.
