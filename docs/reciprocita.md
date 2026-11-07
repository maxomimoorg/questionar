# Domande a reciprocità (Fare / Ricevere)

La maggior parte delle domande è a **somiglianza**: più le due risposte sono vicine, più alta è la
compatibilità. Alcune domande descrivono invece qualcosa che si dà e si riceve: per queste
l'app mostra **due slider, "Fare" e "Ricevere"**, e il confronto è **incrociato**.

## Domande a reciprocità (20)

- **Linguaggi d'amore:** Contatto fisico · Parole d'affermazione · Regali · Atti di servizio ·
  Dolcezza, piccole grandi attenzioni, gentilezza · Vocali lunghi come audiolibri
- **Intimità fisica:** Coccole e gesti fisici di affetto · Sesso orale · Petting · Masturbazione ·
  Penetrazione con oggetti · Penetrazione genitale · Gioco kinky (fetish/BDSM)
- **Intimità emotiva:** Supporto nei momenti difficili · Consigli · Sostegno nel lavoro sulla
  salute mentale · Condividere vulnerabilità e paure · Condividere fantasie sessuali
- **Finanze:** Supporto economico · Regali costosi

Le domande personalizzate sono sempre a somiglianza. L'elenco è in `src/lib/questions.ts`
(voci marcate con `r(...)`).

## Calcolo

La funzione di base `questionCompat(a, b, criticalCount)` e le curve delle domande critiche
sono **invariate**. Per una domanda a reciprocità tra A e B (`src/lib/compat.ts`):

```
flusso A ➔ B = questionCompat(Fare di A, Ricevere di B, critiche)
flusso B ➔ A = questionCompat(Fare di B, Ricevere di A, critiche)
punteggio    = arrotondamento((A ➔ B + B ➔ A) / 2)
```

Con tre persone si fa la media dei punteggi di ogni coppia (come per le altre domande);
il numero di persone che ha segnato la domanda come critica conta su tutti i partecipanti.

Esempi:

| A (Fare/Ricevere) | B (Fare/Ricevere) | A ➔ B | B ➔ A | Domanda |
| --- | --- | --- | --- | --- |
| 90 / 20 | 20 / 90 | 100% | 100% | **100%** |
| 100 / 0 | 100 / 0 | 0% | 0% | **0%** |
| 100 / 0 (critica) | 100 / 0 | −25% | −25% | **−25%** |
| 80 / – | 20 / 70 | 90% | in attesa | **90% ±45%** (stima) |
| 80 / – | 40 / – | in attesa | in attesa | non confrontabile |

## Risposte parziali

Si può rispondere a uno solo dei due slider: la domanda vale come **risposta parziale**.
Il lato mai toccato **non viene considerato** (non vale 50%):

- un flusso si calcola solo se chi dà ha risposto a "Fare" e chi riceve a "Ricevere";
- il punteggio della domanda è la media dei soli flussi calcolabili ed è segnato come
  **stima** con margine d'errore (`90% ±45%`); se nessun flusso è calcolabile la domanda non entra nel confronto;
- con tre persone, una coppia senza flussi calcolabili viene esclusa e il risultato è una stima;
- le stime **entrano nei totali** (complessivo, per categoria, per coppia), che mostrano la
  il margine "±N%" (media dei margini delle domande) e una nota con il numero di domande parziali incluse.

Le curve delle domande critiche si applicano anche al singolo flusso noto.

## Dati e compatibilità con versioni precedenti

- `Answer` ha due campi facoltativi, `giveValue` (Fare) e `receiveValue` (Ricevere), 0–100.
  `value` resta presente ed è la media arrotondata dei due, così chi usa una versione
  precedente dell'app continua a vedere una risposta sensata.
- Una risposta salvata con il solo `value` (né Fare né Ricevere) vale come
  Fare = Ricevere = `value`: il risultato coincide con il vecchio calcolo.
- Una risposta con un solo lato (`giveValue` oppure `receiveValue`) è parziale; il suo `value`
  è il valore del lato noto, così le versioni precedenti vedono comunque una risposta.
- `sanitizeSnapshot()` (e il caricamento dei backup PNG) tiene `giveValue`/`receiveValue` solo
  se sono numeri, limitati a 0–100.
- Le domande riformulate ("Masturbazione", "Vocali lunghi come audiolibri", "Supporto nei
  momenti difficili", "Consigli", "Sostegno nel lavoro sulla salute mentale") mantengono
  l'identificativo del testo precedente: le risposte già salvate e quelle dei contatti con
  versioni precedenti continuano a corrispondere.

## Interfaccia

- **Profilo:** la scheda mostra gli slider "Fare" e "Ricevere" (trascinamento, tocco sulla
  traccia, frecce da tastiera). Commento, domanda critica e nascondi valgono per l'intera
  domanda. Toccando un solo slider la risposta è parziale: l'altro resta neutro ("?") e la
  scheda invita a completarlo.
- **Confronto:** per ogni direzione c'è una traccia "Io faccio ➔ Luna riceve" /
  "Luna fa ➔ io ricevo" con il proprio punteggio; sotto, la compatibilità della domanda.
  Un verso non calcolabile mostra "in attesa di risposta" e chi deve ancora rispondere; il
  punteggio diventa `N% ±M%` con la nota "Compatibilità parziale".

Test: `src/test/reciprocal-compat.test.ts`.

## Margine d'errore (±)

Per ogni verso mancante si considera tutto l'intervallo che potrebbe ancora assumere
(dalla curva usata: distanza 100 → minimo, distanza 0 → massimo). Il margine è lo
scostamento massimo tra la stima mostrata e il valore finale possibile, arrotondato.
Esempio: verso noto 90%, verso ignoto tra 0% e 100% → risultato reale tra 45% e 95% →
`90% ±45%`. Nel confronto a tre una coppia senza versi calcolabili entra nel margine con
l'intero intervallo. Medie di categoria e totali usano la media dei margini delle
domande. Il "±" è sempre grigio, non colorato.
