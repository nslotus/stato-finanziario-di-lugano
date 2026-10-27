# Translations

## English names

The City's accounts and messages give the names of spending lines, groups, divisions, cost centres and departments in
Italian only. [`labels-en.json`](labels-en.json) maps each Italian name, exactly as printed, to an English name for the
English version of the page.

- The English names are **unofficial**. They were drafted with an AI assistant using the usual English terms for Swiss
  public accounts and have not been reviewed by the City. Italian is the reference.
- A few local names are kept and explained, for example "Punto Città (city service desks)".
- `npm run site` and `npm run verify` fail if a name on the page has no English name, or if a name here is no longer used.

Corrections are welcome: open an issue or a pull request with the Italian name, the current English name and a better one.

## Italian source notes

Where each figure comes from is recorded in English (the language of this repository's documents), for example
"sheet TabD, column 212, row of each municipality (CHF thousands, gross spending)". [`sources-it.json`](sources-it.json)
gives the Italian version the Italian page shows ("foglio TabD, colonna 212, riga di ogni comune (migliaia di CHF, spesa
lorda)"), and the Italian name of each publisher.

- Drafted with an AI assistant. The document's own words (in quotation marks), page numbers, codes and data field names
  (such as `snapshots['end 2025'].grossDebt`) are unchanged; every Italian note keeps the same numbers as its original.
- `npm run verify` (check 9) fails if a note or publisher the page shows has no Italian version, or if one is unused.
