# Environment: source map

Mapped 18 October 2026, with Exa search, then checked by downloading each file and reading the figures locally (phrases located by page, one page at a time).

Environment and land is function 7 of the municipal accounts. In 2024 the City spent **CHF 29.7M** on it (Ledger spending chapter, `7 Ambiente e territorio`). Most of it is financed by fees paid for the service: wastewater (CHF 10.36M spending, 9.40M revenue) and waste (8.79M, 8.65M) cover themselves almost entirely, as the waste regulation requires (cost-coverage principle).

## Verified sources

| # | Source | What it gives | Lugano | Comparison |
|---|---|---|---|---|
| 1 | Canton SEL annex 2024, appendice `TabA`–`TabF` (already archived) | Function 7 by line, spending and revenue | Spending 2024 (CHF M): 720 wastewater **10.36** (revenue 9.40); 730 waste **8.79** (revenue 8.65); 790 land planning **3.07** (0.12); 769 other pollution control and energy saving **2.96** (3.90); 779 environmental protection 1.51; 741 watercourses 1.24; 771 cemeteries 0.98 (0.41); 761 air and climate 0.47 (0.41); 710 water supply 0.28. Total **29.7** | per resident across 106 (anchor) |
| 2 | City of Lugano, *Lugano in cifre 2026* (already archived), chapters Ambiente (PDF pp. 72–74) and Rifiuti urbani (pp. 76–77) | Weather, water, energy, air, noise; municipal waste by type, recycling rate | Waste 2025: **25'721 t** (non-recyclable 15'298, recyclable 10'423), **recycling rate 40.5%** (2024: 41.3%); 18 types (household waste 14'418 t, paper 3'585, glass 2'541, …). Energy: **9'489 kWh per inhabitant**, renewable share **83%** (2024: 88%), source AIL. Air: PM10 **14 µg/m³**, NO₂ **17 µg/m³**, ozone limit exceeded **506** times (source OASI). Water entering treatment plants: 326 m³ per connected inhabitant | – |
| 3 | City of Lugano, *Messaggio preventivo 2027* (already archived), p. 33 | The City's payments to consortia and the cantonal waste company: budget 2027, budget 2026, actual 2025 | Actual 2025: wastewater consortium CDALED **CHF 5.65M**, Pian Scairolo **1.25M**; cantonal waste company ACR (incineration) **2.18M**; Valli del Cassarate e Golfo 0.97M; Pian Scairolo embankments 0.26M; lake shore cleaning 0.16M | – |
| 4 | City of Lugano, *Piano energetico comunale* (PECo, adopted July 2026, `lugano-peco-2026.pdf`, p. 8) | Energy balance of the municipal territory for 2018 (by CSD), CO₂ | 2018: **5'260 W and 9.5 t CO₂-eq per person**; the cantonal energy plan gives 4'600 W and 6 t for Ticino (2021); the plan says Lugano's per-person values "will always be higher than the cantonal average, given the large number of economic activities relative to the resident population" | Ticino only as the plan's own context |
| 5 | City of Lugano, *Rapporto di sostenibilità 2024* (`lugano-rapporto-sostenibilita-2024.pdf`, 19.5 MB, p. 28) | Energy-city label (European Energy Award) | Score **64.9%** (certified at 50%; 55.7% at the first certification in 2019) | – |

## Notes on the sources

- **Waste per resident is not a fair ranking.** Municipal waste includes waste from businesses with fewer than 250 employees, tourists and secondary residences (cantonal waste plan; the waste base fee is also charged to secondary residences). Published per-resident rankings put tourist municipalities at the bottom for that reason. Proposal: show the tonnes and the recycling rate, not ranked. The yearbook's 374.8 kg per inhabitant divides by the City's own population count (68'633); by the federal count used everywhere else (63'629) it would be 404 kg. The star states the base.
- **Energy and CO₂ per person** are also inflated by economic activity, as the PECo itself says; the CO₂ figure is an estimate for 2018. Proposal: show them with that caveat and the cantonal context the plan gives, not ranked.
- **Wastewater and waste are fee-financed**: the star shows spending next to fee revenue, so it is clear who pays (users, not the general tax).
- **The yearbook's per-inhabitant values** (energy, water) do not state their population base; the star quotes them as the yearbook prints them.
- **Air quality** values are shown without legal limits: the limits are in the federal air ordinance, not in the archived sources.
- **The sustainability report is 19.5 MB** for one figure (the label score). It is also stated on the City's web page (HTML, not archived by rule). Archive it only if the label star is wanted.

## Proposed stars (environment arm)

1. **Spesa per ambiente e territorio** (function 7, 2024): per resident, ranked; detail: spending and revenue by line, showing the fee-financed lines.
2. **Rifiuti urbani**: 25'721 t (2025), recycling rate 40.5%; detail: by type, 2024–2025; context: waste spending and fee revenue (730), payment to the cantonal waste company. Not ranked.
3. **Acque di scarico**: CHF 10.36M spending, 9.40M fee revenue (2024); payments to the two treatment consortia (6.90M, 2025); water entering the plants per connected inhabitant. As amounts, not ranked (regional consortia).
4. **Energia e clima**: 9'489 kWh per inhabitant, 83% renewable (2025); CO₂ 9.5 t per person (2018 estimate, with the plan's caveat); label score 64.9% as context if archived.
5. **Qualità dell'aria**: PM10 14 µg/m³, NO₂ 17 µg/m³, ozone exceedances 506 (2025); detail: monthly PM10 and NO₂ (chart, read by position).

## Files to archive

`lugano-peco-2026.pdf` (0.2 MB); optionally `lugano-rapporto-sostenibilita-2024.pdf` (19.5 MB). The annex, the yearbook and the 2027 budget message are already archived.

## Built (18 October 2026)

Four stars in `src/ambiente.ts`, plus the anchor `ambiente.spesa` (function 7, from the Ledger) with spending and revenue by line:

| Star | Value | Within Ticino |
|---|---|---|
| Spesa per ambiente e territorio | CHF 466 per resident (CHF 29.7M, 2024) | not ranked: most municipalities book their water supply here (line 710: median CHF 213 per resident); in Lugano AIL manages drinking water on behalf of the City's water company (AIL report, p. 5), so line 710 is CHF 4. Ranked, Lugano would be 89th; the comparison would measure how water is organised |
| Rifiuti urbani | 25'721 t (2025), recycling rate 40.5%; fees covered 98% of waste spending (2024) | not ranked: municipal waste includes small businesses, tourists, secondary residences |
| Acque di scarico | CHF 10.36M spending, 91% covered by fees (2024); CHF 6.90M to the two treatment consortia (2025) | not ranked: inter-municipal consortia, paid by users |
| Energia e clima | 9'489 kWh per inhabitant, 83% renewable (2025); 9.5 t CO₂ per person (2018 estimate; Ticino 6 t, 2021) | not ranked: the energy plan's own caveat on economic activity |
| Qualità dell'aria | PM10 14 μg/m³, NO₂ 17 μg/m³, ozone limit exceeded 506 times (2025) | – |

Checks that stop the build: TabD has the 106 municipalities and the lines add up to the function 7 anchor; waste categories add up to the total, and the types to each category (within 2 t); the recycling rate recomputes; the yearbook's kg per inhabitant matches the City's own population count (68'633) to 0.2%; each consortium and ACR account matches its printed differences; every phrase of the energy plan used (per-person values, cantonal comparison, caveat, years) is found.

