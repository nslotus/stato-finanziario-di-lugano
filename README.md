# Stato finanziario di Lugano

**The financial state of the City of Lugano: its 2025 spending against its budget, line by line, with every figure traced to the document it comes from. The page is called *Cielo del preventivo, Lugano* (in English, *Sky budget, Lugano*).**

Each of the City's 72 spending lines of 2025 is a star in a planetarium sky. The horizon is the budget: lines that spent
more than planned rise above it, lines that spent less sink below it, and the brighter the star, the more the line spent.
Open a sector to see what it is made of, the City's own explanations, and figures on schools, safety, transport, the
economy, debt and more, each with its source. An overview brings together revenue, the debt to 2033, the bonds, staff and
the datasets that are not published. In Italian and English.

On a phone the sky gives way to a layout made for small screens: the sectors as tiles sized by what they spent, each
sector as a list of its lines' gaps around the budget, a card for each line with its pages and sources, "Il tuo franco"
(how an amount splits in the proportions of 2025 spending) and a searchable table. Same data, same addresses: a link
shared from a phone opens the same line on a computer. On a computer the same views are one click away: "Riquadri"
(Tiles) shows the tiles beside the list of a sector's lines, for readers who prefer plain charts to the sky.

**View it:** https://nslotus.github.io/stato-finanziario-di-lugano/ · locally: `npm ci && npm run serve`

> Independent project. It is not produced, reviewed or endorsed by the City of Lugano or the Canton of Ticino. The figures
> come from their public documents, archived here unchanged. Check the original before relying on a number, and please
> report anything wrong in an issue.

## How you can trust a number

1. **Every document is archived** in [`sources/`](sources/) exactly as downloaded, with its SHA-256 fingerprint and
   original link ([`SOURCES.md`](SOURCES.md)).
2. **Every figure cites its document and location**: sheet, row and column, or page and printed words
   ([`FIGURES.md`](FIGURES.md)).
3. **No number is typed by hand.** Code reads each value from the archived document; the page only displays the result.
4. **Checks stop the build** when parts do not add up to printed totals, when two sources disagree, or when a document
   does not say what is expected ([`METHOD.md`](METHOD.md#6-checks)).
5. **Anyone can rerun everything**, offline and without any key: `npm run verify` rebuilds all the data from the archived
   documents, confirms the files are byte-identical, recomputes every sum and rank, and confirms that each figure read from
   a single PDF page is printed there. GitHub Actions runs it on every change.

## Repository

| Path | What it is |
|---|---|
| [`docs/`](docs/) | The page (served by GitHub Pages). `data/data.js` is generated; `assets/app.js` (the sky) and `assets/phone.js` (phones) contain no numbers |
| [`sources/`](sources/) | The archived documents and [`MANIFEST.json`](sources/MANIFEST.json) |
| [`src/`](src/) | The readers (`adapters/`), one module per sector, the builders (`build.ts`, `personale.ts`, `site.ts`, `docs.ts`) and `verify.ts` |
| [`catalog/`](catalog/) | The figures read from the sources: the machine-readable data of this project |
| [`translations/`](translations/) | English names of the accounts' lines and departments (unofficial) |
| [`method/`](method/) | The source map of each sector: what was looked for, found, read and rejected |
| [`METHOD.md`](METHOD.md) | How numbers are read, defined, calculated and checked |
| [`PROVENANCE.md`](PROVENANCE.md) | Where the code and data come from, and what changed |

## Commands

```
npm ci                 # install the locked dependencies (Node.js 25.9.0, see .nvmrc; CI uses the same)
npm run verify         # every check, including a full rebuild from the archived sources
npm run verify:quick   # every check except the rebuild
npm run all            # rebuild: build → staff → site → docs
npm run serve          # view the page at http://127.0.0.1:8080/
```

## Licences

- **Code**: [MIT](LICENSE).
- **Data and texts** written for this project (`catalog/`, `docs/data/`, `translations/`, the documentation and the
  page's texts): [CC BY 4.0](LICENSE-DATA.md). Credit: *nslotus, Stato finanziario di Lugano*, and the original publishers.
- **Archived documents** in `sources/` remain under the terms of their publishers ([`sources/README.md`](sources/README.md)).
- **Fonts**: SIL Open Font License ([`docs/assets/fonts/`](docs/assets/fonts/)).

Made by [nslotus](https://github.com/nslotus). Corrections and questions: open an issue. Security: [`SECURITY.md`](SECURITY.md).
