# Stato finanziario di Lugano

**Lo stato delle finanze della Città di Lugano: la spesa 2025 rispetto al preventivo, voce per voce, con ogni cifra ricondotta al documento da cui viene. La pagina si chiama *Cielo del preventivo, Lugano* (in inglese, *Sky budget, Lugano*).**

> Versione italiana di [`README.md`](README.md). Il metodo completo in italiano è in [`METODO.md`](METODO.md).

Ognuna delle 72 voci di spesa 2025 della Città è una stella in un cielo da planetario. L'orizzonte è il preventivo: le voci
che hanno speso più del previsto salgono sopra, quelle che hanno speso meno scendono sotto, e più la stella è luminosa, più
la voce ha speso. Aprendo un settore si vede di che cosa è fatto, le spiegazioni della Città stessa e cifre su scuole,
sicurezza, trasporti, economia, debito e altro, ciascuna con la sua fonte. Un quadro d'insieme riunisce le entrate, il
debito fino al 2033, le obbligazioni, il personale e i dati che non sono pubblicati. In italiano e in inglese.

Sul telefono il cielo lascia il posto a una disposizione pensata per gli schermi piccoli: i settori come riquadri grandi
quanto la loro spesa, ogni settore come elenco degli scarti delle sue voci rispetto al preventivo, una scheda per ogni voce
con le sue pagine e le sue fonti, «Il tuo franco» (come un importo si ripartisce nelle proporzioni della spesa 2025) e una
tabella con ricerca. Stessi dati, stessi indirizzi: un collegamento condiviso da un telefono apre la stessa voce su un
computer. Su un computer le stesse viste sono a un clic: «Riquadri» mostra i riquadri accanto all'elenco delle voci di un
settore, per chi preferisce grafici semplici al cielo.

**Vederla:** https://nslotus.github.io/stato-finanziario-di-lugano/ · in locale: `npm ci && npm run serve`

> Progetto indipendente. Non è prodotto, rivisto né approvato dalla Città di Lugano o dal Cantone Ticino. Le cifre vengono
> dai loro documenti pubblici, archiviati qui senza modifiche. Controllate l'originale prima di basarvi su una cifra, e
> segnalate ogni errore aprendo una issue.

## Come fidarsi di una cifra

1. **Ogni documento è archiviato** in [`sources/`](sources/) esattamente come è stato scaricato, con la sua impronta SHA-256
   e il collegamento originale ([`FONTI.md`](FONTI.md)).
2. **Ogni cifra cita il suo documento e la posizione**: foglio, riga e colonna, oppure pagina e parole stampate
   ([`CIFRE.md`](CIFRE.md)).
3. **Nessuna cifra è battuta a mano.** Il codice legge ogni valore dal documento archiviato; la pagina mostra soltanto il
   risultato.
4. **I controlli fermano la ricostruzione** quando le parti non sommano ai totali stampati, quando due fonti non concordano o
   quando un documento non dice ciò che ci si aspetta ([`METODO.md`](METODO.md#6-controlli)).
5. **Chiunque può rifare tutto**, senza connessione e senza alcuna chiave: `npm run verify` ricostruisce tutti i dati dai
   documenti archiviati, conferma che i file sono identici byte per byte, ricalcola ogni somma e ogni rango, e confronta
   ogni cifra, ogni voce della tabella 2025 e ogni dicastero e centro di responsabilità con la sua pagina stampata,
   rileggendo i PDF una seconda volta con un lettore indipendente. `npm run verify:selftest` inserisce errori noti e
   conferma che i controlli li trovano. GitHub Actions esegue entrambi a ogni modifica.

## Repository

| Percorso | Che cos'è |
|---|---|
| [`docs/`](docs/) | La pagina (pubblicata da GitHub Pages). `data/data.js` e `data/data-more.js` sono generati; `assets/app.js` (il cielo) e `assets/phone.js` (telefoni, riquadri) non contengono cifre |
| [`sources/`](sources/) | I documenti archiviati e [`MANIFEST.json`](sources/MANIFEST.json) |
| [`src/`](src/) | I lettori (`adapters/`), un modulo per settore, i costruttori (`build.ts`, `personale.ts`, `site.ts`, `docs.ts`) e `verify.ts` |
| [`catalog/`](catalog/) | Le cifre lette dalle fonti: i dati leggibili da una macchina di questo progetto |
| [`translations/`](translations/) | I nomi inglesi delle voci e dei dicasteri, e la versione italiana di ogni indicazione di fonte (entrambi non ufficiali) |
| [`method/`](method/) | La mappa delle fonti di ogni settore: che cosa è stato cercato, trovato, letto e scartato (in inglese) |
| [`METODO.md`](METODO.md) | Come le cifre vengono lette, definite, calcolate e controllate ([`METHOD.md`](METHOD.md) in inglese) |
| [`PROVENANCE.md`](PROVENANCE.md) | Da dove vengono il codice e i dati, e che cosa è cambiato (in inglese) |

## Due lingue, aggiornate insieme

I documenti esistono in inglese e in italiano e **vanno aggiornati insieme, nella stessa modifica**:

| Inglese | Italiano | Come restano allineati |
|---|---|---|
| [`README.md`](README.md) | [`LEGGIMI.md`](LEGGIMI.md) | a mano; `npm run verify` (controllo 12) fallisce se le sezioni o le cifre non coincidono |
| [`METHOD.md`](METHOD.md) | [`METODO.md`](METODO.md) | a mano; stesso controllo |
| [`SOURCES.md`](SOURCES.md) | [`FONTI.md`](FONTI.md) | generati entrambi da `npm run docs` |
| [`FIGURES.md`](FIGURES.md) | [`CIFRE.md`](CIFRE.md) | generati entrambi da `npm run docs` |

La pagina stessa è in entrambe le lingue; le indicazioni delle fonti in italiano sono in
[`translations/sources-it.json`](translations/sources-it.json) (controllo 9). [`CHANGELOG.md`](CHANGELOG.md),
[`PROVENANCE.md`](PROVENANCE.md), le mappe delle fonti in [`method/`](method/) e i commenti del codice sono solo in inglese.

## Comandi

```
npm ci                 # install the locked dependencies (Node.js 25.9.0, see .nvmrc; CI uses the same)
python -m pip install --require-hashes --only-binary=:all: -r requirements-verify.txt   # pypdf, for check 15
npm run verify         # every check, including a full rebuild from the archived sources
npm run verify:quick   # every check except the rebuild
npm run verify:selftest  # plants known errors and requires the checks to catch them
npm run all            # rebuild: build → staff → site → docs
npm run serve          # view the page at http://127.0.0.1:8080/
```

(Installare le dipendenze fissate con Node.js 25.9.0; installare pypdf per il controllo 15; tutti i controlli con la
ricostruzione completa; tutti tranne la ricostruzione; il test dei controlli; ricostruire tutto; vedere la pagina in locale.)

## Licenze

- **Codice**: [MIT](LICENSE).
- **Dati e testi** scritti per questo progetto (`catalog/`, `docs/data/`, `translations/`, la documentazione e i testi della
  pagina): [CC BY 4.0](LICENSE-DATA.md). Citazione: *nslotus, Stato finanziario di Lugano*, e gli editori originali.
- **Documenti archiviati** in `sources/`: restano soggetti alle condizioni dei loro editori ([`sources/README.md`](sources/README.md)).
- **Caratteri tipografici**: SIL Open Font License ([`docs/assets/fonts/`](docs/assets/fonts/)).

Realizzato da [nslotus](https://github.com/nslotus). Correzioni e domande: aprite una issue. Sicurezza: [`SECURITY.md`](SECURITY.md).
