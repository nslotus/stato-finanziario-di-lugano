# Social security: source map

Mapped 18 October 2026, with Exa search, then checked by downloading each file and reading the Lugano figures locally (phrases located by page; chart labels paired with their years by position on the page).

Social security is function 5 of the municipal accounts (HRM2). In 2024 the City spent **CHF 54.0M** on it (spending chapter of the Ledger, `5 Sicurezza sociale`), about CHF 849 per resident. Most of it is not a service the City runs: it is the City's legal share of cantonal schemes (premium subsidies, supplementary benefits to AVS/AI). The City's own services are smaller: social assistance desk, municipal benefits, nurseries run by LIS, youth work.

## Verified sources

| # | Source | What it gives | Lugano | Comparison |
|---|---|---|---|---|
| 1 | Canton SEL annex 2024, appendice `TabA`–`TabF` (already archived) | Function 5 by two- and three-digit line: spending, revenue, net, every municipality | Spending 2024 (CHF M): 512 premium subsidies **23.41**; 522 PC to AI **5.40**; 532 PC to AVS **7.20**; 531 AVS 0.62; 533 pensioners 0.47; 535 old age 0.05; 544 youth protection 1.04; 545 family benefits **6.05** (revenue 1.41); 572 economic aid **6.19**; 579 assistance n.e.c. 3.51 (revenue 0.52); 592/593 aid in Switzerland/abroad 0.07. Total **54.00** | yes, 106 municipalities, per resident |
| 2 | Ticino law LaLPC (851.200), art. 31–33, and the law on the cantonal tax yield (num. 71), art. 2 | Who pays supplementary benefits and premium subsidies: Confederation, Canton, municipalities; each municipality pays a share of its cantonal tax yield (current text: 10.2% financially strong, 9.5% medium, 8.5% weak), on the yield of the second year before | Explains lines 512, 522, 532 (CHF 36.0M, two thirds of function 5) | – |
| 3 | City of Lugano, *Lugano in cifre 2026* (June 2026, `lugano-in-cifre-2026.pdf`, 19.9 MB), chapter Socialità, book pp. 96–101 (PDF pp. 54–56) | LAPS assistance cases 2014–2025; City's share of assistance costs 2015–2025; profile of recipients; AVS/AI pensioners and PC; municipal social benefits (Regolamento sociale); health-insurance arrears | Assistance cases **1'774** (2025; 1'709 in 2024); City share of assistance costs **CHF 5.3M** (2025, unchanged); pensioners AVS 11'438 + AI 2'254 = **13'692**, of whom **4'881 with PC** and 1'387 with a helplessness allowance; municipal benefits: **287** requests and CHF 169'385 (2025) vs 427 and CHF 254'985 (2024); arrears: 239 cases reported, 237 convened | – |
| 4 | BFS / Union of Swiss Cities, *Statistik der Schweizer Städte 2026 – Sozialhilfebeziehende* (dataflow `DF_SSV_SOCIAL`, CSV from the SDMX API, `bfs-ssv-social-2026.csv`) | Social assistance recipients (persons) and share of the resident population, 180 cities, 2015–2024 | 2024: **2'268 persons, 3.6%** (2023: 1'835, 2.9%; 2015: 2'139, 3.4%) | the 5 Ticino cities in the set: Chiasso 8.1%, Locarno 4.3%, Bellinzona 3.9%, Lugano 3.6%, Mendrisio 3.3% |
| 5 | City of Lugano, Municipio's answer to question no. 1426 on nurseries (30 July 2024, `mm-interrogazione-1426-nidi.pdf`) | The City's nurseries, run by its autonomous body LIS; private recognised nurseries in Lugano | 4 City nurseries; the table on p. 2 lists Polis 26, Molino Nuovo 20, Baroffio 45, Ronchetto 20 = **111**, the text on p. 4 says **121 places, 10 of them for child protection** (see notes); about 190 children in 2023, occupancy 100%, 96% from Lugano; over 100 pending requests; 13 private recognised nurseries in Lugano | – |

## Notes on the sources

- **Two thirds is a legal contribution.** Lines 512 (premium subsidies), 522 and 532 (supplementary benefits to AI and AVS) total CHF 36.0M in 2024. LaLPC art. 33 sets the municipal share as a percentage of the cantonal tax yield, graded by financial strength. The text in force today dates from 1 January 2026; the 2024 percentages were not found in a citable version, so the build will not recompute the contribution from the yield, only show the account lines and cite the article. To add when found: the 2024 version of art. 33.
- **Two counts of assistance.** The City counts **cases** handled by its LAPS desk (1'774 in 2025); the BFS counts **persons** supported during the year (2'268 in 2024), which includes every member of a supported household. They are not combined.
- **BFS 2024 break.** The BFS warns that Ticino's 2024 social assistance figures are about 200 dossiers higher canton-wide because of the first delivery under the modernised statistics. Lugano's jump from 1'835 to 2'268 persons (+24%) coincides with it, while the City's case count rose 4%. The 2024 value is shown with this note and the series is not read as a trend across 2023–2024.
- **City share of assistance (5.3M) and line 572 (6.19M)** are different measures: the yearbook gives the City's contribution to assistance costs; line 572 in the accounts is "economic aid" spending. Both are shown with their own labels; they are not reconciled.
- **Comparisons.** Function 5 per resident can be ranked across the 106 municipalities (source 1). The BFS rate exists only for the 5 Ticino cities in the city set, so it is shown as a short list, not a ranking of all municipalities.
- **Nursery places: 111 or 121.** The same answer lists 111 places by nursery and states 121 in the text, 10 of them for child protection. The difference equals the protection places, but the answer does not say they are outside the table. The star uses the stated total with the list and the gap shown, or waits for LIS's own figure.
- **Care homes** are already in the health arm (`salute.case-cura`, `salute.letti-cpa`); the social arm links to them rather than repeating them.

## Proposed stars (social arm)

1. **Spesa per la sicurezza sociale** (function 5, 2024): about CHF 849 per resident, ranked within Ticino; detail: the lines above, split into *contributi ai regimi cantonali* (512, 522, 532) and *servizi della Città* (the rest).
2. **Contributi obbligatori al Cantone** (512 + 522 + 532, 2024): CHF 36.0M, two thirds of function 5; method cites LaLPC art. 33; marked as a cantonal scheme.
3. **Persone in assistenza** (BFS, 2024): 3.6%, 2'268 persons, with the 2024 break note; detail: 2015–2024 series and the 5 Ticino cities.
4. **Casi di assistenza** (City, 2025): 1'774; detail: cases 2014–2025 and the City's share of costs 2015–2025.
5. **Beneficiari di prestazioni complementari** (2025): 4'881 of 13'692 AVS/AI pensioners (35.6%).
6. **Prestazioni comunali** (Regolamento sociale, 2025): 287 requests, CHF 169'385; detail: by category; health-insurance arrears as context.
7. **Asili nido della Città** (LIS, 2024): 121 places stated (111 listed by nursery) in 4 nurseries, 100% occupied; line 545 (family benefits, CHF 6.05M spending, 1.41M revenue) as City cost.

## Files to archive

`lugano-in-cifre-2026.pdf` (19.9 MB), `bfs-ssv-social-2026.csv` (API output; URL recorded), `mm-interrogazione-1426-nidi.pdf`; the SEL annex is already archived. The laws (source 2) are cited by URL; a PDF of LaLPC to archive when the build is written.

## Built (18 October 2026)

Six stars in `src/sociale.ts`, plus the anchor `sociale.spesa` (function 5, from the Ledger) with two detail views (spending by line; the City's own services, spending and revenue):

| Star | Value | Within Ticino |
|---|---|---|
| Spesa per la sicurezza sociale | CHF 849 per resident (CHF 54.0M, 2024) | 11th of 106, median 458 |
| Contributi ai regimi cantonali | CHF 36.0M (512 + 522 + 532, 67% of social spending) | not ranked (since 18 October 2026): the Canton collects it from the City, not from residents, and by law it follows each municipality's cantonal tax yield, so a comparison would show tax strength, not a cost for residents; the relation with taxes from individuals is removed |
| Persone in assistenza | 3.6% (2'268 persons, 2024, BFS) with the 2024 break note | 5 Ticino cities |
| Casi di assistenza | 1'774 (2025); City share CHF 5.3M | – |
| Prestazioni complementari | 4'881 of 13'692 AVS/AI pensioners (2025) | – |
| Prestazioni comunali | 287 requests, all granted, CHF 169'385 (2025) | – |
| Asili nido della Città | 121 places stated, 111 listed (2024) | – |

Checks that stop the build: TabD has the 106 municipalities and the lines add up to the function 5 anchor; the BFS persons ÷ our population give the BFS rate to 0.15 points; each yearbook chart label pairs with exactly one year by position, and the last values agree with the chapter's sentence (cases up, City share unchanged); AVS + AI = pensioners; benefit requests, amounts and granted requests match their printed changes, and the categories add up to the requests; the nursery table does not exceed the stated places. Contributions to cantonal schemes and supplementary benefits are marked as run by the Canton (hollow ring).

