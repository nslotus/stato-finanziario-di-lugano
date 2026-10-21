# City staff: source map

Mapped 19 October 2026 from a document already archived, read locally page by page (`npm run staff` → `catalog/personale.json`, then used by `npm run site`).

The question: how much of the City's money goes to the people who work for it (teachers, road workers, police, gardeners), and in which departments. The 2024 accounts give only the total: account 30 "Spese per il personale", **CHF 156.75M of 485.1M** (canton annex `tab9a`). The breakdown by department and service is in the City's own budget message.

## Verified source

| # | Source | What it gives | Lugano |
|---|---|---|---|
| 1 | City of Lugano, *Messaggio municipale sul preventivo 2027* (`city-preventivo-2027-messaggio.pdf`, already archived), p. 28, §4.3.2 | Account 30 by nature (300–309), columns P2027 · P2026 · C2025 | 2025 actual **CHF 156.71M** of total spending 490.69M (**31.9%**): administrative and operational salaries 104.67, teachers' salaries 22.29, employer contributions 25.71, allowances 1.62, authorities 1.28, other 0.68, employer pension benefits 0.45 |
| 1 | same, pp. 57–59, *Commento generale risorse umane*, Tabella 1 | Permanent staff (personale di ruolo) by department and cost centre: full-time units and gross salaries, P2027 · P2026 · C2025 | 2025: **1'301.42 units, CHF 114.42M**. Schools and social 457.08 (infanzia 147.46 units CHF 11.72M; elementare 178.85, 16.24M); Safety and public spaces 452.46 (roads 26.10, 2.16M; parks 45.83, 3.54M; cleaning 50.00, 3.45M; waste 23.16, 1.70M; police 9 centres; fire brigade 43.41, 3.45M) |
| 1 | same, pp. 60–62, Tabella 1a | Non-permanent staff (stand-ins, trainees, temporary, employment programmes) by cost centre | 2025: **233.86 units, CHF 11.28M**; the largest are the regional protection authority (36.77 units) and the interim airport management (27.99) |

## How the figures are read and checked

- Each table row is read by the position of its figures, because some centres have only one or two of the three years (new in 2027, or moved after 2025). Where the PDF puts two figures in one text item or splits one in two, the row is read as a sequence; "-" counts as zero.
- Checks, all passing: every department total equals the sum of its cost centres, in all six columns of both tables; the departments add up to "Totale Comune"; lines 300–309 add up to account 30.
- One figure in the source has no thousands separator (`118737.65`, economic development, table 1a); the check caught it when it was misread, and the reader now accepts it.

## How the page uses them

- **Third side of the planet system, "Personale" / "Staff"**, 2025 actual (the most recent closed year; the other two sides use the 2024 accounts, which have no breakdown by department). The sun is account 30, 156.7M.
- **One planet per department**, sized by gross salaries (permanent plus non-permanent). The moons are its services (20 in all), each listing its cost centres with salaries and units, the average gross salary per permanent unit, and the 2027 budget.
- **"Oneri sociali e altro"** is the rest of account 30 (CHF 31.02M): employer contributions, allowances, authorities, and **1.27M of salaries** that accounts 301–303 contain but the staff tables do not assign to a cost centre. It is shown as such, so the planets add up to the sun.

## Notes

- **Gross salaries are not the full cost of a post.** They exclude the employer's contributions (social security, pension fund), CHF 25.7M in 2025, which the City books in account 305 and the tables do not split by centre.
- **Units are full-time equivalents.** Two people at 50% count as one unit; the tables do not give head counts.
- **Teachers.** The City employs kindergarten and primary teachers (account 302, CHF 22.29M); middle and upper schools are cantonal. The *Istituto scolastico* centres also include non-teaching staff, so their salaries (27.96M for infanzia and elementare) are higher than account 302.
- **Not ranked against other municipalities**: no comparable breakdown exists for the other 105.
