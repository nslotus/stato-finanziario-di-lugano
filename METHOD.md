# Method

How every number on the page is found, read, calculated and checked, and how you can check it yourself.

- [1. What the page shows](#1-what-the-page-shows)
- [2. From documents to page](#2-from-documents-to-page)
- [3. Sources and archiving](#3-sources-and-archiving)
- [4. How numbers are read](#4-how-numbers-are-read)
- [5. Definitions and calculations](#5-definitions-and-calculations)
- [6. Checks](#6-checks)
- [7. Where software assistance was used](#7-where-software-assistance-was-used)
- [8. Choices, limits and known differences](#8-choices-limits-and-known-differences)
- [9. Checking it yourself](#9-checking-it-yourself)

Companion files: [`SOURCES.md`](SOURCES.md) (every document, with fingerprint), [`FIGURES.md`](FIGURES.md) (every figure,
with value and location), [`PROVENANCE.md`](PROVENANCE.md) (where the code and data come from), and the source maps in
[`method/`](method/), one per sector, written while each source was located and read.

## 1. What the page shows

**The sky.** Each of the City of Lugano's 72 spending lines of 2025 (the three-digit functions of the accounts, or two
digits where a function has no lines below it) is a star. Stars are grouped in ten slices, one per function (0 General
administration to 9 Finance and taxes).

- **Height** is the gap between what the line spent in 2025 (the final accounts) and what the 2025 budget planned. The
  horizon is the budget. Above it, the line spent more than planned; below it, less. The gap can be shown in francs or
  in percent.
- **Brightness and size** follow what the line spent in 2025.
- The same sky can be arranged **by department** (the City's seven *dicasteri*, their divisions and 85 cost centres),
  where the City's own explanations of each gap are quoted from its message on the 2025 accounts.

**The figures of each sector.** Opening a slice shows its groups of lines, its spending 2023–2027, and the other figures
of the sector (pupils, passengers, offences, jobs, debt and so on), each with its explanation, comparison, method and
sources. In the department view, each department shows its staff and gross salaries by service.

**The overview** ("Il quadro") brings the accounts together: total spending by year, revenue, spending by sector, the
operating result, investment and self-financing, the debt to 2033, the bonds, interest and repayments, how Lugano
compares with Ticino's municipalities, staff costs, and the datasets that are not published.

**On phones** (screens up to 720 px wide) the same data is shown without the sky:

- **The sectors as tiles.** Each function (or department) is a rectangle whose area is its 2025 spending (a squarified
  treemap). Its colour is its gap in percent: grey on budget, warmer below, cooler above, at full strength from ±6%.
  The number in the tile is what it spent, in CHF million. A tile too small for its label is also listed under the map.
- **A sector** lists its lines from the largest gap to the smallest, each as a bar left (spent less) or right (spent
  more) of a line that stands for the budget, in francs or in percent. Lines with no budget are listed with what they
  spent and "not budgeted". For functions, the sector's figure per resident (2024) and its rank in Ticino are shown.
- **A line's card** gives budget, actual and gap, the City's explanation where there is one, the pages of the two
  messages and the sources, and opens the same full card as on a computer.
- **Il tuo franco** splits an amount typed by the reader in the proportions of 2025 spending by function (or
  department): amount × spending of the sector ÷ total spending. Each square is one franc in a hundred, rounded, so the
  squares may not add up to exactly 100. It shows proportions only: the City's spending is not paid for by taxes alone,
  and the amount is the reader's, not a tax bill.
- **The table** lists every line with spending or a budget, searchable by name or code, sorted by gap, spending or code.

Every figure is listed in [`FIGURES.md`](FIGURES.md).

## 2. From documents to page

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
docs/data/data.js    everything the page shows, in one file
docs/index.html      the page; docs/assets/app.js only reads docs/data/data.js and never contains a number
   │  npm run docs    src/docs.ts
   ▼
SOURCES.md, FIGURES.md   generated tables
```

Seven files come from a separate public project, [`nslotus/dati-di-lugano`](https://github.com/nslotus/dati-di-lugano),
which reads the City's financial PDFs (debt, results, bonds, schools, mobility). They are archived here under names that
carry the commit they were taken from (for example `dati-di-lugano@8c1fd28-debt-profile.json`), so they cannot change.
How they were made is documented in that project's
[`METHODOLOGY.md`](https://github.com/nslotus/dati-di-lugano/blob/main/METHODOLOGY.md) and
[`TRACE.md`](https://github.com/nslotus/dati-di-lugano/blob/main/TRACE.md). That project is archived (read-only) since
22 October 2026, so the pinned links keep working; its open questions about missing data are now this repository's issues.

Vocabulary in the code: a **star** is one figure record; a **constellation** is a sector; the **anchor** of a sector is
its spending per resident; the **ledger** is the set of overview chapters; in the staff tables, a **planet** is a
department and a **moon** one of its services.

## 3. Sources and archiving

Every document is kept in [`sources/`](sources/) exactly as it was downloaded. [`sources/MANIFEST.json`](sources/MANIFEST.json)
records for each one: the file, the original URL, the publisher, the time it was retrieved, its size and its SHA-256
fingerprint. [`SOURCES.md`](SOURCES.md) lists them with the number of figures that cite each.

- Rebuilding never downloads anything: the build reads the archived files only.
- A document is never edited. If a publisher issues a new version, it is archived as a new file and the figures that use
  it are rebuilt.
- Some original links no longer return the same file (for example a page that has been updated). The archived copy and
  its fingerprint are what the figures were read from.

Every figure record cites at least one archived file and a **locator**: the sheet, row and column of a spreadsheet, or
the page (PDF page number, first page = 1) and the printed words of a PDF.

## 4. How numbers are read

**Spreadsheets** (Canton of Ticino, federal offices). Sheets are found by their title, rows by the municipality's name or
number, columns by their header text, never by position, so a reordered file fails loudly instead of being misread. The
canton's municipal accounts are in CHF thousands. Municipalities are joined on the 2024 register of 106 municipalities by
their federal number; the few name differences are listed explicitly in `src/adapters/municipalities.ts`.

**PDFs** (City messages, presentations and reports). The text of the needed pages is taken with pdf.js
(`src/adapters/pdf.ts`). Values are read with patterns that match the printed words around them (a row label, a
sentence) and the position of the value in its row (for example actual, budget, difference). The value is taken as
printed; nothing is retyped. Where a table prints a total, the parts are added up and must match it.

**City financial PDFs read upstream.** Some figures from the City's accounts presentations, budget releases and school and
mobility releases were read in `dati-di-lugano` with a language model that may only *choose* among the numbers that code
has already found in the document; it never writes a number. A figure was accepted at a pooled probability of at least
0.8; the others were checked by hand. Each of those figures is listed with its page and printed line in that project's
[`TRACE.md`](https://github.com/nslotus/dati-di-lugano/blob/main/TRACE.md). On this page they are: the debt figures and
debt path, the budget-against-actual table of 2024 and 2025 (read from the table by position, no model involved), the
schools' pupils and classes, the TPL and PubliBike figures, and the bond interest schedule (computed from the bond terms).

## 5. Definitions and calculations

| Term | Meaning on the page |
|---|---|
| Budget 2025 by function | The Municipio's proposal, as printed by function in the 2025 budget message. The Council changed the total by CHF 100,000 in one department, which the table by function does not allocate; the overview shows both totals. |
| Actual 2025 | The final accounts in the City's message on the 2025 accounts (April 2026). |
| Gap | Actual − budget, in CHF million, and (actual − budget) ÷ budget in percent. |
| Per resident | Divided by Lugano's 63,629 permanent residents at 31 December 2024 (federal definition), the base the canton uses for all 106 municipalities. The City publishes higher counts of its own (64,430 in its register; 68,507 including secondary residents); they are not used because they do not exist for the other municipalities. Per resident is not per taxpayer. |
| Rank | Lugano's position among Ticino's 106 municipalities, 1 = highest value, with the median. Ranks compare Ticino only. Figures are ranked only where a comparison means something for a resident; the method of each figure says when it is not. |
| Canton indicator rank | In the canton's indicator table (overview, "How it compares in Ticino") rank 1 is the best value on the canton's scale, so the same position can read 96th there and 11th highest among the figures. The check in §6 confirms they agree. |
| official / derived | *official*: printed by the publisher. *derived*: calculated here from official numbers; the method of the figure gives the calculation. |
| Estimate | Marked as such on the page, never presented as a City figure (for example the end-2026 debt implied by the budget). |

**Drawing rules** (no effect on any number): the height of a star is compressed so that large and small gaps both stay
visible; any non-zero gap starts a few degrees off the horizon; lines whose gap rounds to zero (under CHF 5,000, or 0.05%
in percent) are drawn as diamonds on the horizon; lines with neither budget nor spending are not drawn, but stay in the
table.

## 6. Checks

There are three layers. Each one stops with an error instead of producing a doubtful number.

### 6.1 While reading the sources (`npm run build`, `npm run staff`)

The sector modules and readers contain about 270 conditions that stop the build. The main kinds:

| Kind of check | Examples |
|---|---|
| The parts add up to the printed total | lines of a function add up to the function (budget and actual); two-digit health functions add up to function 4; school sites add up to the canton's printed total; staff of each department add up to the department and the City total; the plan's asset sales add up to its yearly proceeds |
| Printed differences hold | in the budget-against-actual tables, actual − budget = the printed difference, to the cent |
| Two sources agree | the canton's population equals the cantonal statistics office's for every municipality; account 340 read here equals the value used upstream; the canton's own net debt per resident implies the same population for Lugano |
| Joins are complete | all 106 municipalities match across files; every figure has a source; every link between figures resolves |
| The document says what is expected | a row label, sentence or header that is not found stops the build instead of reading a neighbour |

The source maps in [`method/`](method/) list the checks of each sector next to its sources.

### 6.2 While building the page (`npm run site`)

`src/site.ts` checks that the lines of each function add up to it (budget and actual), that the cost centres add up to
their divisions and departments and that departments add up to the same total as functions, that revenue minus spending
equals the 2024 result, that the functions add up to the yearly totals 2023–2027, that every figure of the catalogue is on
the page, that every relation has the comparisons it needs, that the bond shares of the debt recompute, that every name
has an English name, and that every source cited is in the manifest.

### 6.3 `npm run verify` (also run on every change by GitHub Actions)

Checks 4 to 7 and 9 recompute from the page's data with their own code, independently of the build, so a mistake in the
build cannot hide itself. Check 8 reads the PDFs with the same reader as the build. Check 11 proves that the files can be
reproduced exactly from the archived sources; it does not by itself prove that they are correct, which is what the other
checks are for. The committed files were generated with Node.js 25.9.0 (`.nvmrc`), and GitHub Actions uses the same version.

| # | Check | What it compares | Tolerance |
|---|---|---|---|
| 1 | Sources match their fingerprints | size and SHA-256 of every archived file against the manifest; file names match exactly, including case | exact |
| 2 | Citations | every file cited is archived; every archived file is cited | exact |
| 3 | Upstream pins | each file from `dati-di-lugano` names the commit of its URL | exact |
| 4 | Sums | lines → groups → functions, centres → divisions → departments, functions = departments, functions → yearly totals, percentages recomputed | CHF 100–10,000 depending on the level (rounding of CHF million values) |
| 5 | Budget against actual | actual − budget = printed difference, 18 rows | CHF 10,000 |
| 6 | Ranks and medians | every rank and median recomputed from the 106 values; Lugano's value equals the figure | exact (median 1e-6) |
| 7 | Canton indicator rank | canton rank = 106 − page rank + 1 for net debt per resident | exact |
| 8 | Printed on the page | every official figure whose source is one PDF page is printed on that page (in francs, thousands or millions); figures read across several pages or summed from a list are named in the output and covered by the build's own sums | as printed |
| 9 | Names | every Italian name has an English name, and none is unused | exact |
| 10 | Hygiene | no keys, tokens, personal paths or private addresses in the repository | — |
| 11 | Rebuild | `build`, `staff` and `site` run again from the archived sources give byte-identical files | exact |
| 12 | Docs | `SOURCES.md` and `FIGURES.md` are what `npm run docs` generates | exact |

The result of the last run is in [`CHANGELOG.md`](CHANGELOG.md).

## 7. Where software assistance was used

- **Upstream extraction.** As described in §4, some figures from the City's PDFs were read in `dati-di-lugano` with a
  language model that only chooses among numbers found by code; those choices are listed page by page in its `TRACE.md`.
  Nothing in this repository needs a model or a key to rebuild.
- **English names.** The accounts give the names of lines, groups and departments in Italian only. The English names in
  [`translations/labels-en.json`](translations/labels-en.json) were drafted with an AI assistant and are unofficial (see
  [`translations/README.md`](translations/README.md)). Italian remains the reference.
- **Code and texts.** The code and the explanatory texts were written with the help of an AI coding assistant. That is
  why no number is typed by hand: every number is read by code from an archived document, and the checks above, which
  anyone can run, are what the figures rest on.

## 8. Choices, limits and known differences

- The canton publishes municipal accounts about 14 months after year end, so comparisons with other municipalities use
  2024; the City's own 2025 accounts are used for 2025.
- Ranks are within Ticino only, not Switzerland-wide.
- Above or below budget is not good or bad by itself: it can be a saving, work not done, or a growing need. The page says
  so, and never colours a gap as good or bad.
- The financial plan 2026–2033 is the Municipio's intention, presented to the Council for information; it is not voted.
- Bond figures are the bonds' terms (ISIN, coupon, maturity, volume); no market prices are collected or shown.
- Where two City documents round the same number differently, the figure uses the one it cites and the source map notes
  the difference (for example [`method/OUTLOOK-SOURCES.md`](method/OUTLOOK-SOURCES.md)).
- The choices made while mapping each source (what was included, rejected and why) are recorded in the source maps in
  [`method/`](method/).

## 9. Checking it yourself

```
npm ci             # installs the locked dependencies
npm run verify     # all checks, including a full rebuild from the archived sources (a few minutes)
```

To check one figure by hand: find it in [`FIGURES.md`](FIGURES.md), open the archived file in [`sources/`](sources/) at the
locator given, and compare. To check a file is the one published: compute its SHA-256 and compare it with
[`SOURCES.md`](SOURCES.md); the original link is there too.

If a number is wrong, please open an issue with the figure, what you expected and where you read it.
