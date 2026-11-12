# Categorie, elementi nascosti ed Erotismo

## Espandi / Comprimi tutte

Un pulsante a pillola apre o chiude tutte le categorie insieme nel questionario principale (tra bio e domande), nel confronto principale, in Erotismo e nel confronto Erotismo. Il testo indica l'azione disponibile: con categorie miste propone «Espandi tutte».

Alla sua sinistra, nel questionario principale e in Erotismo, la pillola «Proteggi con password» gestisce la password di quel questionario (vedi [Protezione con password](protezione-password.md)).

## Conteggio del completamento

L'intestazione di ogni categoria mostra `completate/visibili` (es. `3/12`). Le domande nascoste singolarmente non contano. A completamento appare `N ✓`. Una domanda Fare/Ricevere è completata solo con entrambi gli slider; una risposta parziale resta usata nei confronti come stima. Senza domande visibili si mostra `0`, senza spunta.

## Nascondere categorie e domande

- Stato della categoria (`hiddenCategories`) e stato della domanda (`answer.hidden`) sono indipendenti.
- Nascondere/ripristinare una categoria non modifica mai `answer.hidden`.
- Una domanda è nascosta se è nascosta singolarmente **oppure** lo è la sua categoria.
- La sezione «Categorie e domande nascoste» (una per il questionario principale, una per Erotismo) mostra i gruppi delle categorie nascoste (con le domande non nascoste singolarmente) e, a parte, le domande nascoste singolarmente.
- Le domande nascoste da chiunque partecipi al confronto sono escluse da confronti e medie.

## Erotismo

Sezione facoltativa con proprie categorie (chiavi che iniziano con `X`, es. `XA`), definite in `src/lib/questions.ts` (`EROTISMO_CATEGORIES`, `EROTISMO_DEFAULTS`); al momento è vuota. Usa le stesse risposte, lo stesso backup e lo stesso scambio cifrato del questionario principale. Le sue categorie si aprono solo su scelta dell'utente. Può avere una propria password, indipendente da quella del questionario generale: chi non la conosce vede solo le medie delle categorie di Erotismo. Nel confronto ha una pagina dedicata (`/confronto/erotismo`); le sue domande entrano una sola volta nella compatibilità generale e la sua media compare come una categoria.

## Compatibilità

`hiddenCategories` viaggia nel profilo condiviso e nel backup PNG (campo facoltativo: le versioni precedenti lo ignorano e chi lo omette ha zero categorie nascoste). Resta in chiaro anche quando una sezione è protetta da password; i campi `mainAverages`/`mainProtected` ed `eroticAverages`/`eroticProtected` sono facoltativi allo stesso modo.
