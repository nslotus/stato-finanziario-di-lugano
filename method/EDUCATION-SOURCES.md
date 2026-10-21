# Education: source map

Sourced 15 October 2026 with Exa search highlights; every figure below was checked by phrase search in the downloaded file. **Built 15 October 2026**: 8 stars and 1 relation in the catalogue; the city school figures come from Dati di Lugano `npm run schools` (TypeSafe extraction, 21/21 accepted, 9/9 arithmetic checks passed), pinned at `74c57b7`.

## Verified sources

| # | Source | What it gives | Geography | Format | Verified |
|---|---|---|---|---|---|
| 1 | Canton of Ticino SEL, `2024-appendice.xlsx` (TabA, TabD) | Municipal **education spending** by sub-function, 2024: 211 kindergarten, 212 primary school, 213 middle school, 217 school buildings, 218 day care, 219 other compulsory schooling, 271 universities, 299 other | **all 106 municipalities** | xlsx (already archived) | labels from sheet "Codifica funzionale"; Lugano 211 = 9.20M, 212 = 19.42M, 217 = 12.09M, 219 = 12.24M; 21 + 27 + 29 = function 2 (53.96M) |
| 2 | USTAT `T_010202_020.xlsx`, sheet 2024 | Residents aged 0–4, 5–9, 10–14 → **share of children** | all 106 municipalities | xlsx (already archived) | same file as the 65+/80+ stars |
| 3 | City of Lugano, school-start press releases | Istituto scolastico **pupils, sections/classes and class averages** for kindergarten and primary | Lugano only | PDF | see table below |
| 4 | DECS, *Statistica allievi*, B110 and B210 (2015/16–2024/25) | Public kindergarten and primary **pupils and sections** | 4 school districts (*circondari*) and Ticino total | xlsx | 2024/25 Ticino: kindergarten 7,280 pupils / 413 sections; primary 14,337 / 828 |

### City figures (source 3)

| School year | Release | Pupils | Kindergarten | Primary | Phrase checked |
|---|---|---|---|---|---|
| 2024/25 | `20240902-cs-inizio-scuole.pdf` | 3,360 | 1,179, 68 sections, avg 17.34 | 2,181, 124 classes, avg 17.59 | "3'360 allievi … (media di 17.34 …) … (media di 17.59 allievi per classe)" |
| 2025/26 | `20250903-cs-inizio-anno-scolastico-2025-2026.pdf` | 3,267 | 1,177, 69 sections, avg 17.06 | 2,090, 119 classes, avg 17.56 | "3'267 allievi: di questi, 1’177 …" |
| 2026/27 | `20260831-…-2026-27-comunicato.pdf` | 3,289 | 1,254, 69 sections, avg 18.17 | 2,035, 115 classes, avg 17.70 | "3’289 allievi, di cui 1’254 …" |

The 2026 release also records that the Villa Luganese kindergarten and primary sites closed from 2026/27 because pupil numbers fell (sentence on p. 1).

## Comparisons this allows (and their limits)

- **Spending per resident by sub-function, in Ticino** (sources 1 + population): like the health stars, with rank and median **within Ticino**.
- **Share of residents under 15, in Ticino** (source 2), and a scatter of education spending against it, describing without explaining.
- **Class size, Lugano vs Ticino average, same school year** (sources 3 + 4): Lugano 2024/25 kindergarten 17.34 and primary 17.59, against Ticino's public average of 17.6 (7,280 / 413) and 17.3 (14,337 / 828). The DECS figures cover all public schools in Ticino; Lugano's are its Istituto scolastico. Use 2024/25 only, as the latest year in both.
- **Pupil trend 2024/25 → 2026/27** for Lugano (source 3).

Not possible with these sources: spending **per pupil** across all 106 municipalities (pupil counts are per school district, not per municipality), and per-pupil spending for Lugano without mixing calendar-year accounts with school-year counts. If wanted, it must be labelled as an estimate.

## Rejected or parked

- **Press coverage** (tio.ch, cdt.ch, Rivista di Lugano): used only to find the city's releases; figures come from the city's PDFs.
- ***Lugano in Cifre 2024***: different school figures (2,261 primary pupils in 122 classes; 1,326 kindergarten pupils), probably a different reference date or scope. Not mixed with the releases.
- **Per-school table** (`20250903-…-tabella.pdf`): pupils and sections per site and school zone, which is neighbourhood-level data. Its PDF text runs columns together ("Ronchetto227" = 2 sections, 27 pupils); parsing needs text positions. Parked.
- **"80 milioni in 10 anni"** for school buildings: a quote from a press conference reported by newspapers, not a figure in the city's accounts. Not used.

## Proposed stars

| Star | Code | Value (Lugano) | Comparison |
|---|---|---|---|
| Spesa per la formazione (anchor, exists) | 2 | CHF 848 per resident | Ticino, 106 |
| Scuola dell'infanzia | 211 | per resident | Ticino, 106 |
| Scuola elementare | 212 | per resident | Ticino, 106 |
| Edifici scolastici | 217 | per resident | Ticino, 106 |
| Residenti sotto i 15 anni | P0–14 | share | Ticino, 106 |
| Allievi dell'Istituto scolastico | IS | 3,289 (2026/27), trend from 2024/25 | Lugano only |
| Allievi per classe (elementare) | IS·SE | 17.59 (2024/25) | Ticino average, same year |
| Bambini per sezione (infanzia) | IS·SI | 17.34 (2024/25) | Ticino average, same year |
| Relation: education spending vs residents under 15 | | | scatter, Ticino |

## Secondary and tertiary levels (built 16 October 2026)

The City runs only kindergarten and primary school. Middle schools and licei are cantonal; USI and SUPSI are independent. So these stars count **pupils and students at schools located in the City of Lugano**, wherever they live, not Lugano residents, and they are not City spending.

| # | Source | What it gives | Lugano rows (2024/25 unless noted) | Format |
|---|---|---|---|---|
| 5 | DECS, Divisione della scuola, `B310` Allievi e sezioni delle scuole medie pubbliche secondo la sede, 2015/16–2024/25 | Middle school (secondary I) pupils and sections per school site, one sheet per year | Barbengo 494 (26 sections), Breganzona 319 (16), Lugano 1 254 (15), Lugano 2 Besso 246 (14), Pregassona 431 (23), Viganello 479 (26): **2'223 pupils, 120 sections** of Ticino's 11'934 | xlsx |
| 6 | DECS, `C210` Allievi e sezioni dei licei cantonali secondo la sede, 2015/16–2024/25 | Liceo (secondary II, general) students per site | Liceo Lugano 1 562; Liceo Lugano 3 666 (Via Elsa Franconi-Poretti 6, Viganello, a Lugano district, provisional site): **1'228** of Ticino's 3'893. Liceo Lugano 2 (673) is in Savosa and is left out | xlsx |
| 7 | DECS, `C440` Scuole professionali commerciali and `C420` SPAI, per site | Vocational schools (secondary II) | Scuola professionale commerciale Lugano 258; SPAI artistica Lugano 53. SPAI Trevano (878) is in Canobbio. Many other vocational schools are spread over several tables and sites | xlsx |
| 8 | USI, data.usi.ch "Students – Total" (autumn semester 2025/26) | Students by faculty | Total **4'749**: Architecture 844 (Mendrisio), Biomedical sciences 490, Communication 1'058, Economics 1'258, Informatics 660, Theology 439, all in Lugano: **3'905 in Lugano**. USI's press release of 15 Dec 2025 gives 4'750 (BA 2'078, MA 1'977, PhD 616, continuing education 79) | HTML table |
| 9 | SUPSI, Rapporto annuale 2025 | 6'712 bachelor and master students in 2025, including affiliated schools and the distance-learning FFHS (outside Ticino); DTI (Campus Est, Lugano-Viganello) 1'043 | Split by campus only in the statistical annex: to verify | web, PDF annex |

Not usable for the City: USTAT cube `SDL_01` (pupils by level and place of residence) goes down only to districts ("Distretto di Lugano", 155k people), and its tertiary level is higher vocational colleges only, not universities.

### Proposed stars

- **Scuole medie in città** (source 5): 2'223 pupils, 120 sections, 18.5 per section; Ticino share; 2015/16–2024/25 trend. Checks: the six site rows plus the others add up to the sheet's total; sections × average ≈ pupils.
- **Licei in città** (source 6): 1'228 students at Lugano 1 and Lugano 3. Check: site rows add up to the total. Vocational schools (source 7) as context only, or left out, because the table set is fragmented.
- **USI a Lugano** (source 8): 3'905 students in the faculties based in Lugano, 4'749 in total; check: faculties add up to the total.
- **SUPSI**: only after the statistical annex gives students by campus.

All four sources are tables, so they are read deterministically, the same way as the SBB file (no TypeSafe call needed).

### Built (16 October 2026)

Six stars on the education arm, each marked with who runs it (`operator`: canton or independent) and what the City spends (`cityCost`, from the canton appendice TabD for Lugano, 2024):

| Star | Value | Run by | City spends (2024) |
|---|---|---|---|
| Scuole medie in città | 2'223 pupils (6 sites, 120 classes); 2'158 in 2015/16 | canton | CHF 0.18M (213) |
| Licei in città | 1'228 (Lugano 1, Lugano 3) | canton | none (25) |
| Scuole professionali e specializzate | 1'903 across 8 schools at CSIA (Via Brentani 18), CPC (Via Gerso 1a), CPS (Via Ronchetto 14), the tailoring school in Viganello and post-apprenticeship maturità at Lugano sites | canton | none (23, 26) |
| USI a Lugano | 3'905 of 4'749 (autumn 2025/26; all faculties but Architecture, Mendrisio) | independent | CHF 0.63M (271), the contribution to the foundation for the Lugano faculties (Corriere del Ticino, 8 May 2025) |
| SUPSI a Lugano | 1'043 (DTI, Campus Est Viganello, 2025). DEASS is in Manno, DACD in Mendrisio, DFA in Locarno | independent | none beyond USI in function 27 |
| Conservatorio | 262 Bachelor (51) and Master (211) students of the Scuola universitaria di Musica, Via Soldino 9, Lugano, 2025; 117 more in continuing education, 379 in all (annual report 2025, p. 62; checks: 51 + 211 = 262, 262 + 117 = 379) | independent (private non-profit foundation, affiliated with SUPSI) | none beyond USI in function 27 |

Checks that stop the build: each DECS table's site rows add up to its printed total; the Lugano sites exist in both 2024/25 and 2015/16; USI faculties add up to the total; university lines (27x) are at least the USI line. Excluded after checking addresses: Liceo Lugano 2 (Savosa), the Trevano centre (Canobbio), SSPSS (Canobbio, Giubiasco), SCOS (Mendrisio), the elite-sport school (Tenero); private schools are not in these tables.

