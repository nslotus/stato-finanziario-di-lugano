# Changelog

## Unreleased

- Lighter first load: the page's data is split in two. `data/data.js` (37 KB compressed, was 294 KB) holds every number
  the tiles, lists, sky and table are drawn from; `data/data-more.js` holds what only a card or the overview shows and is
  read right after the first screen. Opening a card before it has arrived waits for it; if it cannot be read, the page
  says so. `src/sitedata.ts` splits and joins the two; joined, they are identical to the single file they replace, and
  `npm run docs` and `npm run verify` read them joined.
- Computers: a "Riquadri / Tiles" view beside the sky ("▦ Riquadri" in the sky's toolbar, "✦ Cielo" to go back). The
  tiles sit on the left; on the right, the sectors' own gaps, or once one is chosen, its lines; a line's card opens from
  the right. The same addresses, full cards, overview, table and tour as on phones. The browser remembers the choice.
- Check 13: every one of the 72 lines' budget and actual is compared with the number printed on its row of the cited
  page, in the COSTI column found from its heading (144 values). A value read from the wrong row or column, or off by a
  franc, fails; tested by planting two such errors, which check 4's sums let through in one case.
- The "Data wanted" questions (missing datasets) moved from `dati-di-lugano` to this repository's issues #1–#7, and the
  page links there. `dati-di-lugano` is archived.
- Removed `sources/dati-di-lugano@8c1fd28-city-figures.json`, an older copy that nothing cited (the figures use
  `61e3dbe`). Check 2 now also fails on any file in `sources/` that the manifest does not list.
- Phones: screen readers hear each line's budget, actual and gap in a sector's list. SECURITY.md now names what a phone
  keeps (whether the tour was offered) and that typed amounts and searches are sent nowhere.
- The page is now called "Cielo del preventivo, Lugano" in Italian and "Sky budget, Lugano" in English (was "Il cielo del preventivo" /
  "The budget sky").
- Phones: a five-step guided tour, opened from "?" in the header (first-time visitors are offered it once). Each
  step outlines what it explains; it never plays by itself, and moving elsewhere ends it.
- Phones: the text in each tile is fitted to its space (smaller type, then a shortened name) without splitting words,
  and is dark or light by whichever has more contrast with the tile.
- Phones: a sector whose tile is too small for its label (8 Economia) is listed under the tiles with its spending and gap.
- "Il quadro", money out by sector: 0 General administration and 9 Finance and taxes now open their sector's card
  like the other eight (they have no per-resident figure of their own, so they were plain text).
- Phones get their own layout instead of the sky: the sectors as tiles sized by spending and coloured by their gap, a
  sector as a list of its lines' gaps around the budget, a line's card sliding up from the bottom, "Il tuo franco" and a
  searchable table, with a tab bar for these and "Il quadro". The full cards and the overview are the same as on a
  computer; the overview's charts are drawn at the phone's width. The addresses are shared with the sky (#settore/2,
  #settore/212, #settore/212/scheda, #quadro), and the Back button steps back one screen at a time. "Il tuo franco"
  shows each sector's share and spending, how the split is calculated with a worked example, the source document and
  the data file. Drawn without any
  added library, so the page's security rules are unchanged.
- Phones: a two-column header. Left: the title, "Il quadro" and "Tabella", the view by functions or departments. Right,
  right-justified: IT/EN, "▶ Tour" and "?", CHF/%. Nothing scrolls sideways any more.
- Phones: a star opened with a long name no longer runs into the first card; the name wraps in its own space, the top bar
  keeps a background while scrolling, and "Torna al cielo" stays on one line.
- "▶ Tour" and "?" moved under the title and subtitle, where a first-time visitor starts reading.
- The "Il quadro / Big picture" button is outlined in gold with a slow glow, so the overview is easy to find (no animation
  when the system asks for reduced motion).
- The card of a selected star can be dragged anywhere on the sky (or moved with the arrow keys), so it no longer hides
  the stars and links behind it. It stays where it was put, also for the next star, until ↺ puts it back beside its star.

## 1.0.0 — unreleased

First public version.

- The sky of the City of Lugano's 72 spending lines of 2025, budget against actual, by function and by department.
- 106 figure records with explanation, method, comparison with Ticino's municipalities, breakdown charts and sources.
- The overview: total spending 2023–2027, revenue, spending, result, investment, debt to 2033, bonds, interest,
  comparison in Ticino, staff, missing datasets.
- 74 archived source documents with SHA-256 fingerprints; `npm run verify` with 12 checks, run by GitHub Actions.
- Italian and English.

Last `npm run verify`, 23 October 2026, all 13 checks passed:

```
PASS   1  sources match their fingerprints                                         74 files, 134.0 MB, all match, names exact
PASS   2  every cited file is archived, every archived file is cited               74 files cited 1071 times
PASS   3  files pinned from dati-di-lugano name the commit of their URL            7 files, 6 commits of github.com/nslotus/dati-di-lugano
PASS   4  sums add up (recomputed here, not by the build)                          147 sums
PASS   5  budget against actual: actual − budget = printed difference              18 rows
PASS   6  ranks and medians among Ticino's municipalities                          29 figures, each against 106 municipalities
PASS   7  canton indicator rank = 106 − page rank + 1 (net debt per resident)      canton 96/106 (1 = lowest debt), page 11th highest
PASS   8  values read from PDF pages are printed on the cited page                 20 of 20 single-page figures; 5 more read across pages or lists (sicurezza.incidenti, finanze.pg-cantone, finanze.ifd-quota, finanze.piano-rivalorizzazioni, finanze.piano-misure)
PASS   9  every name has an English name, none unused                              189 names
PASS  10  no keys, tokens, personal paths or addresses                             77 files scanned
PASS  11  rebuild is byte-identical                                                6 files rebuilt from the archived sources, identical
PASS  12  generated docs are current                                               SOURCES.md, FIGURES.md
PASS  13  every line's budget and actual are printed on its row of the cited page  72 lines, 144 values: budget pp. 221–223, actual pp. 238–239, COSTI column
```
