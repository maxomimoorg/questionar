# Remix of QuestionAR

Crea QuestionAR dal seguente piano dettagliato ma aspettando ad implementare l'infrastruttura per le connessioni p2p in un secondo momento. Concentrati sul design, la pagina profilo e la pagina rubrica. Dopo chiedimi di darti conferma per procedere con il resto. Il piano inizia qua sotto:




Descrizione generale:

Web app di "Compatibilità Profili tramite questionari", basata su un sistema di domande a scorrimento (slider). I dati devono essere salvati in locale (IndexedDB), niente cloud e la connessione tra profili deve avvenire in modo end-to-end (P2P via WebRTC). L’app è installabile tramite PWA. 




Nome: QuestionAR




Icona: vettoriale, cuore turchese con dentro un simbolo di percentuale % bianco, sfondo nero.




Ottimizzazione grafica:

L'app deve essere ottimizzata per mobile, ma con un layout leggermente allargato e ben centrato su desktop. L’interfaccia generale si sviluppa  in Max-width, ma solo su desktop con dei margini del 10%. Per la pwa considera i margini di sicurezza per barra notifiche e tasti su dispositivi mobili.

Performance (Lag Reduction): Per evitare lag, i colori degli slider non devono cambiare in tempo reale durante il trascinamento (drag). Il ricalcolo e il cambio di colore devono avvenire solo al rilascio del cursore (onMouseUp o onTouchEnd).




Design:

Temi giorno/notte con sfondo principale quasi bianco o quasi nero, sfondi secondari in tinte pastello tenue, titoli ed elementi in tonalità pastello più accese. Gli spigoli sono morbidi, le sezioni minimali.

Caratteri: usa un font ben leggibile e morbido; i testi più piccoli come i consigli sono di dimensione 12px, i titoletti e i bottoni 16px, quelli normali per tutto il resto 14px; i testi sui pulsanti hanno un buon contrasto per essere ben leggibili.

Colori Dinamici (Gradazione): Ogni cifra percentuale e la traccia riempita degli slider devono seguire rigorosamente questa gradazione di colore interpolata in base alla percentuale: 0% Rosso -> 25% Arancione -> 50% Giallo -> 75% Verde -> 100% Turchese. Le percentuali negative (possibili nelle domande critiche) avranno una gradazione dal rosso scuro al viola. Ogni elemento (es. percentuale scritta e traccia dello slider) calcola il suo colore in modo indipendente in base al proprio valore di riferimento. I pulsanti che cancellano, rifiutano, annullano sono rossi.




Note tecniche:

Supporto PWA con funzionamento offline: Configura un Service Worker (sw.js) e un file manifest.json per fare il pre-caching di tutte le risorse statiche (HTML, JS, CSS, icone). L'app deve potersi aprire e mostrare l'interfaccia principale e i dati salvati in locale anche quando il dispositivo è totalmente disconnesso da internet.

Chiavi E2E: Al nuovo utente viene assegnata una chiave pubblica e una privata per la comunicazione crittografata verso altri utenti.

Handle: <username><emoji>




Homeboarding:

Al primo accesso dell’app, fai scegliere:

Nome (1-20 caratteri); 

username (4-16 lettere/numeri) normalizzato minuscolo;

emoji [vedi sezione emoji picker].




Emoji picker:

Assieme alla scelta di nome e username, metti una piccola griglia centrata 3x3 con dentro 9 emoji casuali; ogni slot ha queste probabilità di contenere un elemento della collezione di emoji: Comuni (75% di possibilità): animali comuni, frutti e verdure, albero, fuoco, acqua, fulmine, emozioni classiche; non comuni (20% di possibilità: animali esotici, frutti esotici, rettili; rare (5% di possibilità): creature magiche, mitologiche, mostri e robot; totale collezione: 150; L’utente per proseguire deve selezionare 3 di queste 9, che verranno aggiunte in coda all’username senza spazi di separazione; queste emoji non potranno mai essere modificate, neppure nell’editor della bio; in fase di selezione delle emoji, queste non mostrano differenze tra loro a livello di rarità, perché è una cosa che viene svelata solo nella griglia della collezione completa dopo la fase di creazione account, quando l’utente apre la rubrica delle connessioni.

Header:

A sinistra c’è l’avatar utente tondo [vedi sezione avatar], seguito verso destra dal nome impostato dall’utente e poi dall’handle; tutto a destra, l’icona della rubrica per accedere alle proprie connessioni e un'icona per il tema giorno/notte dove cambiare immediatamente con un tocco, mentre con pressione prolungata apre un pop-up per selezionare tra 8 colori la tinta dello sfondo e quella degli elementi in risalto, che si applicano in maniera armoniosa sia al tema notte che giorno.  Quando si va alla rubrica, il tasto rubrica viene sostituito da home (icona profilo) per poi tornare come prima una volta in home. Scorrendo verso il fondo, l’header con avatar, nome, username e icone si riduce nettamente di dimensioni e lo sfondo diventa opaco con effetto liquid glass, in tutte le pagine; toccando l'username di qualunque utente all'interno dell'header, verrà copiato in memoria l'handle completo per essere incollato altrove come testo; Quando si tocca una parte dell'header da rimpicciolito durante lo scorrimento (a meno che non si tocchi l'icona della rubrica o del tema) si tornerà in cima alla pagina. Nell’header della pagina di confronto, mostra le flashcard dell’utente principale e di quelli confrontati (questi ultimi con accanto la percentuale di compatibilità con l’utente principale, mentre l’utente principale vedrà al posto della percentuale la scritta con colore di accento in grassetto “ME!”.

Avatar:

Generazione automatica dopo la scelta dell’utente e non modificabile tramite https://api.dicebear.com/10.x/critters/svg (preset default), mantenendo l’handle completo come seed deterministico dove questo viene generato a partire dall’handle dell’utente.

Pagina di profilo:

Parte con una sezione in cui si legge la bio completa, quando aggiunta dall’utente; sotto la bio inizia la sezione del questionario.

Bio e Editor di Testo: 

Il campo di testo della bio non è modificabile direttamente nella pagina del profilo ma è presente un'icona di modifica (matita) che, se premuta, apre un popup modale con un Rich Text Editor; 

Funzionalità dell'editor (prima riga): Grassetto, Corsivo, Barrato, Titolo, Paragrafo, Link, Reimposta colore (cerchio vuoto con barra rossa), Selettore colore (contagocce); 

Selezione colore (apre una seconda riga cliccando il contagocce): per il colore del testo ci sono a disposizione 8 colori; 

Limite massimo di caratteri: 666 (da mostrare a schermo con un contatore, es. 666/666 solo al raggiungimento del limite);

Solo durante la modifica della bio, Nome e username (ma non le emoji) possono essere modificati, altrimenti questi normalmente sono in sola visualizzazione;

Prima della sezione della bio, nell’editor di testo, tramite due campi si possono modificare nome e username.

Gestione Questionario:

Le domande si devono leggere totalmente.

Sotto ogni domanda c'è uno slider (0-100%) con un solo cursore tondo grosso centrato verticalmente.

Gli slider sono composti da due segmenti adiacenti che: vengono colorati solo nella parte sinistra (cursore da 0 a 49%),  o nella parte a sinistra (51-100%), oppure non vengono colorati (50%), una volta che il cursore viene spostato; i cursori si spostano tramite trascinamento.

I segmenti degli slider su schermi touch fanno scorrere la pagina come quando si tocca e trascina in qualsiasi altro punto dello schermo; solamente i cursori tondi permettono di variare il valore nello slider.

Accanto ci sono delle icone per aggiungere un commento (max 150 caratteri), nascondere/mostrare la domanda e renderla critica (⚡​​); Una domanda quando è critica viene marcata di più, anche con un bordo attorno del colore di risalto.

I commenti vengono confermati con invio o tap fuori dal campo di testo e in lettura sono in stile corsivo, senza alcuno sfondo.

Sezione per aggiungere una "Domanda personalizzata" scegliendo la categoria da un menù a tendina.

Le sezioni di categoria possono essere compresse a cassetto, verrà memorizzato il settaggio dei cassetti aperti/chiusi, le domande personalizzate possono essere cancellate.

Domande nascoste: in fondo c'è un cassetto per le domande disattivate/nascoste. Quando una domanda viene riattivata da qui, deve tornare immediatamente visibile tra le domande attive nella sua rispettiva categoria. Quando una domanda viene nascosta, viene anche automaticamente disattivata.

Una domanda può essere nascosta e disattivata per i fini di calcolo toccando l’icona dell’occhio, rendendo l’intero slider, domanda e eventuale commento completamente grigio e opaco al 50%. 

Il cursore degli slider al suo interno contiene in modo centrato il simbolo di spunta se è > di 74%, il simbolo X se < di 26%, altrimenti il simbolo ?; (tutti i simboli sono bianchi e spessi)




Pagina della rubrica connessioni:

La rubrica delle connessioni deve risiedere in una pagina separata rispetto a quella degli slider.




Sezione Ricerca: un pulsante per aprire un campo di testo dove scrivere l’handle di un utente da cercare per inviare una richiesta di connessione.

Sezione Richieste: un elenco con le flashcards (avatar, nome ed handle), per le richieste di connessione ricevute (con tasti accetta e rifiuta) e inviate (con tasto annulla).

Sezione Connessioni: lista in due colonne di flashcards compatte degli utenti con cui si è instaurata una connessione (dove in aggiunta è presente la percentuale di compatibilità generale con quell’utente) interamente cliccabili per arrivare alla pagina di confronto; ogni flashcard ha la sua icona cestino rossa per essere eliminata, ma solo previa conferma. Ogni flashcard ha un segnalatore con un led del colore di accento (online) o spento (offline).

Sezione QR: codice centrato orizzontalmente, di dimensioni appropriate alla lettura chiara; lo stile è colore di accento su sfondo (modalità notte) oppure nero su sfondo (modalità giorno): contiene un link all'app che apre la rubrica con l'handle già scritto nel campo di ricerca (verificato: inquadrando/aprendo il link il campo risulta precompilato). Sotto resta l'handle copiabile.

Sezione Backup: tasti principali Esporta e Importa, poi Nuova connessione da backup, infine Elimina profilo. 

Collezione emoji: Griglia (con margine 1px) 15x10 colonne/righe riempita completamente da piccoli pallini centrati del colore dell’accento. Le 3 emoji scelte dalla griglia 3x3 in fase di creazione del profilo vengono subito aggiunte alla collezione sostituendo i pallini. L’ordine delle emoji è sempre uguale per tutti gli utenti e le loro posizioni sono fissate nella griglia e ordinate in base alla rarità. La collezione personale si completa con l’aumentare delle connessioni: le emoji nell’handle del nuovo utente con cui ci si connette, si aggiungono alla griglia di collezione se non ancora presenti. La griglia è compatta e giustificata al centro, l’effetto bagliore è tenue e parte direttamente dalle emoji senza alcun paddle o margine con l’emoji. Non ci devono essere duplicati.




Funzionamento Handshake durante le richieste di connessione:

Crea un tunnel P2P via WebRTC passando da una stanza MQTT gratuita.

Utilizza quando l’utente è online, un hash basato sull’handle dell’utente.

Quando un altro utente cerca all’interno dell'app nella sezione rubrica connessioni l’handle, controlla se l’utente con quell’handle è online, se sì, invia con successo una richiesta di connessione che poi viene visualizzata nella sua rubrica.

Solo quando la richiesta viene accettata, i due profili possono vedersi reciprocamente ed è possibile accedere alla pagina di confronto.

Il Tunnel Permanente: Una volta accettata la prima volta, i due dispositivi salvano la Chiave di Stanza in locale. Da quel momento in poi, l'app non chiederà più conferme: ogni volta che entrambi saranno online, il tunnel P2P si riaprirà da solo in background e aggiornerà i questionari in tempo reale.

Il collegamento parte anche dalla rubrica e riparte al rientro nell'app o quando torna la rete; prova più server pubblici in sequenza con nuovi tentativi; l'invio della richiesta attende qualche secondo invece di fallire subito, mentre appena ha successo, la connessione viene salvata.




Un metodo alternativo per creare un collegamento, è condividere il backup ottenuto da un altro utente e caricarlo in una sottosezione apposita dentro la rubrica, cercando una nuova connessione. In questo modo, si può confrontare il proprio questionario e quello di un altro utente. La prima volta che l’altro utente sarà online nello stesso momento del primo utente, verrà mandata immediatamente una richiesta di connessione che se accettata creerà un tunnel permanente, aggiornando di conseguenza i profili per il confronto da entrambe le parti, come se fosse stata mandata una richiesta normale; La differenza in questo metodo sta nella possibilità di vedere un confronto su dati possibilmente obsoleti anche senza handshake iniziale, posto che successivamente i dati verranno sovrascritti con quelli più aggiornati. Specifica all’utente che se l’immagine dell’avatar da caricare non funzionerà se trasmessa da una persona all’altra tramite immagini compresse in jpg nelle chat di tutti i giorni, ma solo se inviate come file png.




Pagina di confronto:

Quando si visita il profilo di un contatto connesso all’utente, si apre la pagina di confronto. Non serve calcolare le medie complessive sul proprio profilo, queste si calcolano solo qui; Nell’header, accanto ai dati dell’utente principale vengono affiancati quelli del secondo utente o anche del terzo se la comparazione e a 3.




Intestazione: Sotto l'username del contatto visitato compare il grado di "COMPATIBILITÀ" totale (media delle compatibilità di tutte le domande). All'inizio di ogni categoria, specifica anche la percentuale di compatibilità specifica per quella categoria.




Bio: Mostra la bio del profilo visualizzato.




Consiglia profilo: Accanto alla sezione di compatibilità complessiva nella pagina di confronto, c'è un pulsante (un'icona a stellina) "consiglia ai tuoi contatti!"/"non consigliare più": se attivato, nelle flashcard dei profili consigliati ci sarà una stellina come segnalino; Se utente A consiglia gli utenti B e C, ogni altro utente che userà l'app per confrontarsi con A, vedrà in fondo alla pagina di confronto una lista di flashcard con avatar, nome ed handle, in questo caso di B e C, e quando toccherà una delle flashcard, l'handle di quell'utente verrà copiato per poter eventualmente essere incollato nella barra di ricerca connessioni.




Slider Doppio (Dual Thumb): Sotto ogni domanda, c'è una singola traccia slider con due cursori:

Cursore 1 (Tuo): Più piccolo del normale. Il cursore e la sua porzione di slider si colorano secondo la tua risposta (gradazione rosso-turchese).

Cursore 2 (Contatto): Grandezza normale. Contiene all'interno l'avatar del contatto (emoji). Ha un anello attorno colorato in base al valore della sua risposta.




Dati e Testi sotto la domanda:

Al posto dei classici bottoni, mostra su una riga le percentuali: "io: [X]%", "[nome contatto]: [Y]%", "Compatibilità: [Z]%". Ognuna di queste cifre deve essere colorata in base al proprio valore, seguendo la regola della gradazione colori.

Commenti: Sotto le percentuali, mostra le sezioni commenti sovrapposte. Ogni commento inizia con il nome del profilo in grassetto (es. "io: testo", "[nome]: testo").




Logica di Compatibilità Base:

La compatibilità di una domanda è basata sulla differenza tra le due risposte.

Differenza 0 (es. 6% e 6%) = 100% compatibile.

Differenza 100 (es. 0% e 100%) = 0% compatibile.

Differenza 40 (es. 20% e 60%) = 60% compatibile.

Formula: 100 - Math.abs(valore_mio - valore_suo).




Domande Critiche (Modificatore di punteggio):

Sul proprio profilo, l'utente può contrassegnare una domanda come "Critica".

Se una domanda è critica, il calcolo della compatibilità per quella domanda cambia, usando una curva di interpolazione specifica sui punti percentuali di scarto:

Scarto 0% -> Compatibilità 110%

Scarto 5% -> Compatibilità 100%

Scarto 55% -> Compatibilità 25%

Scarto 75% -> Compatibilità 0%

Scarto 100% -> Compatibilità -25%

Applica un'interpolazione lineare tra questi punti per calcolare il valore esatto. Valori negativi avranno colori dal rosso scuro al viola.

Il calcolo della compatibilità su domande critiche avviene per tutti gli utenti secondo l’interpolazione, mostrando nella pagina di confronto lo status critico della domanda e specificando graficamente da chi è stato impostato.

Nel caso di domanda critica per entrambi gli utenti nel confronto a 2, l’interpolazione varia in questo modo:

Scarto 0% -> Compatibilità 120%

Scarto 5% -> Compatibilità 100%

Scarto 55% -> Compatibilità 20%

Scarto 75% -> Compatibilità -5%

Scarto 100% -> Compatibilità -30%

Nel caso di domanda critica per tutti tre gli utenti nel confronto a 3, l’interpolazione varia in questo altro modo:

Scarto 0% -> Compatibilità 130%

Scarto 5% -> Compatibilità 100%

Scarto 55% -> Compatibilità 15%

Scarto 75% -> Compatibilità -10%

Scarto 100% -> Compatibilità -40%




Domande a cui l’utente non ha risposto:

Se ci sono domande sul profilo dell’altro utente a cui il primo non ha risposto, un’icona viene aggiunta per andare alla domanda corrispondente sul proprio profilo e aggiornare il confronto a seguito della risposta.

Se la domanda non esiste ancora (riconoscimento tramite id) perché è una domanda personalizzata, il collegamento riporta al proprio profilo creando immediatamente la stessa domanda (con lo stesso id), per poi comportarsi come qualsiasi altra domanda anche in fase di backup personale.




Confronto a tre utenti:




Mentre si è sulla pagina di confronto con il Profilo B, deve essere presente un'opzione per aggiungere un Profilo C al confronto (condizione: la connessione con il Profilo C deve essere già stata stabilita in rubrica).

Se attivato, l'interfaccia si adatta: lo slider mostrerà 3 cursori (il tuo piccolo, e due grandi con gli avatar di B e C), e le percentuali e i commenti mostreranno le risposte di tutti e 3 gli utenti.

La bio del terzo profilo verrà messa sotto quella del primo, separandole con una linea e intestandole con i rispettivi handle.




Backup:

La sezione di gestione dei backup sta sempre nella pagina rubrica connessioni. Il backup viene salvato in un hash contenuto in un file PNG che graficamente è uguale all’immagine avar di quell’utente. All’esportazione, salva quell’immagine con dentro il backup in Steganografia LSB. Importando un backup, i dati vengono aggiunti a quelli dell’utente.

Specifica all’utente semplicemente che verrà scaricata un’immagine della propria creatura avatar che contiene al suo interno le domande e le risposte del questionario.




Cosa viene salvato nel backup:

il questionario completo con i valori degli slider

i commenti alle domande

le domande critiche

le domande personalizzate

lo stato attivo/disattivo e mostra/nascondi delle domande




ID delle domande per l’importazione e il confronto:

sia le domande di default che quelle personalizzate hanno un’id che consente all’importazione di non essere duplicate. l’id è codificato prendendo la lettera della categoria corrispondente, poi un trattino e quindi la stringa di testo normalizzata delle domande, in minuscolo, senza spazi, senza lettere accentate, senza simboli o emoji.




I backup vengono integrati nei dati dell’utente ma non salvano e non modificano nulla dell’identità dell’utente, come il nome, l’username, le emoji, l’avatar e le chiavi pubblica e privata, la collezione di emoji o la rubrica attuale delle connessioni.

Nella sezione backup c’è anche un bottone rosso per eliminare completamente il profilo, previa conferma.

Domande predefinite nelle varie categorie:




A) Impegno per la stabilità

Etichettare la relazione

Fare piani per il futuro

Puntare ad una relazione a lungo termine

Matrimonio

Procreazione

Genitorialità

Cura di animali

Convivenza

Co-proprietà di casa

Impegnarsi a superare le sfide relazionali

Avere potere decisionale paritario

Sostegno reciproco nelle sfide personali

Cercare di accogliere gli errori e perdonarsi




B) Tempo di qualità

Vedersi con una certa frequenza

Fare delle uscite serali

Passare la notte insieme

Partecipare ad attività condivise

Programmare delle vacanze di coppia

Sincronizzare i reciproci calendari

Farsi a lungo i grattini come anti-stress

Aiutarsi a mantenere uno stile di vita sano

Fare attivismo insieme o comunque supportarsi a livello politico

Nerdare insieme con film, serie e videogiochi




C) Autonomia

Equilibrio tra tempo insieme e non

Trascorrere del tempo con altre persone

Mantenere delle amicizie indipendenti

Avere altre relazioni indipendenti

Evitare squilibri di potere

Passare del tempo in solitudine




D) Intimità fisica

Coccole e gesti fisici di affetto

Affettuosità in pubblico

Chem-sex (sesso con sostanze)

Raggiungere l’orgasmo

Baciarsi

Sesso orale

Petting

Masturbazione reciproca

Penetrazione con oggetti

Penetrazione genitale

Uso di giocattoli sessuali

Uso di preservativo o altre protezioni

Test periodici IST

Gioco kinky (fetish/BDSM)

Sesso a 3 o più

Attenzione all’igiene personale




E) Comunicazione

Sentirsi tutti i giorni o quasi

Messaggi in chat

Telefonate

Videochiamate

Parlare di passioni ludiche e culturali

Parlare di rapporti con altre persone

Parlare di politica e attualità

Parlare dei propri sentimenti

Onestà e comunicazione non violenta

Fare dei check-up della relazione




F) Linguaggi d’amore

Contatto fisico

Parole d’affermazione

Regali

Atti di servizio

Tempo di qualità

Dolcezza, piccole grandi attenzioni, gentilezza

Mandarsi vocali lunghi come audiolibri




G) Integrazione sociale

Incontrare meta-partner

Presentarsi le rispettive amicizie

Incontrare membri della famiglia

Uscire con le amicizie acquisite

Presentarsi come coppia

Curare il rapporto con meta-partner

Essere “il +1” ad eventi sociali

Seguirsi sui social

Dichiararsi coppia sui social

Vacanze con la famiglia

Vacanze con meta-partner




H) Intimità emotiva

Esprimere felicità ed entusiasmo

Offrire supporto nei momenti difficili

Condividere vulnerabilità e paure

Dire “ti amo”

Condividere fantasie sessuali

Condividere speranze per il futuro

Conoscere i reciproci gusti

Chiedere consigli

Sostenere il lavoro sulla salute mentale

Esplicitare apertamente i propri confini




I) Finanze

Avere un conto co-intestato

Contribuire equamente alle spese

Supporto economico

Regali costosi




J) Altro




(Le lettere prima del nome della categoria servono solo ai fini di identificazione per la codifica dell’id domanda ma non sono visibili nella ui/ux per l’utente)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6dc18ec2-6fa9-4fec-8780-2503529ee359).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
