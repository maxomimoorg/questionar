# QuestionAR — Documentazione

Documentazione tecnica e funzionale unica di QuestionAR. Ogni sezione ha un'ancora stabile
(`#nome-sezione`) da usare nei link, nel codice e nei report.

**Ultimo aggiornamento:** 13 novembre 2026. [Torna al README](../README.md).

**Versione dell'app:** campo `version` di `package.json` (unica fonte, vedi [Modalità diagnostica](#diagnostica)).

## Indice

1. [Architettura zero-server](#architettura)
   - [Dati locali e un profilo per dispositivo](#dati-locali)
   - [Connessioni P2P e relay](#p2p)
   - [Richieste ricevute da offline e presenza](#richieste-offline)
   - [Backup con scheda PNG](#backup-png)
2. [Avvio rapido e funzionamento offline](#avvio-offline)
   - [Caratteri inclusi](#caratteri)
   - [Service worker](#service-worker)
3. [Questionario e categorie](#categorie)
   - [Espandi / Comprimi tutte](#espandi-comprimi)
   - [Conteggio del completamento](#completamento)
   - [Nascondere categorie e domande](#nascondere)
   - [Erotismo](#erotismo)
4. [Domande a reciprocità (Fare / Ricevere)](#reciprocita)
   - [Elenco delle domande](#reciprocita-elenco)
   - [Domande personalizzate: Normale o Complementare](#reciprocita-personalizzate)
   - [Calcolo incrociato](#reciprocita-calcolo)
   - [Risposte parziali e margine d'errore](#reciprocita-parziali)
   - [Dati e compatibilità](#reciprocita-dati)
   - [Interfaccia](#reciprocita-interfaccia)
5. [Protezione con password](#password)
   - [Cosa vede chi confronta](#password-visibilita)
   - [Scomparti cifrati e crittografia](#password-crittografia)
   - [Canali: handle/QR e scheda PNG](#password-canali)
   - [Ciclo di vita (`keyVersion`) e sblocchi salvati](#password-ciclo)
   - [Tentativi errati](#password-tentativi)
   - [Confronto a due e a tre](#password-confronto)
   - [Interfaccia](#password-interfaccia)
6. [Sicurezza e integrità dei dati](#sicurezza)
7. [Rubrica, preferiti e onboarding](#rubrica)
8. [Modalità diagnostica](#diagnostica)
9. [Sviluppo e test](#sviluppo)
   - [Mappa del codice](#mappa-codice)
10. [Compatibilità con versioni precedenti (riepilogo)](#compatibilita)
11. [Come aggiornare questa documentazione](#manutenzione)

---

<a id="architettura"></a>

## 1. Architettura zero-server

QuestionAR non ha un server che conserva i profili: tutto vive nel browser dell'utente.

<a id="dati-locali"></a>

### Dati locali e un profilo per dispositivo

- Il profilo (risposte, bio, tag, contatti, password del proprietario) è salvato in **IndexedDB**
  (`src/lib/db.ts`, `src/lib/store.tsx`).
- **Un profilo per dispositivo.** L'uso contemporaneo dello stesso profilo su più dispositivi non è
  previsto: il backup serve a ripristinare o migrare i dati in un altro profilo, con un altro handle.
  La sincronizzazione multidispositivo è rimandata (vedi [roadmap](../roadmap.md)).
- Ciò che lascia il dispositivo è sempre un `ProfileSnapshot` (`src/lib/types.ts`), filtrato da
  `sanitizeSnapshot()` sia in uscita sia in entrata.

<a id="p2p"></a>

### Connessioni P2P e relay

- I messaggi tra profili passano dal relay Cloudflare in `relay/` (WebSocket), cifrati end-to-end:
  il relay usa identificativi di stanza derivati dall'handle, anziché l'handle in chiaro.
  Questo non rende anonima la connessione: il relay osserva presenza, destinazioni e metadati
  del traffico; gli identificativi sono deterministici, non segreti.
- Per lo scambio diretto si usa WebRTC con il solo server STUN `stun:stun.cloudflare.com:3478`
  (`src/lib/p2p.ts`).
- Gli inviti via QR (`/rubrica?handle=…`) sono conservati in `localStorage` da `src/lib/qr-invite.ts`
  e inviati appena il relay è connesso: sopravvivono a onboarding, ricariche e periodi offline.

<a id="richieste-offline"></a>

### Richieste ricevute da offline e presenza

QuestionAR non ha bisogno di restare aperta per ricevere le richieste di connessione.

- Le richieste (`request`, `keyx`, `preview`, `accept`) vengono conservate cifrate dal relay per
  **72 ore** (`TTL` in `src/lib/p2p.ts`, limite `MAX_TTL` in `relay/src/index.ts`) e consegnate al
  successivo `hello`, cioè alla riapertura dell'app. `offer`/`answer` WebRTC durano 120 s.
- Presenza online: se l'app viene chiusa o la rete cade, il relay vede la chiusura del WebSocket e
  il profilo risulta offline in 1–2 secondi. Se il sistema congela l'app in background, la presenza
  scade dopo circa 90 s senza ping (controllo ogni 60 s): normalmente entro 1,5–2,5 minuti,
  senza una garanzia temporale in caso di problemi di rete o sospensione del servizio.
- Il chiarimento per l'utente è in **Rubrica → Richieste** e nel capitolo «Connettersi e confrontare»
  del tutorial (Info). La vecchia modalità «Resta in ascolto» è stata rimossa.

<a id="backup-png"></a>

### Backup con scheda PNG

- Il backup è un'immagine PNG generata dall'app (scheda avatar) con il profilo nascosto nei bit
  meno significativi (steganografia LSB, senza perdita). Funziona offline, avatar compreso.
- Va condiviso **come file**: l'invio come «foto» nelle chat comprime l'immagine e distrugge i dati.
- Importare un backup **ripristina** il profilo, non sincronizza. Se il backup contiene sezioni
  protette, l'app chiede le proprie password per ripristinarle (vedi [Canali](#password-canali)).
- Il backup nel suo insieme non è cifrato: lo sono solo le sezioni protette da password.

---

<a id="avvio-offline"></a>

## 2. Avvio rapido e funzionamento offline

<a id="caratteri"></a>

### Caratteri inclusi

Nunito (400, 600, 700) e Quicksand (500, 600, 700) arrivano dai pacchetti `@fontsource/nunito` e
`@fontsource/quicksand`, importati in cima a `src/styles.css` (solo il sottoinsieme latino, che copre
l'italiano). Vengono pubblicati insieme all'app: all'avvio non c'è nessuna richiesta a Google Fonts.

<a id="service-worker"></a>

### Service worker (`public/sw.js`)

| Risorsa                                              | Strategia                                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pagine (`/`, `/rubrica`, `/confronto`)               | Rete prima; dopo 2,5 s senza risposta si mostra la copia salvata, che la rete aggiorna in background. Offline: copia salvata. |
| File di build con hash (`/assets/…`, inclusi i font) | Cache prima: il nome cambia quando cambia il contenuto.                                                                       |
| Altri file statici (icone, manifest, logo)           | Copia salvata subito, aggiornata in background.                                                                               |

Le pagine non vengono servite dalla cache quando la rete risponde in tempo: così puntano sempre a
script presenti sul server dopo un nuovo deploy.

La registrazione avviene solo in `src/lib/sw-register.ts`. Non si registra in sviluppo, dentro un
iframe, sugli host di anteprima Lovable o con `?sw=off` (che rimuove anche il worker e le cache
`questionar-*`). Per forzare l'aggiornamento dopo una modifica al worker, incrementa `CACHE`.

---

<a id="categorie"></a>

## 3. Questionario e categorie

<a id="espandi-comprimi"></a>

### Espandi / Comprimi tutte

Un pulsante a pillola apre o chiude tutte le categorie insieme nel questionario principale (tra bio e
domande), nel confronto principale, in Erotismo e nel confronto Erotismo. Il testo indica l'azione
disponibile: con categorie miste propone «Espandi tutte».

Alla sua sinistra, nel questionario principale e in Erotismo, la pillola «Proteggi con password»
gestisce la password di quel questionario (vedi [Protezione con password](#password)).

<a id="completamento"></a>

### Conteggio del completamento

L'intestazione di ogni categoria mostra `completate/visibili` (es. `3/12`). Le domande nascoste
singolarmente non contano. A completamento appare `N ✓`. Una domanda Fare/Ricevere è completata solo
con entrambi gli slider; una risposta parziale resta usata nei confronti come stima. Senza domande
visibili si mostra `0`, senza spunta.

<a id="nascondere"></a>

### Nascondere categorie e domande

- Stato della categoria (`hiddenCategories`) e stato della domanda (`answer.hidden`) sono indipendenti.
- Nascondere/ripristinare una categoria non modifica mai `answer.hidden`.
- Una domanda è nascosta se è nascosta singolarmente **oppure** lo è la sua categoria.
- La sezione «Categorie e domande nascoste» (una per il questionario principale, una per Erotismo)
  mostra i gruppi delle categorie nascoste (con le domande non nascoste singolarmente) e, a parte, le
  domande nascoste singolarmente.
- Le domande nascoste da chiunque partecipi al confronto sono escluse da confronti e medie.
- Le regole vivono solo in `src/lib/visibility.ts`.

<a id="erotismo"></a>

### Erotismo

Sezione facoltativa con proprie categorie (chiavi che iniziano con `X`), definite in
`src/lib/questions.ts` (`EROTISMO_CATEGORIES`, `EROTISMO_DEFAULTS`): 6 categorie e 36 domande.

| Chiave | Domande |
| ------ | ------- |
| XA     | 8       |
| XB     | 6       |
| XC     | 8       |
| XD     | 8       |
| XE     | 1       |
| XF     | 5       |

- Usa le stesse risposte, lo stesso backup e lo stesso scambio cifrato del questionario principale.
- Le sue categorie si aprono solo su scelta dell'utente.
- Può avere una propria password, indipendente da quella del questionario generale: chi non la
  conosce vede solo le medie delle categorie di Erotismo.
- Pagine: `/erotismo` e `/confronto/erotismo`. Le sue domande entrano una sola volta nella
  compatibilità generale e la sua media compare come una categoria.

---

<a id="reciprocita"></a>

## 4. Domande a reciprocità (Fare / Ricevere)

La maggior parte delle domande è a **somiglianza**: più le due risposte sono vicine, più alta è la
compatibilità. Alcune domande descrivono invece qualcosa che si dà e si riceve: per queste
l'app mostra **due slider, «Fare» e «Ricevere»**, e il confronto è **incrociato**.

<a id="reciprocita-elenco"></a>

### Elenco delle domande (42 su 114 predefinite)

- **Intimità fisica:** Coccole e gesti fisici di affetto · Massaggi
- **Linguaggi d'amore:** Contatto fisico · Parole d'affermazione · Regali · Atti di servizio ·
  Dolcezza, piccole grandi attenzioni, gentilezza · Vocali lunghi come audiolibri
- **Intimità emotiva:** Supporto nei momenti difficili · Condividere vulnerabilità e paure ·
  Condividere fantasie sessuali · Consigli · Sostegno nel lavoro sulla salute mentale
- **Finanze:** Supporto economico · Regali costosi
- **Erotismo · Vanilla:** Massaggi sensuali · Penetrazione genitale · Sesso orale ·
  Petting e strusciamenti · Masturbazione · Penetrazione con oggetti
- **Erotismo · Bondage e Disciplina:** Shibari · Mummificazione · Sospensione · Routine ·
  Punizioni correttive
- **Erotismo · Dominazione e Sottomissione:** Servizio e compiti · Negazione/Privazione ·
  Silenziamento · Proprietà personale · Adorazione · Dominazione finanziaria · Umiliazione
- **Erotismo · Sadismo e Masochismo:** Impact · Temperatura · Aghi · Lame · Iperstimolazione ·
  Privazione sensoriale · Solletico · Tortura
- **Erotismo · Feticismo:** Adorazione di parti del corpo

L'elenco è in `src/lib/questions.ts` (voci marcate con `r(...)`). Il tipo delle domande
predefinite è fisso e non può essere cambiato da una definizione personalizzata.

<a id="reciprocita-personalizzate"></a>

### Domande personalizzate: Normale o Complementare

Creando una domanda personalizzata si sceglie il tipo:

- **Normale** (predefinito): un solo cursore, confronto a somiglianza.
- **Complementare**: due cursori Fare/Ricevere e lo stesso modello delle domande a
  reciprocità (confronto incrociato, risposte parziali, stime e margine «±»).

Il tipo è salvato sulla definizione della domanda (`Question.type`: `"similarity"` o
`"reciprocal"`) e viaggia con essa in IndexedDB, nello snapshot del profilo, nello scambio
P2P e nel backup PNG. L'identificativo resta `categoria-testo normalizzato`.

- Domande salvate o importate senza tipo, o con un tipo non valido, valgono **Normale**
  (`sanitizeCustomQuestions()`), senza errori.
- Due domande gemelle (stessa categoria e stesso testo, quindi stesso id) create da persone
  diverse con tipi diversi si confrontano come **Complementare**: una risposta a cursore
  singolo vale Fare = Ricevere = valore, quindi resta confrontabile.
- Il tipo si sceglie alla creazione; per cambiarlo si elimina la domanda e la si ricrea.
- Versioni precedenti dell'app ignorano il tipo: vedono una domanda Complementare come
  Normale e la confrontano con il `value` (media di Fare e Ricevere), quindi il punteggio
  può differire da quello mostrato dalle versioni nuove. Il tipo resta comunque nella
  definizione che quelle versioni conservano e ricondividono.

<a id="reciprocita-calcolo"></a>

### Calcolo incrociato

La funzione di base `questionCompat(a, b, criticalCount)` e le curve delle domande critiche
sono le stesse delle domande a somiglianza. Per una domanda a reciprocità tra A e B
(`src/lib/compat.ts`):

```
flusso A ➔ B = questionCompat(Fare di A, Ricevere di B, critiche)
flusso B ➔ A = questionCompat(Fare di B, Ricevere di A, critiche)
punteggio    = arrotondamento((A ➔ B + B ➔ A) / 2)
```

Con tre persone si fa la media dei punteggi di ogni coppia (come per le altre domande);
il numero di persone che ha segnato la domanda come critica conta su tutti i partecipanti.

| A (Fare/Ricevere) | B (Fare/Ricevere) | A ➔ B     | B ➔ A     | Domanda              |
| ----------------- | ----------------- | --------- | --------- | -------------------- |
| 90 / 20           | 20 / 90           | 100%      | 100%      | **100%**             |
| 100 / 0           | 100 / 0           | 0%        | 0%        | **0%**               |
| 100 / 0 (critica) | 100 / 0           | −25%      | −25%      | **−25%**             |
| 80 / –            | 20 / 70           | 90%       | in attesa | **90% ±45%** (stima) |
| 80 / –            | 40 / –            | in attesa | in attesa | non confrontabile    |

<a id="reciprocita-parziali"></a>

### Risposte parziali e margine d'errore

Si può rispondere a uno solo dei due slider: la domanda vale come **risposta parziale**.
Il lato mai toccato **non viene considerato** (non vale 50%):

- un flusso si calcola solo se chi dà ha risposto a «Fare» e chi riceve a «Ricevere»;
- il punteggio della domanda è la media dei soli flussi calcolabili ed è segnato come
  **stima** con margine d'errore (`90% ±45%`); se nessun flusso è calcolabile la domanda non
  entra nel confronto;
- con tre persone, una coppia senza flussi calcolabili viene esclusa e il risultato è una stima;
- le stime **entrano nei totali** (complessivo, per categoria, per coppia), che mostrano il
  margine «±N%» (media dei margini delle domande) e una nota con il numero di domande parziali
  incluse;
- le curve delle domande critiche si applicano anche al singolo flusso noto.

**Margine (±).** Per ogni verso mancante si considera tutto l'intervallo che potrebbe ancora
assumere (dalla curva usata: distanza 100 → minimo, distanza 0 → massimo). Il margine è lo
scostamento massimo tra la stima mostrata e il valore finale possibile, arrotondato.
Esempio: verso noto 90%, verso ignoto tra 0% e 100% → risultato reale tra 45% e 95% →
`90% ±45%`. Nel confronto a tre una coppia senza versi calcolabili entra nel margine con
l'intero intervallo. Medie di categoria e totali usano la media dei margini delle domande.
Il «±» è sempre grigio, non colorato.

<a id="reciprocita-dati"></a>

### Dati e compatibilità

- `Answer` ha due campi facoltativi, `giveValue` (Fare) e `receiveValue` (Ricevere), 0–100.
  `value` resta presente ed è la media arrotondata dei lati noti, così chi usa una versione
  precedente dell'app continua a vedere una risposta sensata.
- Una risposta salvata con il solo `value` (né Fare né Ricevere) vale come
  Fare = Ricevere = `value`: il risultato coincide con il vecchio calcolo.
- Una risposta con un solo lato è parziale; il suo `value` è il valore del lato noto.
- `sanitizeSnapshot()` (e il caricamento dei backup PNG) tiene `giveValue`/`receiveValue` solo
  se sono numeri, limitati a 0–100.
- Le domande riformulate («Masturbazione», «Vocali lunghi come audiolibri», «Supporto nei
  momenti difficili», «Consigli», «Sostegno nel lavoro sulla salute mentale») mantengono
  l'identificativo del testo precedente (`legacy` in `src/lib/questions.ts`): le risposte già
  salvate e quelle dei contatti con versioni precedenti continuano a corrispondere.

<a id="reciprocita-interfaccia"></a>

### Interfaccia

- **Profilo:** la scheda mostra gli slider «Fare» e «Ricevere» (trascinamento, tocco sulla
  traccia, frecce da tastiera). Commento, domanda critica e nascondi valgono per l'intera
  domanda. Toccando un solo slider la risposta è parziale: l'altro resta neutro («?») e la
  scheda invita a completarlo.
- **Confronto:** per ogni direzione c'è una traccia «Io faccio ➔ Luna riceve» /
  «Luna fa ➔ io ricevo» con il proprio punteggio; sotto, la compatibilità della domanda.
  Un verso non calcolabile mostra «in attesa di risposta» e chi deve ancora rispondere; il
  punteggio diventa `N% ±M%` con la nota «Compatibilità parziale».

---

<a id="password"></a>

## 5. Protezione con password

Ogni profilo può proteggere con una password **il questionario generale** (gestito in `/`) e,
con una password **separata e indipendente**, **il questionario Erotismo** (gestito in
`/erotismo`). Cifratura e decifratura avvengono solo nel browser, con la Web Crypto API.

La password non blocca l'app sul proprio dispositivo (il proprietario vede sempre tutto in
chiaro): protegge ciò che vedono gli altri nel confronto. La comunica direttamente il
proprietario a chi vuole. Lunghezza minima: 4 caratteri.

<a id="password-visibilita"></a>

### Cosa vede chi confronta

| Dato del questionario protetto                             | Senza password | Con la password |
| ---------------------------------------------------------- | -------------- | --------------- |
| Medie per categoria (e quindi istogramma e totale stimati) | sì, in chiaro  | sì              |
| Risposte, commenti, domande critiche e nascoste            | no, cifrati    | sì              |
| Domande personalizzate di quella sezione                   | no, cifrate    | sì              |
| Categorie nascoste (`hiddenCategories`), bio, tag, nome    | sì, in chiaro  | sì              |

Senza password i punteggi sono **stime dalle medie**: per ogni categoria si confrontano le due
medie (100 − distanza) e il risultato è contrassegnato con «≈». Le categorie con una sola domanda
(es. XE) rivelano di fatto quella risposta tramite la media: è una scelta voluta, senza mitigazioni.

<a id="password-crittografia"></a>

### Scomparti cifrati e crittografia

Nel `ProfileSnapshot` (`src/lib/types.ts`) ogni sezione protetta occupa due campi:

- Generale (categorie non `X`): `mainAverages` (medie in chiaro) e `mainProtected`.
- Erotismo (categorie `X`): `eroticAverages` (medie in chiaro) e `eroticProtected`.

Ogni box `{ salt, iv, ciphertext, keyVersion }` contiene `{ answers, customQuestions }` della
sola sezione. I campi in chiaro (`answers`, `customQuestions`) non contengono mai dati di una
sezione protetta. Senza password i dati restano nei campi in chiaro, come nelle versioni
precedenti; un'app più vecchia ignora i nuovi campi.

- Derivazione: PBKDF2-HMAC-SHA-256, 600 000 iterazioni, salt casuale a 128 bit.
- Cifratura: AES-256-GCM, IV casuale a 96 bit **a ogni cifratura**, tag di 128 bit.
- Una password sbagliata (o un box alterato) produce l'errore controllato `WrongPasswordError`.
- Costo per chi confronta: PBKDF2 avviene a ogni tentativo di password effettivamente eseguito.
  Dopo uno **sblocco riuscito**, i confronti successivi e i riavvii riusano la chiave salvata:
  serve solo AES-GCM, molto meno costosa. PBKDF2 si ripete se cambiano salt o `keyVersion`,
  se si dimentica lo sblocco o se i dati locali vengono cancellati.
- Costo per il proprietario: la prima esportazione o condivisione di ciascuna sezione protetta
  deriva la chiave e la conserva in memoria; le successive la riusano nella stessa sessione.
  Dopo un riavvio, o dopo un cambio password, la derivazione viene eseguita nuovamente.

Implementazione: `src/lib/password-crypto.ts` (primitive) e `src/lib/protection.ts`
(scomparti, medie, ciclo di vita).

<a id="password-canali"></a>

### Canali: handle/QR e scheda PNG

Vale identico per entrambi i canali, perché tutti passano da `mySnapshot()` (sempre
asincrono e già cifrato) e da `sanitizeSnapshot`:

- **Handle / QR** (relay P2P): il profilo inviato contiene i box; il canale è inoltre cifrato
  end-to-end.
- **Scheda PNG** (steganografia): gli stessi campi finiscono nel backup. Reimportando il
  proprio backup su un altro dispositivo l'app chiede le proprie password per ripristinare anche
  le sezioni protette (e le riattiva con lo stesso `keyVersion`); si può saltare.

Le password in chiaro restano solo nello stato locale del proprietario (`AppState.protection`, in
IndexedDB): non entrano mai nello snapshot, nei messaggi P2P, nei backup o nella diagnostica.

<a id="password-ciclo"></a>

### Ciclo di vita (`keyVersion`) e sblocchi salvati

- Attivare o **modificare** la password genera un nuovo salt e incrementa `keyVersion`.
- **Rimuovere** la password riporta i dati in chiaro; se poi se ne imposta una nuova,
  `keyVersion` riparte dal valore successivo all'ultimo usato (mai riutilizzato).
- Chi riceve, dopo uno sblocco riuscito, salva nel database IndexedDB separato
  `questionar-unlocks` la sola **chiave derivata non estraibile** associata a
  contatto + sezione + `keyVersion`: ai riavvii il questionario resta sbloccato. Quando il contatto
  cambia password (nuovo `keyVersion`) la chiave salvata viene eliminata e la password va reinserita.
- Gestione: `src/lib/unlocks.tsx` (UnlockProvider) e `src/lib/unlock-manager.ts`; i dati decifrati
  restano solo in memoria.

<a id="password-tentativi"></a>

### Tentativi errati

Il primo tentativo non ha attesa. Dopo il primo errore si attende 1 s, dopo il secondo 2 s,
dal terzo 5 s, per contatto e sezione. Un tentativo prima della scadenza non viene provato.
Il contatore è in memoria: ricaricare l'app lo azzera. È un freno ai tentativi nell'interfaccia,
non una protezione contro chi prova password su una copia del box cifrato fuori dall'app.

<a id="password-confronto"></a>

### Confronto a due e a tre

- **A due**: se il questionario dell'altro è protetto, istogramma e totale usano le medie (≈);
  nell'elenco delle domande compare una card che chiede la password. Dopo lo sblocco appare il
  messaggio «Questionario sbloccato» e la card lascia il posto alle risposte normali.
- **A tre** (`/confronto?b=…&c=…`): ogni partecipante è gestito da solo. Sbloccare B non sblocca
  C; se entrambi sono protetti compaiono due card distinte. Le risposte di chi è sbloccato o non
  protetto restano visibili accanto alle tue anche se il terzo è ancora bloccato; le coppie che
  coinvolgono chi è bloccato sono stimate dalle medie.

<a id="password-interfaccia"></a>

### Interfaccia

- Pulsante a pillola a sinistra di «Espandi/Comprimi tutte» (`PasswordPill` in
  `src/components/CategoryControls.tsx`): «Proteggi con password» con lucchetto aperto, oppure
  «Password attiva» evidenziato con la chiave.
- Il modale mostra subito la password in chiaro con **Copia**, **Modifica** e **Rimuovi**.
- Tutorial: capitolo 6, «Proteggi con password», con la demo `DemoPasswordProtection`.

---

<a id="sicurezza"></a>

## 6. Sicurezza e integrità dei dati

- **Bio**: è HTML formattato e arriva anche dai contatti (P2P, schede PNG), quindi viene sempre
  filtrata (`src/lib/bio.ts`, mostrata solo tramite `BioHtml`). Restano solo i tag dell'editor
  (grassetto, corsivo, barrato, titolo, paragrafo, a capo, link, colore del testo). Script,
  immagini, `on…=`, stili diversi dal colore e link `javascript:`/`data:` vengono eliminati al
  salvataggio, alla ricezione, all'avvio e alla visualizzazione. I link restano solo `https://`,
  `http://` o `mailto:` e si aprono in una nuova scheda.
- **Avatar**: generati sul dispositivo con la libreria DiceBear (stile *Critters*, CC0) in
  `src/lib/avatar.ts`, identici a quelli del servizio online. Funzionano offline, anche nella
  scheda PNG di backup, e l'handle non viene mai inviato a terzi.
- **Lettura dei dati salvati**: se IndexedDB non risponde all'avvio, l'app riprova due volte e poi
  mostra «Riprova» senza salvare nulla, così un errore temporaneo non sovrascrive mai il profilo
  con uno vuoto.
- **Tag del profilo**: dagli snapshot ricevuti e dai backup si accettano solo i tag conosciuti con
  valore sì / no / barrato (`sanitizeProfileTags`).
- **Snapshot**: tutto ciò che entra o esce passa da `sanitizeSnapshot()`; i dati della rubrica
  (es. preferiti) non entrano mai negli snapshot.
- **Password**: vedi [Protezione con password](#password).

### Limiti da conoscere

- La protezione serve alla condivisione, non a bloccare il dispositivo del proprietario:
  risposte e password del proprietario restano nello stato locale. Chi accede al browser
  sbloccato può accedervi; una chiave non estraibile non impedisce al codice della stessa
  origine di usarla per decifrare.
- Una password di 4 caratteri soddisfa il minimo dell'interfaccia, ma può essere debole:
  PBKDF2 rallenta i tentativi, non rende forte una password prevedibile.
- Le medie e i dati pubblici restano visibili per scelta; la steganografia nasconde il contenuto
  nel PNG, ma non lo cifra ulteriormente.
- Offline richiede una precedente apertura e risorse salvate dal service worker; connessioni
  e nuovi scambi richiedono la rete. Con STUN senza TURN, alcune reti impediscono WebRTC.
- Cancellazione dei dati del browser o perdita del dispositivo possono eliminare profilo e
  chiavi salvate: conservare una scheda PNG integra e le password separatamente.
- I test automatici non sostituiscono le verifiche su dispositivi reali, PWA installata e relay,
  ancora elencate nella [roadmap](../roadmap.md).

---

<a id="rubrica"></a>

## 7. Rubrica, preferiti e onboarding

### Preferiti (locali)

La stella sui contatti è un'etichetta **locale e riservata** (`Contact.favorite`):

- si attiva/disattiva dalla pagina di confronto («Aggiungi/Rimuovi dai preferiti»);
- in Rubrica i preferiti sono mostrati per primi con una piccola stella;
- non fa parte di `ProfileSnapshot`: non viaggia via P2P, non finisce nei backup PNG.

La vecchia funzione «Profili consigliati» (lista pubblica `recommends` nello snapshot) è stata
rimossa. `sanitizeSnapshot()` scarta il campo `recommends` in uscita, in entrata e al caricamento
dei dati salvati; i vecchi contatti marcati come «consigliati» diventano preferiti locali
(`migrateContact`).

### Onboarding: griglia emoji congelata

Le 9 emoji proposte al primo accesso vengono salvate in `localStorage`
(`questionar_onboarding_grid`) e riutilizzate a ogni ricarica finché il profilo non è creato;
la chiave viene rimossa solo dopo la creazione riuscita dell'identità (`src/lib/onboarding-grid.ts`).

---

<a id="diagnostica"></a>

## 8. Modalità diagnostica

Attivazione: 5 tap rapidi (pause ≤ 0,8 s, entro 3 s) sul titolo «QuestionAR» nel popup Info.
Una barra rossa fissa indica la modalità attiva e permette di terminarla. Il codice vive in
`src/lib/diagnostics` ed è inattivo finché la modalità non viene attivata.

Flusso: 1) controlli automatici → 2) checklist manuale → 3) riepilogo. Il file viene scaricato solo
con «Esporta report diagnostico». «Cancella dati diagnostici» e «Termina» eliminano buffer, esiti e
il database di prova `questionar-diagnostics`. Nulla viene inviato in rete; i dati dell'app non
vengono letti né modificati.

### Report (`schema: questionar-diagnostics`, `version: 1`)

| Campo         | Significato                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session`     | id effimero (non persistente), inizio/fine ISO                                                                                                                                 |
| `app`         | `version`: versione reale dell'app letta da `package.json` al build (`vite.config.ts` la inietta come `VITE_APP_VERSION`; `unknown` solo se manca); `build`: modalità di build |
| `platform`    | famiglia browser, versione principale, sistema operativo (niente user agent completo)                                                                                          |
| `checks[]`    | `id` stabile, `status` (`pass`/`fail`/`skip`/`not_applicable`), `durationMs`, `code` normalizzato, `facts` tecnici; `source: automatic`                                        |
| `scenarios[]` | esito dichiarato (`passed`/`failed`/`not_run`/`not_applicable`), atteso, passaggi svolti, nota filtrata; `source: manual_declared`                                             |
| `events[]`    | max 200 eventi / 30 min da una lista consentita (relay, p2p, rete, visibilità, errori normalizzati)                                                                            |
| `summary`     | conteggi per esito                                                                                                                                                             |
| `limits`      | cosa il report **non** attesta                                                                                                                                                 |

`skip` significa non eseguito o non verificabile in questo contesto (es. service worker in sviluppo,
nessun endpoint relay di test sicuro): non è un successo. Il report non contiene mai password né
dati del profilo.

---

<a id="sviluppo"></a>

## 9. Sviluppo e test

```sh
bun install
bun run dev
bun run test
```

Costruito con TanStack Start, React, TypeScript e Tailwind CSS. Le icone dell'app derivano tutte dal
logo in `src/logo.png` (`scripts/generate-icons.mjs`).

Test principali (`src/test/`):

| File                                | Cosa verifica                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `password-crypto.test.ts`           | derivazione, cifratura/decifratura, password errata, scomparti indipendenti, nessuna password nello snapshot |
| `password-protection-ui.test.tsx`   | pillola in `/` e `/erotismo`, modale, copia, modifica, rimozione                               |
| `compare-password.test.ts`          | medie + card, sblocco, ritardo progressivo, persistenza e invalidazione per `keyVersion`, confronto a tre |
| `reciprocal-compat.test.ts`         | calcolo Fare/Ricevere, risposte parziali e margine                                             |
| `local-assets.test.ts`              | icone derivate dal logo QuestionAR (nessuna favicon del modello)                               |
| `bio-sanitize.test.ts`              | filtraggio dell'HTML delle bio, dei link non sicuri e dei tag ricevuti |
| `avatar-offline.test.ts`            | generazione locale degli avatar |
| `store-load-safety.test.tsx`        | errori di lettura: niente salvataggio del profilo vuoto e possibilità di riprovare |
| `favorites-privacy.test.ts`         | preferiti locali, esclusione dagli snapshot e migrazione dei vecchi consigliati |

<a id="mappa-codice"></a>

### Mappa del codice

| Area | Riferimenti |
| ---- | ----------- |
| Stato locale e caricamento | [db.ts](../src/lib/db.ts), [store.tsx](../src/lib/store.tsx) |
| Snapshot e validazione | [types.ts](../src/lib/types.ts) |
| Domande e visibilità | [questions.ts](../src/lib/questions.ts), [visibility.ts](../src/lib/visibility.ts) |
| Compatibilità e grafico | [compat.ts](../src/lib/compat.ts), [compat-map.ts](../src/lib/compat-map.ts) |
| Crittografia e scomparti | [password-crypto.ts](../src/lib/password-crypto.ts), [protection.ts](../src/lib/protection.ts) |
| Sblocchi dei contatti | [unlock-manager.ts](../src/lib/unlock-manager.ts), [unlocks.tsx](../src/lib/unlocks.tsx) |
| Bio e avatar offline | [bio.ts](../src/lib/bio.ts), [BioHtml.tsx](../src/components/BioHtml.tsx), [avatar.ts](../src/lib/avatar.ts) |
| P2P, relay e inviti | [p2p.ts](../src/lib/p2p.ts), [relay](../relay/src/index.ts), [qr-invite.ts](../src/lib/qr-invite.ts) |
| Scheda PNG | [backup-card.ts](../src/lib/backup-card.ts) |
| Offline | [sw-register.ts](../src/lib/sw-register.ts), [sw.js](../public/sw.js) |
| Tutorial e diagnostica | [demo](../src/components/tutorial/), [diagnostica](../src/lib/diagnostics/) |
| Verifiche automatiche | [test](../src/test/) |

---

<a id="compatibilita"></a>

## 10. Compatibilità con versioni precedenti (riepilogo)

Tutti i campi aggiunti al `ProfileSnapshot` sono facoltativi: le versioni precedenti li ignorano.

| Campo                                       | Assente o non valido significa                              |
| ------------------------------------------- | ----------------------------------------------------------- |
| `hiddenCategories`                          | nessuna categoria nascosta (resta in chiaro anche se protetto) |
| `giveValue` / `receiveValue`                | entrambi assenti: risposta a valore singolo (`value`); un solo lato presente: risposta parziale |
| `Question.type` (domande personalizzate)    | Normale (somiglianza)                                       |
| `mainAverages` / `mainProtected`            | questionario generale non protetto                          |
| `eroticAverages` / `eroticProtected`        | Erotismo non protetto                                       |
| `recommends` (rimosso)                      | scartato sempre                                             |

---

<a id="manutenzione"></a>

## 11. Come aggiornare questa documentazione

- Questo file è l'**unico manuale funzionale e tecnico** del progetto: non creare altri manuali
  in `docs/`. README, roadmap e istruzioni per chi sviluppa hanno scopi distinti e restano separati.
- Quando cambia una funzione, aggiorna la sezione corrispondente nello stesso intervento; per una
  funzione nuova aggiungi una sezione con ancora `<a id="…">` e la sua voce nell'indice.
- Non rinominare le ancore esistenti: sono usate dal `README.md` e dal codice (es. il campo `_doc`
  del report diagnostico punta a `#diagnostica`).
- Verifica i collegamenti relativi e le ancore dell'indice dopo ogni modifica strutturale.
- Attività aperte e rimandate: [roadmap.md](../roadmap.md). Regole tecniche per chi sviluppa:
  [AGENTS.md](../AGENTS.md).
