# Taxes, interest and per-resident rules: sources and checks

From the notes of the working repository (October 2026). General rules: [`../METHOD.md`](../METHOD.md).

## Amounts, per resident, rankings

A figure shows what is collected or spent, by whom. Money the City collects from someone who is not a resident, or not every resident, is shown as the amount, not divided by the population: taxes from individuals (400, paid by taxpayers), taxes from companies (401), revenue from public companies (446), and the contributions the Canton collects from the City (512 + 522 + 532). Spending stays per resident, because it serves residents. A figure is ranked against the other municipalities only when the comparison means something for a resident; when it does not, the comparison is left out and the method says why (for example, each municipality sets its own multiplier; 65 of 106 municipalities record no revenue in 446). The comparison per taxpayer is the federal tax figure.

## Business taxes at three levels: sources and checks

| Level | Figure | Source | Lugano |
|---|---|---|---|
| Municipal | Imposte delle persone giuridiche (★ 401) | `sel-2024-allegato.xlsx` tab9d, column 401 | CHF 75.6M in the 2024 accounts, 22% of municipal direct taxes; shown as the amount, not per resident and not ranked (companies are not residents) |
| Cantonal | Imposta cantonale delle aziende (★ IC·PG) | SEL distribution table under art. 196 cpv. 1bis LIFD, `TAB20260811-Riparto_9.0_mio_x_anno_2026-Gettito_2023.pdf`, column "Accertamento 2023 – Imposte PG" | CHF 117.2M (2023 assessment), 36.5% of Ticino's CHF 321.1M; CHF 1’846 per resident (2023 population) |
| Federal | Quota dell'imposta federale (★ IFD·Q) | same table, column "Ripartizione per comune, anno 2026" | CHF 3.29M of the CHF 9.0M the canton passes on to municipalities in 2026, in proportion to their companies' cantonal tax |

The federal direct tax paid by companies is published by ESTV per canton only, not per municipality, so the federal level shows what reaches the City. Checks that stop the build: the rows add up to the table's printed sums (company tax within CHF 2 of rounding, shares within CHF 0.05 of CHF 9'000'000.00); every share equals the distributed amount × the municipality's company tax ÷ the total, within CHF 0.05. The table uses 2026 municipal boundaries (for example Lema), so there is no ranking against the 2024 register; Lugano's own boundaries are unchanged. The overview chapter "Entrate" carries a note on the three levels.

## Bond interest: sources and checks

| Figure / chapter | Source | Location |
|---|---|---|
| Interest on bonds (★ 340), overview chapter "Interessi e rimborsi" | `dati-di-lugano` pinned at commit `a90ca4a` | `out/debt-service.json`: today.annualInterestM, accounts2024, byYear |
| Interest expense 2024 (context) | `2024-allegato.xlsx` | tab9c, column 340 "spese per interessi", row Lugano |

Computed in dati-di-lugano from the bond terms only (no SIX market data): one coupon a year on the maturity anniversary, the first about a year after issue, contracted schedule with no refinancing. Lugano: 11 bonds, CHF 1’120M, CHF 10.89M interest a year (0.97% average coupon, CHF 171 per resident). No Ticino comparison.

Checks that stop the build: the debt-service and debt-profile pins agree on the bond book (count and volume); account 340 read here from the canton annex equals the value used in dati-di-lugano (CHF 11.50M); 2024 accrued bond interest (CHF 8.64M) does not exceed it. The refinancing sentence in the chapter is arithmetic, not a forecast: the next maturing bond (2027, 120M at 0.25%) at the coupon of the latest issue (0.95%) costs CHF 0.84M more a year.

## Per taxpayer: sources and checks

| Figure | Source | Location |
|---|---|---|
| Federal tax per taxpayer, 2022 (★ IFD) | ESTV, direct federal tax, individuals, municipalities, fiscal year 2022 (latest published) | `estv-dbst-np-gden-2022-normalfall.xlsx` sheets 511 (taxpayers) and 513 (yield); `…-sonderfall.xlsx` sheets 611 and 613; column Total, Ticino rows |

Value = (normal + special-case yield) ÷ (normal + special-case taxpayers), with and without tax due. A married couple is one taxpayer. Lugano 2022: 41’410 taxpayers (32’375 normal, 9’035 special cases) for 62’464 residents; CHF 3’186 per taxpayer, 14th of 106 in Ticino (median 1’208); special cases pay 58% of Lugano's federal tax.

Checks that stop the build: every Ticino row matches the 2024 register after summing Maroggia, Melano and Rovio into Val Mara (5240); 106 municipalities; no suppressed totals; Ticino taxpayers 195’101 + 39’220 = 234’321, equal to ESTV's own canton figure. In the special-case sheets the Ticino total is larger than the sum of municipalities (38 taxpayers, CHF 1.95M of 193.5M), which ESTV's notes allow for; the build accepts a gap up to 2% and prints it.

This is the federal tax, not the municipal one. The canton's per-municipality revenue files (`Gettito_PF_provvisorio_2024`, `SerieGettito.xls`) give revenue but no taxpayer counts, so a municipal tax per taxpayer would mix 2024 revenue with 2022 counts; it is not built.

