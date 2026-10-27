# Changelog

## Unreleased

- Computers: a calmer top bar. "Cielo | Riquadri | Tabella" is one switch for how to look at the data; one language
  button shows the other language; "CHF | %" moved to the corner beside the legend, since it changes how the heights
  read. The top bar is now four groups: functions or departments, the view, Il quadro, the language.
- The sky's labels: a label's width now counts its second line too, so labels near the right edge (Finanze) are no
  longer cut; a label also avoids covering other stars, trying right, left, above and below in turn (Economia's figures
  covered a neighbouring star).
- Computers: a first visit opens on the guided tour, which starts by itself after a moment (the sky is hard to read
  without it); it runs once per browser. The instructions stay behind "?"; a shared link opens what it points to instead.
- Moody's: the rating note now reads from the City's news page of 26 October 2026 (archived): Aa3 with a stable outlook,
  confirmed for the tenth consecutive year in the periodic review published on 23 October 2026. The build checks that the
  count follows on from the October 2025 release (ninth year). The note's earlier "confirmed in April 2026" had no
  archived source and is removed.
- From volunteer checkers:
  - The source notes (sheet, row, column, page) were in English on the Italian page. They are now shown in Italian, from
    `translations/sources-it.json` (266 notes, 72 publishers); check 9 requires one for every source the page shows.
  - Net investment in the 2026 budget appeared as 262.4, 263.5 and 264. It is now 262.4 everywhere: the figure of the
    financial plan and the 2027 budget message, the one the 2026 overall result agrees with (21.6 − 262.4 = −240.8). The
    2026 press release's 263.5 is named in the overview's note; the chart shows one decimal so it no longer rounds to 264.
    The build's check that self-financing − investment = overall result is tightened from 1.2 to 0.06 million.
- Stronger checks, closing the gaps a review would find:
  - Check 8 now covers all 25 figures read from PDFs: those read across pages or from a whole document are searched
    there, and the planned asset sales (306.1 mio, not printed as one number) must equal the sum of their printed parts.
  - Check 13 now covers the 43 groups, 10 functions and the City's total as well as the 72 lines, so the lines are tied
    to the City's own printed totals (252 values).
  - Check 8 matches whole numbers only ("675" no longer matches inside "1'675"), and reads thousands written with a
    comma: the Plan B figure (CHF 5,000,000, an English document) had passed only by matching "5,00" inside it.
  - Check 4 also sums the department side's budgets (centres → divisions → departments).
  - New check 14: all 111 departments, divisions and cost centres of the 2025 accounts against their printed tables,
    through the arithmetic printed on each row. It reports one inconsistency in the source (centre 4101's printed
    differences); six rows that the arithmetic alone reads two ways are decided by check 4's budget sums.
  - New check 15: checks 8 and 13 again with pypdf, a second PDF reader that shares no code with pdf.js, finding the
    costs column by each row's arithmetic only. pypdf is pinned by hash in `requirements-verify.txt`.
  - Tolerances tightened to what rounding allows: sums CHF 0.05 (were CHF 100–10,000), printed values to the centime.
  - New `npm run verify:selftest`: 18 planted errors, each caught by the expected checks; GitHub Actions runs it.
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

Last `npm run verify`, 27 October 2026, all 15 checks passed:

```
PASS   1  sources match their fingerprints                                            75 files, 134.0 MB, all match, names exact
PASS   2  every cited file is archived, every archived file is cited                  75 files cited 1075 times
PASS   3  files pinned from dati-di-lugano name the commit of their URL               7 files, 6 commits of github.com/nslotus/dati-di-lugano
PASS   4  sums add up (recomputed here, not by the build)                             183 sums
PASS   5  budget against actual: actual − budget = printed difference                 18 rows
PASS   6  ranks and medians among Ticino's municipalities                             29 figures, each against 106 municipalities
PASS   7  canton indicator rank = 106 − page rank + 1 (net debt per resident)         canton 96/106 (1 = lowest debt), page 11th highest
PASS   8  values read from PDF pages are printed on the cited page                    25 figures: 20 on their page, 4 within their cited pages or document, 1 as the sum of its printed parts
PASS   9  every name has an English name, every source an Italian one, none unused    189 names in English; 267 source locators and 73 publishers in Italian
PASS  10  no keys, tokens, personal paths or addresses                                83 files scanned
PASS  11  rebuild is byte-identical                                                   7 files rebuilt from the archived sources, identical
PASS  12  generated docs are current                                                  SOURCES.md, FIGURES.md
PASS  13  every line, group and function is printed on its row of the cited page      252 values (126 rows × budget and actual): budget pp. 221–223, actual pp. 238–239, COSTI column
PASS  14  every department, division and cost centre is printed in the 2025 accounts  111 departments, divisions and centres (83 from their own tables, 37 from the overview tables; divisions with both, in both); as printed: 4101: printed differences 74903.76 and 46779.89 do not recompute from 4948306.79 − 4873420 and 4948306.79 − 4901543.87; 6 rows read two ways by their arithmetic alone (1213, 1214, 1230, 1231, 1232, 1401): their divisions' printed budgets decide, through check 4; 1 derived, not printed (40··: the rest of a division, check 4)
PASS  15  a second, independent PDF reader (pypdf) finds the same values              25 figures and 252 table values, as with pdf.js
```
