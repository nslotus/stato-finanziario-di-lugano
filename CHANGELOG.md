# Changelog

## Unreleased

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

Last `npm run verify`, 21 October 2026, all 12 checks passed:

```
PASS   1  sources match their fingerprints                                     74 files, 134.0 MB, all match, names exact
PASS   2  every cited file is archived, every archived file is cited           74 files cited 1071 times
PASS   3  files pinned from dati-di-lugano name the commit of their URL        7 files, 6 commits of github.com/nslotus/dati-di-lugano
PASS   4  sums add up (recomputed here, not by the build)                      147 sums
PASS   5  budget against actual: actual − budget = printed difference          18 rows
PASS   6  ranks and medians among Ticino's municipalities                      29 figures, each against 106 municipalities
PASS   7  canton indicator rank = 106 − page rank + 1 (net debt per resident)  canton 96/106 (1 = lowest debt), page 11th highest
PASS   8  values read from PDF pages are printed on the cited page             20 of 20 single-page figures; 5 more read across pages or lists (sicurezza.incidenti, finanze.pg-cantone, finanze.ifd-quota, finanze.piano-rivalorizzazioni, finanze.piano-misure)
PASS   9  every name has an English name, none unused                          189 names
PASS  10  no keys, tokens, personal paths or addresses                         74 files scanned
PASS  11  rebuild is byte-identical                                            6 files rebuilt from the archived sources, identical
PASS  12  generated docs are current                                           SOURCES.md, FIGURES.md
```
