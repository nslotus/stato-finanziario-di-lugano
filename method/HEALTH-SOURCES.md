# Health: sources and checks

From the notes of the working repository (October 2026). General rules: [`../METHOD.md`](../METHOD.md).


| Figure | Source | Location |
|---|---|---|
| Health spending, care homes, home/outpatient care, rescue, prevention (CHF per resident, 2024) | Canton of Ticino SEL, `2024-allegato.xlsx` and `2024-appendice.xlsx` | tab9e function 4; appendice TabA (41–49) and TabD (412, 421, 422, 431–433); population tab8. Gross spending. Labels are the canton's functional codes |
| Residents aged 65+ and 80+ (2024) | USTAT `T_010202_020.xlsx` | sheet 2024, rows with a BFS number (`5192 Lugano`, not the district row "Lugano") |
| Care-home beds per 1,000 aged 80+ (Ticino 169, Switzerland 193, 2024) | USTAT Annuario, ch. 14 Salute | p. 4 |
| Acute hospital stays per 1,000 residents (Ticino 148, 2024) | USTAT Annuario, ch. 14 Salute | p. 3 |
| Finance: gross debt Q1 2026, bonds outstanding | `dati-di-lugano` pinned at commit `8c1fd28` | `out/debt-profile.json` |
| Finance: net debt per resident | `2024-allegato.xlsx` | tab12 |

Checks that stop the build: all 106 municipalities match across files (one alias: "Bosco Gurin" = "5304 Bosco/Gurin"); canton population equals USTAT population for every municipality; the two-digit health functions add up to function 4; 421 + 422 = 42; every star has a source and every link resolves.

Population base: every per-resident figure divides by the canton's 2024 population (Lugano 63’629, federal definition), and each figure's method text says so. The build stops if the canton's own net-debt-per-resident figure implies a different Lugano population. The City's higher counts (64’430 in its register, 68’507 including secondary residents and cross-border workers living in Lugano) are not used, because they don't exist for the other 105 municipalities. Details in dati-di-lugano `METHODOLOGY.md`, decision 13.

Ranks and medians on the page are **within Ticino only** (106 municipalities, same cantonal rules and accounting model); they are not Switzerland-wide.

Rejected during sourcing: the 2025 age sheet (100 municipalities after mergers, would break the join with 2024 accounts); care-bed figures from search snippets, which disagreed between editions until read from the PDF.

