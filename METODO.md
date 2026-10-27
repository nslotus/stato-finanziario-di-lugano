# Metodo

Come ogni cifra della pagina viene trovata, letta, calcolata e controllata, e come potete controllarla voi stessi.

> Versione italiana di [`METHOD.md`](METHOD.md), tradotta con l'aiuto di un assistente IA e da rivedere da una persona di
> madrelingua. I due file vanno aggiornati insieme: `npm run verify` (controllo 12) segnala un errore se le loro sezioni o
> le cifre che contengono non coincidono. In caso di dubbio fa fede il codice, che entrambi descrivono.

- [1. Che cosa mostra la pagina](#1-che-cosa-mostra-la-pagina)
- [2. Dai documenti alla pagina](#2-dai-documenti-alla-pagina)
- [3. Fonti e archiviazione](#3-fonti-e-archiviazione)
- [4. Come vengono lette le cifre](#4-come-vengono-lette-le-cifre)
- [5. Definizioni e calcoli](#5-definizioni-e-calcoli)
- [6. Controlli](#6-controlli)
- [7. Dove è stato usato un assistente informatico](#7-dove-è-stato-usato-un-assistente-informatico)
- [8. Scelte, limiti e differenze note](#8-scelte-limiti-e-differenze-note)
- [9. Controllare da sé](#9-controllare-da-sé)

File di accompagnamento: [`FONTI.md`](FONTI.md) (ogni documento, con la sua impronta), [`CIFRE.md`](CIFRE.md) (ogni cifra,
con valore e posizione), [`PROVENANCE.md`](PROVENANCE.md) (da dove vengono il codice e i dati, in inglese) e le mappe delle
fonti in [`method/`](method/), una per settore, scritte mentre ogni fonte veniva cercata e letta (in inglese).

## 1. Che cosa mostra la pagina

**Il cielo.** Ognuna delle 72 voci di spesa 2025 della Città di Lugano (le funzioni a tre cifre della contabilità, oppure a
due cifre quando una funzione non ha voci sotto di sé) è una stella. Le stelle sono raggruppate in dieci spicchi, uno per
funzione (da 0 Amministrazione generale a 9 Finanze e imposte).

- **L'altezza** è lo scarto tra quanto la voce ha speso nel 2025 (il consuntivo) e quanto prevedeva il preventivo 2025.
  L'orizzonte è il preventivo. Sopra, la voce ha speso più del previsto; sotto, meno. Lo scarto può essere mostrato in
  franchi o in percentuale.
- **La luminosità e la grandezza** seguono quanto la voce ha speso nel 2025.
- Lo stesso cielo può essere disposto **per dicastero** (i sette dicasteri della Città, le loro divisioni e 85 centri di
  responsabilità), dove le spiegazioni della Città su ogni scarto sono citate dal suo messaggio sul consuntivo 2025.

**Le cifre di ogni settore.** Aprendo uno spicchio si vedono i suoi gruppi di voci, la sua spesa 2023–2027 e le altre cifre
del settore (allievi, passeggeri, reati, posti di lavoro, debito e così via), ciascuna con la sua spiegazione, il confronto,
il metodo e le fonti. Nella vista per dicastero, ogni dicastero mostra il suo personale e gli stipendi lordi per servizio.

**Il quadro** riunisce i conti: la spesa totale per anno, le entrate, la spesa per settore, il risultato d'esercizio, gli
investimenti e l'autofinanziamento, il debito fino al 2033, le obbligazioni, gli interessi e i rimborsi, il confronto di
Lugano con i comuni ticinesi, la spesa per il personale e i dati che non sono pubblicati.

**Sui telefoni** (schermi fino a 720 px di larghezza), e su un computer nella vista **«Riquadri»**, gli stessi dati sono
mostrati senza il cielo (su un computer i riquadri e l'elenco di un settore stanno uno accanto all'altro):

- **I settori come riquadri.** Ogni funzione (o dicastero) è un rettangolo la cui area è la sua spesa 2025 (una treemap
  squarificata). Il colore è il suo scarto in percentuale: grigio se in linea con il preventivo, più caldo sotto, più
  freddo sopra, a piena intensità da ±6%. Il numero nel riquadro è quanto ha speso, in milioni di franchi. Un riquadro
  troppo piccolo per la sua etichetta è anche elencato sotto la mappa.
- **Un settore** elenca le sue voci dallo scarto più grande al più piccolo, ciascuna come una barra a sinistra (speso meno)
  o a destra (speso di più) di una linea che rappresenta il preventivo, in franchi o in percentuale. Le voci senza
  preventivo sono elencate con quanto hanno speso e «non a preventivo». Per le funzioni sono mostrati la cifra per
  abitante del settore (2024) e il suo rango in Ticino.
- **La scheda di una voce** dà preventivo, consuntivo e scarto, la spiegazione della Città quando c'è, le pagine dei due
  messaggi e le fonti, e apre la stessa scheda completa che su un computer.
- **Il tuo franco** ripartisce un importo scritto da chi legge nelle proporzioni della spesa 2025 per funzione (o
  dicastero): importo × spesa del settore ÷ spesa totale. Ogni quadratino è un franco su cento, arrotondato, quindi i
  quadratini possono non sommare esattamente 100. Mostra solo proporzioni: la spesa della Città non è pagata solo dalle
  imposte, e l'importo è quello di chi legge, non un conto delle imposte.
- **La tabella** elenca ogni voce con spesa o preventivo, cercabile per nome o codice, ordinata per scarto, spesa o codice.

Ogni cifra è elencata in [`CIFRE.md`](CIFRE.md).

## 2. Dai documenti alla pagina

```
sources/*            archived documents (PDF, Excel, CSV, HTML), each with its SHA-256 in sources/MANIFEST.json
   │  npm run build   src/build.ts and one module per sector (src/*.ts), with the readers in src/adapters/
   ▼
catalog/stars.json   86 figure records ("stars"), the overview chapters and relations
catalog/funzioni.json   spending by function 2023–2027 and the 72 lines of 2025 (budget and actual)
catalog/dicasteri.json  2025 budget and actual by department, division and cost centre, with the City's explanations
   │  npm run staff   src/personale.ts
catalog/personale.json  staff units and gross salaries by department and cost centre (2025 actual)
   │  npm run site    src/site.ts
   ▼
docs/data/data.js       every number the tiles, lists, sky and table are drawn from (read first)
docs/data/data-more.js  what only a card or the overview shows: explanations, methods, sources, comparisons, the City's
                        texts (read right after the first screen; src/sitedata.ts splits and joins the two exactly)
docs/index.html         the page; docs/assets/app.js and phone.js only read the two data files and contain no number
   │  npm run docs    src/docs.ts
   ▼
SOURCES.md, FIGURES.md   generated tables (and FONTI.md, CIFRE.md in Italian)
```

Lo schema mostra i nomi dei file e dei comandi così come sono nel repository. In italiano: `sources/` contiene i documenti
archiviati, ciascuno con la sua impronta SHA-256; `npm run build` li legge e produce il catalogo (`catalog/`: 86 schede di
cifre o «stelle», i capitoli del quadro, la spesa per funzione 2023–2027, le 72 voci del 2025, preventivo e consuntivo per
dicastero, divisione e centro di responsabilità con le spiegazioni della Città); `npm run staff` aggiunge il personale;
`npm run site` scrive i due file di dati della pagina (`data.js`, letto per primo, e `data-more.js`, letto subito dopo);
`npm run docs` genera le tabelle [`SOURCES.md`](SOURCES.md) e [`FIGURES.md`](FIGURES.md) e le loro versioni italiane
[`FONTI.md`](FONTI.md) e [`CIFRE.md`](CIFRE.md). La pagina (`docs/assets/app.js` e `phone.js`) legge soltanto i due file
di dati e non contiene alcuna cifra.

Sette file vengono da un progetto pubblico separato, [`nslotus/dati-di-lugano`](https://github.com/nslotus/dati-di-lugano),
che legge i PDF finanziari della Città (debito, risultati, obbligazioni, scuole, mobilità). Sono archiviati qui con nomi che
riportano il commit da cui sono stati presi (per esempio `dati-di-lugano@8c1fd28-debt-profile.json`), quindi non possono
cambiare. Come sono stati prodotti è documentato in
[`METHODOLOGY.md`](https://github.com/nslotus/dati-di-lugano/blob/main/METHODOLOGY.md) e
[`TRACE.md`](https://github.com/nslotus/dati-di-lugano/blob/main/TRACE.md) di quel progetto. Dal 22 ottobre 2026 quel
progetto è archiviato (in sola lettura), quindi i collegamenti fissati continuano a funzionare; le sue domande aperte sui
dati mancanti sono ora le issue di questo repository.

Il vocabolario del codice: una **star** («stella») è una scheda di cifra; una **constellation** («costellazione») è un
settore; l'**anchor** («àncora») di un settore è la sua spesa per abitante; il **ledger** è l'insieme dei capitoli del
quadro; nelle tabelle del personale, un **planet** («pianeta») è un dicastero e una **moon** («luna») uno dei suoi servizi.

## 3. Fonti e archiviazione

Ogni documento è conservato in [`sources/`](sources/) esattamente come è stato scaricato. [`sources/MANIFEST.json`](sources/MANIFEST.json)
registra per ciascuno: il file, l'indirizzo originale, l'editore, il momento in cui è stato scaricato, la dimensione e
l'impronta SHA-256. [`FONTI.md`](FONTI.md) li elenca con il numero di cifre che citano ciascuno.

- La ricostruzione non scarica mai nulla: legge soltanto i file archiviati.
- Un documento non viene mai modificato. Se un editore pubblica una nuova versione, viene archiviata come nuovo file e le
  cifre che la usano vengono ricostruite.
- Alcuni collegamenti originali non restituiscono più lo stesso file (per esempio una pagina che è stata aggiornata). La
  copia archiviata e la sua impronta sono ciò da cui le cifre sono state lette.

Ogni scheda di cifra cita almeno un file archiviato e una **indicazione di posizione**: il foglio, la riga e la colonna di
un foglio di calcolo, oppure la pagina (numero di pagina del PDF, prima pagina = 1) e le parole stampate di un PDF.

## 4. Come vengono lette le cifre

**Fogli di calcolo** (Cantone Ticino, uffici federali). I fogli sono trovati dal loro titolo, le righe dal nome o dal numero
del comune, le colonne dal testo della loro intestazione, mai dalla posizione: un file riordinato fa fallire la
ricostruzione invece di essere letto male. I conti dei comuni del Cantone sono in migliaia di franchi. I comuni sono
collegati al registro 2024 dei 106 comuni tramite il loro numero federale; le poche differenze di nome sono elencate
esplicitamente in `src/adapters/municipalities.ts`.

**PDF** (messaggi, presentazioni e rapporti della Città). Il testo delle pagine necessarie è estratto con pdf.js
(`src/adapters/pdf.ts`). I valori sono letti con schemi che corrispondono alle parole stampate intorno a essi (l'etichetta
di una riga, una frase) e alla posizione del valore nella sua riga (per esempio consuntivo, preventivo, differenza). Il
valore è preso così come è stampato; nulla viene ribattuto. Dove una tabella stampa un totale, le parti vengono sommate e
devono corrispondere.

**PDF finanziari della Città letti a monte.** Alcune cifre delle presentazioni del consuntivo, dei comunicati sui preventivi
e dei comunicati sulle scuole e sulla mobilità sono state lette in `dati-di-lugano` con un modello linguistico che può solo
*scegliere* tra i numeri che il codice ha già trovato nel documento; non scrive mai un numero. Una cifra è stata accettata
con una probabilità combinata di almeno 0.8; le altre sono state controllate a mano. Ognuna di queste cifre è elencata con
la sua pagina e la riga stampata nel [`TRACE.md`](https://github.com/nslotus/dati-di-lugano/blob/main/TRACE.md) di quel
progetto. In questa pagina sono: le cifre del debito e il suo percorso, la tabella preventivo-consuntivo del 2024 e del 2025
(letta dalla tabella per posizione, senza modello), gli allievi e le classi delle scuole, le cifre di TPL e PubliBike, e il
calendario degli interessi delle obbligazioni (calcolato dalle loro condizioni).

## 5. Definizioni e calcoli

| Termine | Significato nella pagina |
|---|---|
| Preventivo 2025 per funzione | La proposta del Municipio, come stampata per funzione nel messaggio sul preventivo 2025. Il Consiglio comunale ha modificato il totale di CHF 100'000 in un dicastero, che la tabella per funzione non attribuisce; il quadro mostra entrambi i totali. |
| Consuntivo 2025 | I conti finali nel messaggio della Città sul consuntivo 2025 (aprile 2026). |
| Scarto | Consuntivo − preventivo, in milioni di franchi, e (consuntivo − preventivo) ÷ preventivo in percentuale. |
| Per abitante | Diviso per i 63'629 abitanti permanenti di Lugano al 31 dicembre 2024 (definizione federale), la base che il Cantone usa per tutti i 106 comuni. La Città pubblica conteggi propri più alti (64'430 nel suo registro; 68'507 includendo i residenti secondari); non sono usati perché non esistono per gli altri comuni. Per abitante non significa per contribuente. |
| Rango | La posizione di Lugano fra i 106 comuni ticinesi, 1 = valore più alto, con la mediana. I ranghi confrontano solo il Ticino. Le cifre sono classificate solo dove un confronto ha senso per un abitante; il metodo di ogni cifra dice quando non lo è. |
| Rango negli indicatori del Cantone | Nella tabella degli indicatori del Cantone (quadro, «Come si confronta in Ticino») il rango 1 è il valore migliore secondo la scala del Cantone, quindi la stessa posizione può essere 96° lì e 11° valore più alto fra le cifre. Il controllo al §6 conferma che coincidono. |
| ufficiale / derivata | *ufficiale*: stampata dall'editore. *derivata*: calcolata qui da cifre ufficiali; il metodo della cifra indica il calcolo. |
| Stima | Indicata come tale nella pagina, mai presentata come cifra della Città (per esempio il debito di fine 2026 implicito nel preventivo). |

**Regole di disegno** (senza effetto su alcuna cifra): l'altezza di una stella è compressa perché gli scarti grandi e piccoli
restino entrambi visibili; ogni scarto diverso da zero parte qualche grado sopra o sotto l'orizzonte; le voci il cui scarto
arrotondato è zero (sotto i CHF 5'000, o 0.05% in percentuale) sono disegnate come rombi sull'orizzonte; le voci senza
preventivo né spesa non sono disegnate, ma restano nella tabella.

## 6. Controlli

I livelli sono tre. Ognuno si ferma con un errore invece di produrre una cifra dubbia.

### 6.1 Durante la lettura delle fonti (`npm run build`, `npm run staff`)

I moduli dei settori e i lettori contengono circa 270 condizioni che fermano la ricostruzione. I tipi principali:

| Tipo di controllo | Esempi |
|---|---|
| Le parti sommano al totale stampato | le voci di una funzione sommano alla funzione (preventivo e consuntivo); le funzioni sanitarie a due cifre sommano alla funzione 4; le sedi scolastiche sommano al totale stampato dal Cantone; il personale di ogni dicastero somma al dicastero e al totale della Città; le vendite di beni del piano sommano ai suoi incassi annui |
| Le differenze stampate tornano | nelle tabelle preventivo-consuntivo, consuntivo − preventivo = la differenza stampata, al centesimo |
| Due fonti concordano | la popolazione del Cantone è uguale a quella dell'Ufficio di statistica per ogni comune; il conto 340 letto qui è uguale al valore usato a monte; il debito netto per abitante del Cantone implica la stessa popolazione per Lugano |
| I collegamenti sono completi | tutti i 106 comuni corrispondono fra i file; ogni cifra ha una fonte; ogni collegamento fra cifre si risolve |
| Il documento dice ciò che ci si aspetta | un'etichetta di riga, una frase o un'intestazione non trovata ferma la ricostruzione invece di leggere un valore vicino |

Le mappe delle fonti in [`method/`](method/) elencano i controlli di ogni settore accanto alle sue fonti.

### 6.2 Durante la costruzione della pagina (`npm run site`)

`src/site.ts` controlla che le voci di ogni funzione sommino alla funzione (preventivo e consuntivo), che i centri di
responsabilità sommino alle loro divisioni e ai dicasteri e che i dicasteri sommino allo stesso totale delle funzioni, che
le entrate meno la spesa siano uguali al risultato 2024, che le funzioni sommino ai totali annui 2023–2027, che ogni cifra
del catalogo sia nella pagina, che ogni relazione abbia i confronti che le servono, che le quote di obbligazioni del debito
si ricalcolino, che ogni nome abbia un nome inglese e che ogni fonte citata sia nel manifest.

### 6.3 `npm run verify` (eseguito anche a ogni modifica da GitHub Actions)

**Indipendenza.** I controlli da 4 a 7 e il 9 ricalcolano dai dati della pagina con codice proprio, non con quello della
ricostruzione, quindi un errore nella ricostruzione non può nascondersi. I controlli 8, 13 e 14 leggono i PDF con pdf.js, il
lettore usato anche dalla ricostruzione, ma con metodi propri: un valore è trovato dal codice della sua riga e
dall'intestazione della sua colonna, oppure dall'aritmetica che la Città stampa sulla stessa riga (differenza = consuntivo −
preventivo, e lo stesso rispetto al 2024), non dalle regole di posizione della ricostruzione. Il controllo 15 ripete i
controlli 8 e 13 con **pypdf**, un lettore di PDF separato scritto in Python che non condivide codice con pdf.js, e per la
tabella della spesa 2025 non usa alcuna posizione di colonna: in ogni riga i costi sono l'importo che l'aritmetica della
riga stessa (costi − ricavi = −saldo) consente. Un difetto in uno dei due lettori dovrebbe quindi produrre lo stesso numero
sbagliato in due programmi indipendenti per passare. Il controllo 11 dimostra che i file possono essere riprodotti
esattamente dalle fonti archiviate; da solo non dimostra che siano corretti, ed è a questo che servono gli altri controlli. I
file nel repository sono stati generati con Node.js 25.9.0 (`.nvmrc`), e GitHub Actions usa la stessa versione.

**Copertura.** Ogni cifra ufficiale letta da un PDF (25), ogni voce, gruppo e funzione della tabella 2025 e il totale della
Città in entrambi i messaggi (252 valori), e ogni dicastero, divisione e centro di responsabilità del consuntivo 2025 (111
unità; le 9 divisioni che hanno sia una tabella propria sia una riga nella tabella riassuntiva del loro dicastero sono
confrontate in entrambe) viene confrontato con la sua pagina stampata. Un numero è trovato solo come numero intero, mai
dentro un altro («675» non corrisponde a «1'675»). L'unico valore della vista per dicastero non stampato come tale è `40··`,
la parte della divisione 40 Spazi urbani che le tabelle dei suoi centri non coprono: è il totale stampato della divisione
meno i suoi centri, e le somme del controllo 4 lo coprono.

**Le tolleranze** sono fissate appena sopra ciò che l'arrotondamento consente, e viene indicata la differenza più grande
effettivamente trovata.

| # | Controllo | Che cosa confronta | Tolleranza |
|---|---|---|---|
| 1 | Le fonti corrispondono alle loro impronte | dimensione e SHA-256 di ogni file archiviato rispetto al manifest; i nomi dei file corrispondono esattamente, maiuscole comprese | esatta |
| 2 | Citazioni | ogni file citato è archiviato; ogni file archiviato è citato; in `sources/` non c'è altro | esatta |
| 3 | Fissazioni a monte | ogni file da `dati-di-lugano` riporta il commit del suo indirizzo | esatta |
| 4 | Somme | voci → gruppi → funzioni, centri → divisioni → dicasteri (consuntivo e preventivo), funzioni = dicasteri (consuntivo; il preventivo differisce per la modifica di CHF 100'000 del Consiglio comunale, attribuita solo per dicastero), funzioni → totali annui, percentuali ricalcolate | CHF 0.05 (trovata: CHF 0.01); totali annui stampati in altri documenti CHF 2 (trovata: CHF 1.42) |
| 5 | Preventivo e consuntivo | consuntivo − preventivo = differenza stampata, 18 righe | CHF 0.05 (trovata: 0) |
| 6 | Ranghi e mediane | ogni rango e mediana ricalcolati dai 106 valori; il valore di Lugano è uguale alla cifra | esatta (mediana 1e-6) |
| 7 | Rango negli indicatori del Cantone | rango del Cantone = 106 − rango della pagina + 1 per il debito netto per abitante | esatta |
| 8 | Stampata sulla pagina | ogni cifra ufficiale letta da un PDF è stampata sulla pagina citata, entro le pagine citate, o ovunque nel documento quando l'indicazione non nomina una pagina (in franchi, migliaia o milioni); un totale che il documento non stampa (vendite di beni previste, 306.1 mio) deve essere uguale alla somma di una serie della scheda, ogni parte stampata su una pagina citata | come stampata |
| 9 | Nomi e fonti | ogni nome italiano ha un nome inglese; ogni indicazione di fonte ed editore che la pagina mostra ha una versione italiana; nessuno è inutilizzato | esatta |
| 10 | Igiene | nessuna chiave, token, percorso personale o indirizzo privato nel repository | — |
| 11 | Ricostruzione | `build`, `staff` e `site` rieseguiti dalle fonti archiviate danno file identici byte per byte | esatta |
| 12 | Documenti | `SOURCES.md`, `FIGURES.md`, `FONTI.md` e `CIFRE.md` sono ciò che `npm run docs` genera; `METODO.md` e `LEGGIMI.md` hanno le stesse sezioni e le stesse cifre di `METHOD.md` e `README.md` | esatta |
| 13 | La tabella sulla pagina | ognuna delle 72 voci, dei 43 gruppi e delle 10 funzioni, e il totale della Città, nel preventivo 2025 (pp. 221–223) e nel consuntivo 2025 (pp. 238–239): il numero nella colonna COSTI della riga con il suo codice; una riga senza costi ha quella colonna vuota. Con il controllo 4, le voci sono legate ai totali stampati dalla Città | CHF 0.006 (al centesimo) |
| 14 | I dicasteri sulla pagina | ogni centro di responsabilità e divisione con una tabella propria: la riga 3 (spese) della sua tabella nel consuntivo 2025, letta attraverso l'aritmetica stampata della riga; ogni dicastero e divisione: la sua riga nella tabella riassuntiva del dicastero, dalle intestazioni delle colonne | CHF 0.006; l'aritmetica della riga CHF 0.015 e 0.01 punti percentuali |
| 15 | Secondo lettore | i controlli 8 e 13 di nuovo con pypdf; per la tabella, i costi trovati solo dall'aritmetica di ogni riga | come i controlli 8 e 13 |

Il controllo 14 riporta ciò che trova nella fonte così come stampata: nel centro 4101 (Servizi generali, divisione 41
Polizia) le due differenze stampate non si ricalcolano dagli importi stampati (entrambe differiscono di CHF 16.97, come se
il consuntivo fosse CHF 4'948'323.76 invece dei CHF 4'948'306.79 stampati); la pagina usa il consuntivo stampato. In sei
nuovi centri senza colonna 2024 (1213, 1214, 1230, 1231, 1232, 1401) l'aritmetica della riga da sola consente due letture; il
controllo 14 le accetta entrambe, e decide il controllo 4: i preventivi dei centri devono sommare al preventivo della loro
divisione, che il controllo 14 legge dalla tabella riassuntiva stampata.

**I controlli fallirebbero?** `npm run verify:selftest`, eseguito anche da GitHub Actions, inserisce 19 errori noti uno alla
volta e richiede che falliscano i controlli attesi: il preventivo di una voce sbagliato di CHF 1'000; il consuntivo di una
voce letto dalla colonna dei ricavi; i consuntivi di due voci scambiati all'interno di una funzione (le somme del controllo
4 passano ancora; i controlli 13 e 15 falliscono); un centro di responsabilità sbagliato di CHF 10; il preventivo di un
dicastero sbagliato di CHF 1'000; il preventivo di un nuovo centro letto nell'altro modo che la sua riga consente (il
controllo 14 passa; il controllo 4 fallisce); una cifra sbagliata di un'unità, sulla sua pagina e attraverso le sue pagine
(675 incidenti stradali letti come 676); una parte di un elenco stampato letta male insieme al suo totale; un rango
sbagliato di uno; una differenza stampata, il rango del Cantone, un nome inglese o un'indicazione di fonte italiana,
l'impronta di una fonte e un commit a monte modificati; un file estraneo in `sources/`; una chiave di accesso in un file; una cifra modificata in `METHOD.md` ma non in questo file. I
file del repository sono ripristinati dopo ogni caso.

Il controllo 15 e il test dei controlli richiedono Python 3 con pypdf, fissato tramite impronta in
[`requirements-verify.txt`](requirements-verify.txt).

Il risultato dell'ultima esecuzione è in [`CHANGELOG.md`](CHANGELOG.md) (in inglese).

## 7. Dove è stato usato un assistente informatico

- **Estrazione a monte.** Come descritto al §4, alcune cifre dei PDF della Città sono state lette in `dati-di-lugano` con un
  modello linguistico che sceglie soltanto fra numeri trovati dal codice; quelle scelte sono elencate pagina per pagina nel
  suo `TRACE.md`. Nulla in questo repository richiede un modello o una chiave per essere ricostruito.
- **Nomi inglesi.** La contabilità dà i nomi delle voci, dei gruppi e dei dicasteri solo in italiano. I nomi inglesi in
  [`translations/labels-en.json`](translations/labels-en.json) sono stati redatti con un assistente IA e non sono ufficiali
  (vedi [`translations/README.md`](translations/README.md)). L'italiano resta il riferimento.
- **Indicazioni delle fonti in italiano.** Da dove viene ogni cifra (foglio, riga, colonna, pagina) è registrato in inglese,
  la lingua dei documenti di questo repository. La pagina italiana mostra queste indicazioni in italiano, da
  [`translations/sources-it.json`](translations/sources-it.json), redatto con un assistente IA: le parole del documento, i
  numeri di pagina, i codici e i nomi dei campi dei dati sono invariati (ogni indicazione italiana conserva gli stessi numeri
  dell'originale).
- **Questo documento e [`LEGGIMI.md`](LEGGIMI.md)** sono traduzioni di `METHOD.md` e `README.md` redatte con un assistente
  IA, da rivedere da una persona di madrelingua.
- **Codice e testi.** Il codice e i testi esplicativi sono stati scritti con l'aiuto di un assistente IA per la
  programmazione. Per questo nessuna cifra è battuta a mano: ogni cifra è letta dal codice da un documento archiviato, e i
  controlli descritti sopra, che chiunque può eseguire, sono ciò su cui le cifre si fondano.

## 8. Scelte, limiti e differenze note

- Il Cantone pubblica i conti dei comuni circa 14 mesi dopo la fine dell'anno, quindi i confronti con gli altri comuni usano
  il 2024; per il 2025 si usano i conti della Città stessa.
- I ranghi sono solo all'interno del Ticino, non a livello svizzero.
- Sopra o sotto il preventivo non è di per sé un bene o un male: può essere un risparmio, un lavoro non fatto o un bisogno in
  crescita. La pagina lo dice, e non colora mai uno scarto come buono o cattivo.
- Il piano finanziario 2026–2033 è l'intenzione del Municipio, presentata al Consiglio comunale per informazione; non viene
  votato.
- Le cifre delle obbligazioni sono le loro condizioni (ISIN, cedola, scadenza, volume); non vengono raccolti né mostrati
  prezzi di mercato.
- Dove due documenti della Città arrotondano lo stesso numero in modo diverso, la cifra usa quello che cita e la mappa delle
  fonti annota la differenza (per esempio [`method/OUTLOOK-SOURCES.md`](method/OUTLOOK-SOURCES.md)).
- Dove due documenti della Città danno cifre diverse per la stessa cosa, la pagina usa quella che l'aritmetica della Città
  stessa conferma e nomina l'altra. Investimenti netti nel preventivo 2026: il comunicato sul preventivo 2026 indica
  CHF 263.5 milioni; il piano finanziario (262'398'000) e il messaggio sul preventivo 2027 (262.4) concordano fra loro e con
  il risultato globale 2026 (autofinanziamento 21.6 − 262.4 = −240.8). La pagina usa 262.4 ovunque e nomina il 263.5 del
  comunicato nel quadro.
- Le scelte fatte mentre si mappava ogni fonte (che cosa è stato incluso, scartato e perché) sono registrate nelle mappe
  delle fonti in [`method/`](method/).

## 9. Controllare da sé

```
npm ci             # installs the locked dependencies
npm run verify     # all checks, including a full rebuild from the archived sources (a few minutes)
```

(`npm ci` installa le dipendenze fissate; `npm run verify` esegue tutti i controlli, compresa una ricostruzione completa
dalle fonti archiviate, in qualche minuto.)

Per controllare una cifra a mano: trovatela in [`CIFRE.md`](CIFRE.md), aprite il file archiviato in [`sources/`](sources/)
nella posizione indicata e confrontate. Per controllare che un file sia quello pubblicato: calcolate la sua impronta SHA-256
e confrontatela con [`FONTI.md`](FONTI.md); lì c'è anche il collegamento originale.

Se una cifra è sbagliata, aprite una issue con la cifra, ciò che vi aspettavate e dove l'avete letta.
