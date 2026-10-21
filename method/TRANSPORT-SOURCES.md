# Transport: source map

Sourced 15 October 2026 with Exa search highlights (updated the same day: TPL release PDF, PubliBike, airport left out); figures marked verified were checked by phrase search or cell read in the downloaded file. Nothing here is in the catalogue yet beyond the existing anchor star (★ 6).

## Verified sources

| # | Source | What it gives | Geography | Format | Verified |
|---|---|---|---|---|---|
| 1 | Canton of Ticino SEL, `2024-appendice.xlsx` (TabA, TabC, TabD, TabF) | Municipal **transport spending** 2024 by sub-function: 613 cantonal roads, 615 **municipal roads**, 618 private roads, 622 **regional and agglomeration traffic** (public transport), 629 other public transport, 631 navigation, 632 **aviation**, 633 other transport systems, 634 traffic planning. Gross (TabA/TabD) and net (TabC/TabF) | **all 106 municipalities** | xlsx (already archived) | labels from "Codifica funzionale". Lugano gross: 615 = 26.98M, 622 = 16.00M, 629 = 1.59M, 632 = 13.18M, 631 = 0.67M; 61 + 62 + 63 = 59.0M (= function 6). Net 63 = −0.22M |
| 2 | TPL – Trasporti Pubblici Luganesi SA, press release of the 2026 general meeting (`125163517-CS_Assembleaazionisti2026_TPL.pdf`, tplsa.ch) | **Passengers 2025**: "Complessivamente TPL ha trasportato 17’110’804 passeggeri, pari a un aumento del 4.42% rispetto al 2024. Le linee su gomma hanno raggiunto 14’008’855 utenti … la Funicolare Lugano–Stazione ha superato quota 3.1 milioni" | TPL network: Lugano and neighbouring municipalities (Massagno, Paradiso, Savosa, Vezia, Manno) | PDF | phrase checked in TPL's own release. Consistency: 17,110,804 − 14,008,855 = 3,101,949 funicular (> 3.1M). TPL is a company owned by public bodies; the City holds 4 of 9 board seats. No public full annual report found |
| 3 | City of Lugano, press release 5 August 2025, `20250805-cs-rete-bikesharing.pdf` | **PubliBike bike sharing**: "solo nel 2024 sono state registrate oltre 320’000 movimentazioni"; fleet "da 225 a 140 mezzi totali, suddivisi in 92 e-bike e 48 bici muscolari"; 35 new "light" stations; annual subscription from 99 to 69 francs; "dal 2027, il costo netto per la Città sarà di 96’000 franchi all’anno, inferiore rispetto agli attuali 107’000" | Lugano network (service since 2010; part of PubliBike–Velospot since the 2022 merger) | PDF | phrase checked. Consistency: 92 + 48 = 140 |
| 4 | FFS / SBB open data, "Ein- und Aussteigende an Bahnhöfen" (`passagierfrequenz`, data.sbb.ch; CSV export archived as `sbb-passagierfrequenz.csv`) | **Trains**: average daily boardings plus alightings per station, all days (DTV), weekdays (DWV) and weekends/holidays (DNWV); years 2018, 2022–2025. Lugano station 2025: 32’300 a day (35’600 weekdays, 25’000 weekends); 16’300 in 2018; busiest of the 35 Ticino stations in the list (Bellinzona 20’700) | Lugano station only (UIC 8505300) | CSV | 16.10.2026, read locally |

### Notes on the sources

- **Aviation (632) is included as a Lugano-only star** (choice made when the source was mapped, 15 October 2026, revised the same day because the line generates revenue). 2024: spending 13.18M, revenue 13.31M (TabE), net −0.13M (TabF), i.e. revenue exceeds spending by about CHF 0.13M; checked spending − revenue = net. Only Lugano has a material 632 line (Ascona and Losone show CHF 1k), so there is no Ticino comparison. These are the City's accounts, not the airport company's results.
- **TPL figures are for the Lugano area, not the city alone**, and TPL is a separate company. Label them "Luganese / TPL network", never as a city figure.
- The exact TPL figures now come from TPL's own release PDF. The same figures appear in tio.ch, cdt.ch and laRegione, all quoting it.
- **Rejected: frontaliereticino.ch** (24 June 2026) quotes the same release but adds figures that are not in it ("25 milioni di viaggiatori", "200 milioni di franchi" revenue, "50 milioni di viaggiatori"). Unreliable; not used anywhere.
- **PubliBike figures are the City's**, from its own release; "movimentazioni" are rentals (trips), not users. The release gives no count of registered users.
- **SBB counts are boardings plus alightings, not people**: someone changing trains counts twice (SBB definition). The Lugano row says "Senza FLP": the Ferrovie Luganesi line to Ponte Tresa is not SBB and is not included; buses are not included either.
- **Paradiso station is not Lugano**: the station formerly called Lugano-Paradiso (2’500 a day in 2025) lies in the municipality of Paradiso (SBB station page, Comune di Paradiso, Wikipedia), so it is left out. The Ticino rank compares stations in the SBB list, not municipalities. The dataset is revised each summer; the archived CSV is the 16 October 2026 snapshot.

## Found but not usable yet

| Source | What it would give | Why parked |
|---|---|---|
| BFS, *Bestand der Strassenfahrzeuge nach Gemeinde* (asset 33827764, PxWeb px-x-1103020100_111) | Passenger cars per municipality → **cars per 1,000 residents** for all 106 municipalities | BFS marks the 2010–2024 table "no longer current" after the 4 February 2026 revision; revised municipality data is announced for 2026. The PxWeb API no longer lists the table. Use once the revised release is out. Caveats to carry: cars count at the owner's address (rental and car-sharing headquarters inflate some municipalities); 2021+ not comparable with earlier years for some municipalities |
| ARE, *ÖV-Güteklassen* (public-transport service quality classes) | Share of residents in the best service classes (A–C) per municipality | Published as maps and a GIS layer on opendata.swiss; no per-municipality table found yet |
| USTAT, *Mobilità e trasporti in Ticino* (schede 2023, 2024) | Motorisation rate, traffic counts (e.g. A2 Grancia, Circonvallazione di Lugano), canton level | Canton and road-section level, not per municipality; possible context stars |

## Proposed stars

| Star | Code | Value (Lugano) | Comparison |
|---|---|---|---|
| Spesa per trasporti e comunicazioni (anchor, exists) | 6 | CHF 927 per resident | Ticino, 106 |
| Strade comunali | 615 | per resident | Ticino, 106 |
| Trasporto pubblico regionale e d'agglomerato | 622 | per resident | Ticino, 106 |
| Passeggeri TPL | TPL | 17,110,804 (2025): buses 14,008,855, funicular > 3.1M | Lugano area (TPL network); +4.42% on 2024 |
| Bike sharing PubliBike | PB | > 320,000 rentals (2024); 140 bikes (92 e-bikes, 48 standard) | Lugano network; City net cost 107,000 → 96,000 francs a year from 2027 |
| Relation | | road spending vs public-transport spending | scatter, Ticino |

Later, once the revised BFS data is out: **cars per 1,000 residents** (Ticino, 106) and a scatter against public-transport spending.
