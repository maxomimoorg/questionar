# Tag profilo, confronto e anteprima condivisa

## Tag del profilo

- Centralizzare l’elenco dei tag e delle icone, aggiungendo **sport**, **spirituale** e **attivista** agli otto già presenti.
- Mostrare sotto il testo della bio, nel proprio profilo, soltanto i tag attivi con lo stesso linguaggio visivo dell’editor ma in versione più compatta.
- Garantire la compatibilità con i profili già salvati, trattando i nuovi tag e gli eventuali dati mancanti come inattivi.

## Dati condivisi e backup

- Includere i tag nella fotografia del profilo scambiata con i contatti, così che aggiornamenti, richieste e connessioni li trasmettano insieme a bio e risposte.
- Includere i tag nel PNG di backup e recuperarli sia nel confronto diretto da creatura sia nel ripristino del proprio questionario.
- Conservare la lettura dei vecchi backup e dei vecchi contatti che non contengono ancora i tag.

## Confronto a due o tre profili

- Inserire una tagcloud nella sezione delle bio, senza mostrare i tag che nessun partecipante ha attivato.
- Applicare questi stati:
  - attivo solo per te: aspetto spento/neutro;
  - attivo solo per l’altro nel confronto a due: bordo rosso;
  - attivo per uno dei due altri nel confronto a tre: bordo giallo;
  - attivo per entrambi gli altri nel confronto a tre: bordo rosso;
  - attivo per te e per almeno un altro partecipante: riempimento verde/turchese con testo e icona ad alto contrasto.
- Rendere cliccabile ogni tag che tu non hai attivato: apre subito **Modifica profilo** con quel tag già selezionato, ma non salva nulla finché non premi **Salva**. **Annulla** lascia invariato il profilo.

## Anteprima dei link condivisi

- Creare una grafica social orizzontale dedicata a QuestionAR, coerente con i colori pastello e centrata sul questionario a slider, senza mostrare l’homeboarding.
- Collegarla ai metadati della pagina principale per le anteprime nelle chat, usando l’indirizzo pubblico assoluto dell’immagine e mantenendo titolo e descrizione QuestionAR.

## Verifica

- Controllare i casi tag nel confronto a due e a tre, inclusi profili/backup precedenti senza tag.
- Verificare il passaggio dal tag alla modifica profilo e il comportamento Salva/Annulla.
- Verificare profilo e confronto su mobile e desktop, leggibilità nei temi giorno/notte e metadati dell’anteprima social.

## Dettagli tecnici

- Estendere `ProfileSnapshot` e `BackupPayload` con una mappa opzionale di tag per retrocompatibilità.
- Aggiungere alla ricerca della pagina profilo un parametro opzionale per il tag da preselezionare; l’editor riceverà questa selezione come stato iniziale temporaneo.
- Usare token semantici per gli stati neutro, rosso, giallo e verde/turchese e un’immagine social statica in formato adatto alle anteprime chat.