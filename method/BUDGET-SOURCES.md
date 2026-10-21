# Budget against actual, and trends by sector: source map

Mapped 19 October 2026 with Exa search, then checked by downloading each file and reading the figures locally. Archived so far in `data/raw` (the 2024 canton annexes and the 2027 budget message are already in `sources/`).

The question: did each sector spend what was budgeted, and how is its spending moving? The page already has budget against actual for the City's totals (results 2024–2025, from the final-accounts slides via dati-di-lugano). What was missing is the same by sector.

## Verified sources

| # | Source | What it gives | Lugano |
|---|---|---|---|
| 1 | City of Lugano, *Messaggio municipale no. 12700, Consuntivo 2025* (`city-consuntivo-2025-messaggio.pdf`, 23 April 2026, 452 pp.) | §7.2 (p. 40) and p. 233: spending, revenue and net need **by department**, C2025 · P2025 (approved) · C2024. pp. 238–239: **2025 actual by function**, costs · revenue · balance, 1 to 3 digits. §7.3 (pp. 41 ff.): deviations by account of ±CHF 0.2M or more, with the City's explanation | Total spending C2025 **490.69M** against P2025 497.50M (−6.81M, −1.4%); by department e.g. Safety and public spaces 86.46 against 92.37 (−5.92), Schools and social 175.92 against 173.89 (+2.03), Advisory and management 120.54 against 116.51 (+4.03) |
| 2 | City of Lugano, *Messaggio municipale no. 12068, Preventivo 2025* (`city-preventivo-2025-messaggio.pdf`, 362 pp.) | p. 21 by department; pp. 221–223: **2025 budget by function** (costs · revenue without tax · balance) | Total costs **497.40M**: the Municipio's proposal. The approved budget (497.50M, source 1) adds CHF 100'000 in the department "Formazione, sostegno e socialità" (proposal 173'790'970, approved 173'890'970) |
| 3 | City of Lugano, *Messaggio sul preventivo 2027* (already archived), pp. 214–216 | **2027 budget by function** | Total costs **515.19M** |
| 4 | Canton of Ticino, SEL, *statistica finanziaria dei comuni 2023*, appendix `TabA` (`sel-2023-appendice.xlsx`), and 2024 (already archived) | Spending by function for every municipality | Lugano **481.11M (2023)**, **485.13M (2024)**; 2024 equals the City's own 2024 total (source 1), so the canton and City series join |

All three functional tables are read by column position: some PDF items split a number in two, so every row is checked (revenue − costs = printed balance), and the ten functions must add up to the printed total. All pass.

## What the figures say (spending by function, CHF million)

| Function | C2023 | C2024 | P2025 | C2025 | C2025 − P2025 | P2027 |
|---|---|---|---|---|---|---|
| 0 Administration | 48.33 | 45.71 | 48.25 | 44.17 | **−4.08 (−8.5%)** | 48.05 |
| 1 Safety | 45.30 | 45.82 | 48.03 | 46.54 | −1.49 (−3.1%) | 49.37 |
| 2 Education | 56.85 | 53.96 | 55.99 | 54.12 | −1.87 (−3.3%) | 55.06 |
| 3 Culture and sport | 51.55 | 53.62 | 54.93 | 52.72 | −2.21 (−4.0%) | 53.80 |
| 4 Health | 59.28 | 60.78 | 61.58 | 62.96 | **+1.38 (+2.2%)** | 66.22 |
| 5 Social | 53.96 | 54.00 | 55.16 | 57.18 | **+2.02 (+3.7%)** | 56.07 |
| 6 Transport | 57.93 | 58.99 | 59.61 | 59.17 | −0.45 (−0.7%) | 63.47 |
| 7 Environment | 29.99 | 29.65 | 31.36 | 32.79 | **+1.44 (+4.6%)** | 31.14 |
| 8 Economy | 3.89 | 4.55 | 5.37 | 4.60 | −0.77 (−14.3%) | 4.94 |
| 9 Finance | 74.04 | 78.05 | 77.12 | 76.44 | −0.68 (−0.9%) | 87.08 |
| **Total** | 481.11 | 485.13 | 497.40 | 490.69 | −6.71 (−1.3%) | 515.19 |

## Notes on the sources

- **Budget by function is the proposal.** The functional table exists only in the budget message; the Council's amendments to the 2025 budget added CHF 0.1M (department 5, i.e. function 2 or 5). The approved budget by department is in source 1 and is used for the department view.
- **Over or under budget is not good or bad by itself.** Spending below budget can be savings (the City says part of 2025 comes from recovery measures brought forward) or work not done; above budget can be rising demand (health: care homes and home care; social). The cards show the difference and quote the City's explanation where §7.3 gives one; they do not judge.
- **Costs include internal charges** (group 39) in all four sources, so the series are comparable with each other; they are not comparable with spending net of revenue.
- **2026 budget by function** would complete the series; the 2026 budget message is not yet archived.
- **Not ranked against other municipalities**: other municipalities' budgets are not collected by the canton.
