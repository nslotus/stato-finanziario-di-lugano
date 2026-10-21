# Public safety: source map

Mapped 18 October 2026, with Exa search, then checked by downloading each file and reading the figures locally (phrases located by page, one page at a time).

Public safety is function 1 of the municipal accounts (public order, security, defence). In 2024 the City spent **CHF 45.8M** on it (Ledger spending chapter, `1 Ordine pubblico, sicurezza, difesa`), about **CHF 720 per resident, 12th of 106** (median 308).

## Verified sources

| # | Source | What it gives | Lugano | Comparison |
|---|---|---|---|---|
| 1 | Canton SEL annex 2024, appendice `TabA`–`TabF` (already archived) | Function 1 by line, spending and revenue | Spending 2024 (CHF M): 111 police **24.82** (revenue 6.20); 140 general legal affairs **12.47** (revenue 8.49); 150 fire service **6.25** (revenue 3.13); 162 civil protection **2.11**; 161 military defence 0.14; 120 judiciary 0.04. Total **45.8** | per resident across 106: function 1 12th (estimates for the lines: police 111 about 11th, CHF 390, median 119; fire 150 about 7th, CHF 98, median 34; not used, see notes) |
| 2 | City of Lugano, *Lugano in cifre 2026* (already archived), chapter Sicurezza pubblica, PDF pp. 63–66 | Offences by law and type, 2019–2025; road accidents and casualties, 2013–2025 | Criminal-code offences **3'885** (2025; 3'771 in 2024): property 2'562, life and limb 362 (+58.8%), personal freedom 581, sexual integrity 142 (+34%). Drugs law **407** (−14%); foreigners law **269** (+55.5%, mostly illegal entry and stay). Road accidents **675** (2025): 2 deaths, 49 seriously and 91 lightly injured; 739 in 2013 | – |
| 3 | Cantonal police / BFS, *Statistica criminale di polizia 2025* (`ti-statistica-criminale-2025.pdf`, p. 11, table T4) and 2024 (`ti-statistica-criminale-2024.pdf`) | Criminal-code offences, residents and rate per 1'000, for the 40 largest municipalities and the canton | 2025: **3'885 offences, 63'629 residents, 61.1 per 1'000** (2024: 59.4); canton 39.3 (2024: 41.8). The yearbook's count and our population base match exactly | 40 municipalities listed by name, the rest grouped as "Altri comuni"; Lugano would be 3rd (after Muralto 68.8 and Balerna 63.5) |
| 4 | City of Lugano, *Polizia Città di Lugano – Rapporto d'attività 2025* (press conference 11 May 2026, `polizia-lugano-rapporto-2025.pdf`, 62 pp.); also `polizia-lugano-statistiche-2025.pdf` | Call-outs by type, events logged by the emergency centre, persons handled, traffic controls, regional police | **8'037** call-outs (p. 38: road accidents 993, disturbance 756, disputes 727, thefts 285, robberies 12); **17'498** events logged (p. 43, about 48 a day); persons stopped 858, assisted 938, checked 14'762. Police region III (p. 55): **44 municipalities, about 157'000 residents, 216 municipal officers**; Lugano is the lead force ("Polizia Polo") and intervened 1'104 times in the other forces' areas | – |

## Notes on the sources

- **Offences per resident are not a fair ranking.** The cantonal report itself warns (p. 9) that rates per 1'000 residents "cannot account for commuting populations, which in large cities weigh considerably on offence rates". Lugano is the job centre of the region (92 jobs per 100 residents, economy arm). Proposal: show the count and the rate, with Ticino as context, but no ranking, quoting the caveat.
- **Police spending per resident is not a fair ranking either.** Lugano's police is the lead force of a region of 44 municipalities; the top three spenders per resident (Lamone, Chiasso, Paradiso) include seats of the region's other structured forces listed in source 4 (Vedeggio in Lamone, Ceresio Sud in Paradiso). Proposal: show police spending and revenue as amounts, with the region as context, not ranked. The fire service also serves beyond the City (revenue 3.13M); same treatment.
- **Function 1 as a whole** stays per resident and ranked, like the other sector anchors (spending that serves residents); its note says that part of it serves the region.
- **Two accident counts.** The yearbook gives 675 road accidents in 2025 for the municipal territory; the police report gives 641 "on the jurisdiction of the City" with a different breakdown. Both are shown with their own source, not reconciled.
- **Line 140 "Diritto generale"** (12.47M spending, 8.49M revenue) is the accounts' own label; the annex does not detail it, and the star will not guess what it contains.
- **Fire brigade figures** (1'599 emergency call-outs in 2025, a record; 166 firefighters) are so far only in the press (tio.ch, laRegione, 5 May 2026); no City PDF was found. They are not used until an official document is archived.
- **Civil protection** is run by a consortium (PCi Lugano Città), which publishes its own officers' report (pcilugano.ch, not yet archived); the City's line 162 is CHF 2.11M.

## Proposed stars (public safety arm)

1. **Spesa per la sicurezza pubblica** (function 1, 2024): CHF 720 per resident, 12th in Ticino; detail: spending and revenue by line.
2. **Polizia della Città**: CHF 24.82M spending, 6.20M revenue (2024), as amounts, not ranked; 8'037 call-outs and 17'498 events (2025); detail: call-outs by type; region III as context.
3. **Reati al Codice penale**: 3'885 (2025), 61.1 per 1'000 residents (Ticino 39.3), not ranked (commuter caveat); detail: by type, 2019–2025 series; drugs and foreigners laws as context.
4. **Incidenti stradali**: 675 (2025, yearbook); detail: accidents and casualties 2013–2025; the police count (641) as context.
5. **Pompieri**: CHF 6.25M spending, 3.13M revenue (2024), as amounts; call-outs added once an official document is archived.

## Files to archive

`ti-statistica-criminale-2025.pdf` (7.4 MB) and `ti-statistica-criminale-2024.pdf` (6.4 MB; the 2025 report also has the 2024 column, so the 2024 file may not be needed), `polizia-lugano-rapporto-2025.pdf` (4.4 MB), `polizia-lugano-statistiche-2025.pdf` (7.3 MB, overlaps with the report; keep only if a figure needs it). The annex and the yearbook are already archived.

## Built (18 October 2026)

Four stars in `src/sicurezza.ts`, plus the anchor `sicurezza.spesa` (function 1, from the Ledger) with spending and revenue by line:

| Star | Value | Within Ticino |
|---|---|---|
| Spesa per la sicurezza pubblica | CHF 720 per resident (CHF 45.8M, 2024) | 12th of 106, median 308 |
| Polizia della Città | CHF 24.82M spending, 6.20M revenue (2024); 8'037 call-outs and 17'498 events (2025) | not ranked: lead force of police region III (44 municipalities, about 157'000 residents) |
| Reati al Codice penale | 3'885 (2025), 61.1 per 1'000 residents (Ticino 39.3) | not ranked: the cantonal statistics' commuter caveat |
| Incidenti stradali | 675 (2025): 2 deaths, 49 seriously and 91 lightly injured | – |
| Pompieri | CHF 6.25M spending, 3.13M revenue (2024); civil protection 2.11M, consortium contribution 1.96M (2025) | not ranked: the brigade also works outside the City |

Added since the source map: the City's contribution to the civil protection consortium (2027 budget message, account 36121300: 1.96M actual 2025, 2.30M budget 2026, 2.13M budget 2027).

Checks that stop the build: TabD has the 106 municipalities and the lines add up to the function 1 anchor; the yearbook's offence table adds up and equals the 2024 and 2025 points of the series; drugs and foreigners tables add up to the series; accidents (damage + injuries) and casualties (deaths + serious + light) add up for every year 2013–2025; the cantonal rates recompute from offences ÷ residents; Lugano's cantonal count equals the yearbook's and its residents equal our register's 63'629; each call-out label pairs with exactly one value on its line and the types do not exceed the total; the consortium account matches its printed differences.

