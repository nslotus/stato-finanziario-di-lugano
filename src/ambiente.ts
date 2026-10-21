// The environment constellation (ENVIRONMENT-SOURCES.md): function 7 by line, municipal waste, wastewater, energy and
// climate, air quality. Waste, wastewater and energy are shown as amounts or as the yearbook prints them, not ranked:
// waste includes businesses, tourists and secondary residences; energy and CO2 per person are inflated by economic
// activity (the City's energy plan says so); wastewater runs through regional consortia.

import { compare, type Datum, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, sheet, type Row } from "./adapters/common";
import { matcher, type Municipality } from "./adapters/municipalities";
import { APPENDICE } from "./adapters/sel";
import { readPdf } from "./adapters/pdf";
import { BUDGET27_MSG } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const AC = "var(--ambiente)";
/** Italian article before a rounded percentage: l'8%, l'11%, l'80%, il 98% */
const il = (p: number) => { const r = Math.round(p); return `${/^(8|11|8\d)$/.test(String(r)) ? "l'" : "il "}${r}%`; };
export const F = { lic: "lugano-in-cifre-2026.pdf", peco: "lugano-peco-2026.pdf", city: "20260129-dati-statistici-citta-lugano-2025-rapporto.pdf" };
const LINES: [string, string, string][] = [
  ["710", "Approvvigionamento idrico", "Water supply"], ["720", "Acque di scarico", "Wastewater"], ["730", "Gestione dei rifiuti", "Waste management"],
  ["741", "Corsi d'acqua", "Watercourses"], ["761", "Protezione dell'aria e del clima", "Air and climate protection"],
  ["769", "Altra lotta contro l'inquinamento e risparmio energetico", "Other pollution control and energy saving"], ["771", "Cimiteri", "Cemeteries"],
  ["779", "Protezione dell'ambiente", "Environmental protection"], ["790", "Pianificazione del territorio", "Land planning"],
];
/** short chart labels for the line codes (the full names are in LINES) */
const SHORT: Record<string, [string, string]> = { "710": ["Acqua potabile", "Water supply"], "720": ["Acque di scarico", "Wastewater"], "730": ["Rifiuti", "Waste"],
  "741": ["Corsi d'acqua", "Watercourses"], "761": ["Aria e clima", "Air and climate"], "769": ["Energia", "Energy"], "771": ["Cimiteri", "Cemeteries"],
  "779": ["Ambiente", "Environment"], "790": ["Pianificazione", "Planning"] };
/** waste types in the yearbook table: regex label, it, en, recyclable */
const WASTE: [string, string, string, boolean][] = [
  ["RSU", "Rifiuti solidi urbani", "Household waste", false], ["ingombranti", "Ingombranti", "Bulky waste", false],
  ["scarti vegetali \\*", "Scarti vegetali", "Green waste", true], ["carta e cartone", "Carta e cartone", "Paper and cardboard", true], ["vetro", "Vetro", "Glass", true],
  ["alluminio–latta", "Alluminio e latta", "Aluminium and tin", true], ["PET", "PET", "PET", true], ["legname", "Legname", "Wood", true],
  ["ingombranti ferrosi", "Ingombranti ferrosi", "Scrap metal", true], ["materiale elettrico", "Materiale elettrico", "Electrical equipment", true],
  ["pile e batterie", "Pile e batterie", "Batteries", true], ["oli esausti", "Oli esausti", "Used oil", true], ["tessili", "Tessili", "Textiles", true],
  ["capsule caffè", "Capsule di caffè", "Coffee capsules", true], ["flaconi in PE e in PP", "Flaconi in PE e PP", "PE and PP bottles", true], ["scarti umidi", "Scarti umidi", "Food waste", true],
];
const N = String.raw`\d{1,3}(?:[’'] ?\d{3})*`, DEC = String.raw`\d{1,3}(?:['’]\d{3})*\.\d`;
const int = (s: string) => Number(s.replace(/[\s’']/g, ""));
const dec = (s: string) => Number(s.replace(/[\s’']/g, ""));
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}

export async function ambiente(register: Municipality[], src: Src) {
  // ---- function 7 by line
  const match = matcher(register);
  const isRow = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d)/i.test(norm(r[0])) && r.slice(1).some((c) => num(c) !== null);
  const tab = (t: string) => { const rows = sheet(APPENDICE, t), h = rows[1].map((x) => String(x ?? "").trim());
    const col = (code: string) => { const i = h.indexOf(code); if (i < 0) fail(`${t}: column ${code} missing`); return i; };
    const out = new Map<number, Record<string, number>>();
    for (const r of rows.slice(2)) if (isRow(r)) out.set(match(r[0], t).bfs, Object.fromEntries(LINES.map(([c]) => [c, num(r[col(c)]) ?? 0])));
    return out; };
  const spend = tab("TabD"), rev = tab("TabE");
  if (spend.size !== 106) fail(`TabD: ${spend.size} municipalities`);
  const ls = spend.get(5192)!, lr = rev.get(5192)!;
  const total7 = Object.values(ls).reduce((s, v) => s + v, 0) / 1000;
  const lineData = (m: Record<string, number>) => LINES.filter(([c]) => m[c] > 0)
    .map(([c]) => ({ key: `l${c}`, label: { it: `${c} ${SHORT[c][0]}`, en: `${c} ${SHORT[c][1]}` }, value: m[c] / 1000 })).sort((a, b) => b.value - a.value) as Datum[];

  // ---- yearbook: waste (pp. 76–77), energy, air, water (p. 73)
  const lic = (await readPdf(F.lic, [73, 76, 77])).pages;
  const w = findPage(lic, new RegExp(`Totale rifiuti t (${N}) (${N}) \\S+ \\([^)]*\\) kg/ab (\\d+\\.\\d) (\\d+\\.\\d) .{0,30}?Rifiuti non riciclabili t (${N}) (${N}) .{0,60}?Rifiuti riciclabili t (${N}) (${N}) .{0,60}?Tasso di riciclaggio % (\\d+\\.\\d)% (\\d+\\.\\d)%`), F.lic);
  const [tot24, tot25] = [int(w.m[1]), int(w.m[2])], [kg24, kg25] = [Number(w.m[3]), Number(w.m[4])];
  const [non24, non25, rec24, rec25] = [5, 6, 7, 8].map((k) => int(w.m[k])), [rate24, rate25] = [Number(w.m[9]), Number(w.m[10])];
  if (non24 + rec24 !== tot24 || non25 + rec25 !== tot25) fail(`${F.lic}: waste categories do not add up`);
  if (Math.abs((rec25 / tot25) * 100 - rate25) > 0.06) fail(`${F.lic}: ${rec25} / ${tot25} does not give ${rate25}%`);
  // the yearbook's kg per inhabitant divides by the City's own population count (dati statistici al 31.12.2025)
  const cityPop = int(findPage((await readPdf(F.city, [1, 2, 3])).pages, new RegExp(`TOTALE (${N}) (${N}) \\+`), F.city).m[2]);
  if (Math.abs((tot25 * 1000) / kg25 / cityPop - 1) > 0.002) fail(`${F.lic}: ${tot25} t / ${kg25} kg does not match the City's population ${cityPop}`);
  const fedPop = register.find((m) => m.bfs === 5192)!.population;
  const byType = findPage(lic, /Non riciclabili RSU .+? scarti umidi \S+ \S+/, F.lic);
  const types = WASTE.map(([re, it, en, recy]) => {
    const m = lic[byType.p - 1].match(new RegExp(`${re} (${DEC}) (${DEC})`)) ?? fail(`${F.lic}: waste type '${it}' not found`);
    return { it, en, recy, a: dec(m[1]), b: dec(m[2]) };
  });
  const sumT = (recy: boolean, k: "a" | "b") => types.filter((t) => t.recy === recy).reduce((s, t) => s + t[k], 0);
  if (Math.abs(sumT(false, "b") - non25) > 2 || Math.abs(sumT(true, "b") - rec25) > 2) fail(`${F.lic}: waste types do not add up to ${non25} / ${rec25}`);

  const env = lic[72] ?? fail(`${F.lic}: p. 73 missing`);
  const pick = (re: RegExp, what: string) => env.match(re) ?? fail(`${F.lic} p. 73: ${what} not found`);
  const ren = pick(/in rapporto all'energia totale\) (\d+\.\d)% (\d+\.\d)%/, "renewable share");
  const kwh = pick(new RegExp(`Consumo d'energia totale \\(kWh/ab\\) (${N}) (${N})`), "energy use");
  const pm = pick(/PM10 \(μg\/m ?3 ?\) (\d+) (\d+)/, "PM10"), no2 = pick(/NO2 \(μg\/m ?3 ?\) (\d+) (\d+)/, "NO2");
  const o3 = pick(/limite di 100 μg\/m ?3 ?\) (\d+) (\d+)/, "ozone");
  const water = pick(/per abitante allacciato\) \(m³\/ab\.\) (\d+\.\d+) (\d+\.\d+)/, "water balance");

  // ---- payments to consortia and the cantonal waste company (2027 budget message, p. 33): budget 2027, 2026, actual 2025
  const msg = (await readPdf(BUDGET27_MSG, [33])).pages;
  const M = String.raw`\d{1,3}(?:[’']\d{3})*\.\d\d`, D = String.raw`-?\d{1,3}(?:[’']\d{3})*\.\d\d`;
  const money = (s: string) => Number(s.replace(/[’']/g, ""));
  const acct = (code: string, label: string) => {
    const { p, m } = findPage(msg, new RegExp(`${code} ${label} (${M}) (${M}) (${D}) -?\\d+\\.\\d\\d ?% (${M}) (${D}) -?\\d+\\.\\d\\d ?%`), BUDGET27_MSG);
    const [b27, b26, d1, a25, d2] = [1, 2, 3, 4, 5].map((k) => money(m[k]));
    if (Math.abs(b27 - b26 - d1) > 0.01 || Math.abs(b27 - a25 - d2) > 0.01) fail(`${BUDGET27_MSG}: account ${code} differences do not match`);
    return { p, b27: b27 / 1e6, b26: b26 / 1e6, a25: a25 / 1e6 };
  };
  const cdaled = acct("36121100", "Consorzio Depurazione Acque Lugano e Dintorni"), cdaps = acct("36121101", "Consorzio Depurazione Acque Pian Scairolo");
  const acr = acct("36110000", "Rimborso all'ACR per smaltimento rifiuti");

  // ---- energy plan (PECo): 2018 balance per person, the cantonal comparison it gives, and its caveat
  const pe = (await readPdf(F.peco)).pages;
  const pc = findPage(pe, new RegExp(`una società da (${N}) Watt per persona e (\\d+\\.\\d) tonnellate di CO2 equivalente all’anno per persona`), F.peco);
  const pcTi = findPage(pe, new RegExp(`valori pari a (${N}) Watt per persona e (\\d+) tonnellate di CO2`), F.peco);
  const pcCav = findPage(pe, /sempre superiori alla media cantonale tenuto conto del grande numero di attività economiche/, F.peco);
  const pcYear = findPage(pe, /energia consumata nel Comune di Lugano nel (\d{4}) in MWh/, F.peco).m[1];
  const pcTiYear = findPage(pe, /riportava per il (\d{4}) per l’intero Canton Ticino/, F.peco).m[1];

  // ---- why the anchor is not ranked: water supply (710) is booked by most municipalities, not by Lugano, where AIL
  // manages drinking water on behalf of the City's water company (AIL integrated report, p. 5)
  const per710 = [...spend].map(([bfs, v]) => (v["710"] * 1000) / register.find((m) => m.bfs === bfs)!.population).sort((a, b) => a - b);
  const med710 = per710[per710.length >> 1], lug710 = (ls["710"] * 1000) / register.find((m) => m.bfs === 5192)!.population;
  const ail = (await readPdf("ail-rapporto-integrato-2025.pdf", [5])).pages;
  const ailWater = findPage(ail, /acqua potabile; quest.ultima gestita per conto delle aziende dell.acqua potabile della Città di Lugano/, "ail-rapporto-integrato-2025.pdf");
  const anchorNote: Text = {
    it: `La cifra non è confrontata con gli altri comuni. Molti comuni registrano qui l'approvvigionamento idrico (voce 710: mediana ${n(med710, 0)} CHF per abitante); a Lugano l'acqua potabile la gestisce AIL per conto dell'azienda dell'acqua della Città, e la voce 710 vale ${n(lug710, 0)} CHF per abitante. Il confronto misurerebbe come è organizzata l'acqua, non la spesa per l'ambiente.`,
    en: `The figure is not compared with other municipalities. Many municipalities book their water supply here (line 710: median CHF ${n(med710, 0)} per resident); in Lugano drinking water is managed by AIL on behalf of the City's water company, and line 710 is CHF ${n(lug710, 0)} per resident. The comparison would measure how water is organised, not environment spending.` };
  const anchorSrc = [src(APPENDICE, "sheet TabD, column 710, row of each municipality (CHF thousands)"), src("ail-rapporto-integrato-2025.pdf", `p. ${ailWater.p}: drinking water managed on behalf of the City's water companies`)];

  const usc = (file: string, loc: string) => src(file, loc);
  const yr = (y: number) => ({ it: String(y), en: String(y) });
  const anchorDetail = [
    { title: { it: "Ambiente e territorio nei conti della Città, 2024: spese e ricavi per voce", en: "Environment and land in the City's accounts, 2024: spending and revenue by line" } as Text,
      chart: { type: "columns" as const, unit: "mio CHF", digits: 2, color: AC, series: [
        { label: { it: "Spese", en: "Spending" }, data: lineData(ls).filter((d) => d.value >= 0.9).map((d) => ({ ...d, key: `a${d.key}` })) },
        { label: { it: "Ricavi", en: "Revenue" }, data: lineData(ls).filter((d) => d.value >= 0.9).map((d) => ({ ...d, key: `b${d.key}`, value: lr[d.key.slice(1)] / 1000 })) }] },
      note: { it: `Acque di scarico (720) e rifiuti (730) sono finanziati quasi interamente dalle tasse pagate per il servizio (${n((lr["720"] / ls["720"]) * 100, 0)}% e ${n((lr["730"] / ls["730"]) * 100, 0)}% della spesa nel 2024). Voci sopra 0,9 milioni.`,
        en: `Wastewater (720) and waste (730) are financed almost entirely by fees paid for the service (${n((lr["720"] / ls["720"]) * 100, 0)}% and ${n((lr["730"] / ls["730"]) * 100, 0)}% of spending in 2024). Lines above CHF 0.9 million.` },
      source: [src(APPENDICE, "sheets TabD and TabE, columns 710–790, row 'Lugano' (CHF thousands)")] },
  ];

  const stars: Star[] = [
    { id: "ambiente.rifiuti", constellation: "ambiente", label: { it: "Rifiuti urbani", en: "Municipal waste" },
      about: { it: `Rifiuti urbani raccolti dalla Città nel 2025: ${n(tot25)} tonnellate, di cui ${n(rec25)} riciclabili; tasso di riciclaggio ${n(rate25, 1)}% (${n(rate24, 1)}% nel 2024). La gestione è pagata dalle tasse sui rifiuti, che nel 2024 hanno coperto ${il((lr["730"] / ls["730"]) * 100)} della spesa.`,
        en: `Municipal waste collected by the City in 2025: ${n(tot25)} tonnes, ${n(rec25)} of them recyclable; recycling rate ${n(rate25, 1)}% (${n(rate24, 1)}% in 2024). It is paid for by waste fees, which covered ${n((lr["730"] / ls["730"]) * 100, 0)}% of spending in 2024.` },
      value: tot25, unit: "tonnellate", year: 2025, area: "Lugano", kind: "official",
      method: { it: `Registri della Città (annuario). L'annuario indica anche ${n(kg25, 1)} kg per abitante, calcolati sulla popolazione della Città (${n(cityPop)}, comprese residenze secondarie e soggiornanti); sui ${n(fedPop)} residenti permanenti usati per le altre cifre sarebbero ${n((tot25 * 1000) / fedPop, 0)} kg. La cifra non è confrontata con gli altri comuni: i rifiuti urbani comprendono quelli delle piccole aziende, dei turisti e delle residenze secondarie, quindi un confronto per abitante non misura le abitudini dei residenti.`,
        en: `City records (yearbook). The yearbook also gives ${n(kg25, 1)} kg per inhabitant, calculated on the City's own population count (${n(cityPop)}, including secondary and temporary residents); on the ${n(fedPop)} permanent residents used for the other figures it would be ${n((tot25 * 1000) / fedPop, 0)} kg. It is not compared with other municipalities: municipal waste includes that of small businesses, tourists and secondary residences, so a per-resident comparison does not measure residents' habits.` },
      source: [usc(F.lic, `PDF p. ${w.p} (book p. 140–141): 'Consumo annuale e pro capite'; p. ${byType.p}: 'Ripartizione del consumo per tipologia'`), usc(F.city, "table 1, 'TOTALE' population at 31.12.2025"), src(APPENDICE, "sheets TabD and TabE, column 730, row 'Lugano'")],
      context: [{ label: { it: "Tasso di riciclaggio", en: "Recycling rate" }, value: rate25, unit: "%" }, { label: { it: "Spesa rifiuti 730 (2024)", en: "Waste spending 730 (2024)" }, value: ls["730"] / 1000, unit: "mio CHF" },
        { label: { it: "Tasse sui rifiuti 730 (2024)", en: "Waste fees 730 (2024)" }, value: lr["730"] / 1000, unit: "mio CHF" },
        { label: { it: "All'azienda cantonale dei rifiuti (2025)", en: "To the cantonal waste company (2025)" }, value: acr.a25, unit: "mio CHF" }],
      related: ["ambiente.spesa", "ambiente.energia"],
      detail: [
        { title: { it: "Rifiuti per tipo, 2025", en: "Waste by type, 2025" },
          chart: { type: "hbars", unit: "tonnellate", color: AC, caption: { it: "tonnellate · 2025", en: "tonnes · 2025" },
            data: types.map((t, k) => ({ key: `w${k}`, label: { it: t.it + (t.recy ? "" : " (non riciclabile)"), en: t.en + (t.recy ? "" : " (non-recyclable)") }, value: t.b })).sort((a, b) => b.value - a.value) },
          note: { it: "Dal 2020 gli scarti vegetali delle squadre comunali di giardinieri non sono più contati (circa 1'500 tonnellate all'anno).", en: "Since 2020 the green waste of the City's gardening teams is no longer counted (about 1,500 tonnes a year)." },
          source: [usc(F.lic, `PDF p. ${byType.p}, table 'Ripartizione del consumo per tipologia'`)] },
        { title: { it: "Riciclabili e non riciclabili", en: "Recyclable and non-recyclable" },
          chart: { type: "columns", unit: "tonnellate", color: AC, series: [
            { label: { it: "Non riciclabili", en: "Non-recyclable" }, data: [{ key: "n24", label: yr(2024), value: non24 }, { key: "n25", label: yr(2025), value: non25 }] },
            { label: { it: "Riciclabili", en: "Recyclable" }, data: [{ key: "r24", label: yr(2024), value: rec24 }, { key: "r25", label: yr(2025), value: rec25 }] }] },
          source: [usc(F.lic, `PDF p. ${w.p}`)] }] },
    { id: "ambiente.acque", constellation: "ambiente", label: { it: "Acque di scarico", en: "Wastewater" },
      about: { it: `Spesa della Città per le acque di scarico (voce 720) nel 2024: ${n(ls["720"] / 1000, 1)} milioni di franchi, coperti per ${il((lr["720"] / ls["720"]) * 100)} dalle tasse (${n(lr["720"] / 1000, 1)} milioni). La depurazione la fanno due consorzi intercomunali, a cui la Città ha versato ${n(cdaled.a25 + cdaps.a25, 2)} milioni nel 2025.`,
        en: `The City's spending on wastewater (line 720) in 2024: CHF ${n(ls["720"] / 1000, 1)} million, ${n((lr["720"] / ls["720"]) * 100, 0)}% covered by fees (CHF ${n(lr["720"] / 1000, 1)} million). Treatment is done by two inter-municipal consortia, to which the City paid CHF ${n(cdaled.a25 + cdaps.a25, 2)} million in 2025.` },
      value: ls["720"] / 1000, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: "Voce 720 «Eliminazione delle acque di scarico» del conto economico 2024 della Città. Non è divisa per gli abitanti né confrontata con gli altri comuni: la depurazione è affidata a consorzi intercomunali, e la spesa è pagata da chi usa il servizio.",
        en: "Line 720 'Wastewater disposal' in the City's 2024 accounts. It is not divided by residents or compared with other municipalities: treatment is run by inter-municipal consortia, and the cost is paid by those who use the service." },
      source: [src(APPENDICE, "sheets TabD and TabE, column 720, row 'Lugano'"), usc(BUDGET27_MSG, `p. ${cdaled.p}: accounts 36121100 and 36121101`), usc(F.lic, "PDF p. 73: 'Bilancio idrico'")],
      context: [{ label: { it: "Tasse 720", en: "Fees 720" }, value: lr["720"] / 1000, unit: "mio CHF" },
        { label: { it: "Acqua agli impianti, per abitante allacciato (2025)", en: "Water to the plants, per connected inhabitant (2025)" }, value: Number(water[2]), unit: "m³ / abitante" }],
      related: ["ambiente.spesa"],
      detail: [{ title: { it: "Contributi della Città ai consorzi di depurazione", en: "City contributions to the treatment consortia" },
        chart: { type: "columns", unit: "mio CHF", digits: 2, color: AC, series: [
          { label: { it: "Lugano e Dintorni (CDALED)", en: "Lugano e Dintorni (CDALED)" }, data: ([["a25", "Consuntivo 2025", "Actual 2025", "actual"], ["b26", "Preventivo 2026", "Budget 2026", "budget"], ["b27", "Preventivo 2027", "Budget 2027", "budget"]] as const)
            .map(([k, it, en, st]) => ({ key: `l${k}`, label: { it, en }, value: cdaled[k], status: st })) },
          { label: { it: "Pian Scairolo (CDAPS)", en: "Pian Scairolo (CDAPS)" }, data: ([["a25", "Consuntivo 2025", "Actual 2025", "actual"], ["b26", "Preventivo 2026", "Budget 2026", "budget"], ["b27", "Preventivo 2027", "Budget 2027", "budget"]] as const)
            .map(([k, it, en, st]) => ({ key: `p${k}`, label: { it, en }, value: cdaps[k], status: st })) }] },
        source: [usc(BUDGET27_MSG, `p. ${cdaled.p}: accounts 36121100, 36121101 (budget 2027, budget 2026, actual 2025)`)] }] },
    { id: "ambiente.energia", constellation: "ambiente", label: { it: "Energia e clima", en: "Energy and climate" },
      about: { it: `Consumo di energia a Lugano nel 2025: ${n(int(kwh[2]))} kWh per abitante secondo l'annuario (${n(int(kwh[1]))} nel 2024); ${n(Number(ren[2]), 0)}% era energia rinnovabile. Il piano energetico della Città stima per il ${pcYear} ${pc.m[2]} tonnellate di CO₂ per persona; per il Ticino il piano cantonale dava ${pcTi.m[2]} tonnellate (${pcTiYear}).`,
        en: `Energy use in Lugano in 2025: ${n(int(kwh[2]))} kWh per inhabitant according to the yearbook (${n(int(kwh[1]))} in 2024); ${n(Number(ren[2]), 0)}% was renewable. The City's energy plan estimates ${pc.m[2]} tonnes of CO₂ per person for ${pcYear}; for Ticino the cantonal plan gave ${pcTi.m[2]} tonnes (${pcTiYear}).` },
      value: int(kwh[2]), unit: "kWh / abitante", year: 2025, area: "Lugano", kind: "official",
      method: { it: `Cifre per abitante come stampate dall'annuario (fonte AIL), che non indica la popolazione usata. Le emissioni sono una stima per il ${pcYear} del piano energetico comunale, che avverte: i valori per persona di Lugano saranno «sempre superiori alla media cantonale tenuto conto del grande numero di attività economiche in rapporto alla popolazione residente». Per questo non sono confrontati con gli altri comuni.`,
        en: `Per-inhabitant figures as printed in the yearbook (source AIL), which does not state the population used. Emissions are an estimate for ${pcYear} from the municipal energy plan, which warns that Lugano's per-person values will "always be higher than the cantonal average, given the large number of economic activities relative to the resident population". For that reason they are not compared with other municipalities.` },
      source: [usc(F.lic, "PDF p. 73 (book p. 134–135): 'Energia'"), usc(F.peco, `p. ${pc.p}: per-person energy and CO₂; p. ${pcCav.p}: caveat`)],
      context: [{ label: { it: "Quota rinnovabile", en: "Renewable share" }, value: Number(ren[2]), unit: "%" },
        { label: { it: `CO₂ per persona, Lugano ${pcYear}`, en: `CO₂ per person, Lugano ${pcYear}` }, value: Number(pc.m[2]), unit: "t CO₂" },
        { label: { it: `CO₂ per persona, Ticino ${pcTiYear}`, en: `CO₂ per person, Ticino ${pcTiYear}` }, value: Number(pcTi.m[2]), unit: "t CO₂" }],
      related: ["ambiente.aria", "economia.imprese-pubbliche"],
      detail: [{ title: { it: "Consumo di energia e quota rinnovabile", en: "Energy use and renewable share" },
        chart: { type: "hbars", unit: "kWh / abitante", color: AC, caption: { it: "kWh per abitante", en: "kWh per inhabitant" },
          data: [{ key: "k24", label: { it: `2024 (rinnovabile ${n(Number(ren[1]), 0)}%)`, en: `2024 (renewable ${n(Number(ren[1]), 0)}%)` }, value: int(kwh[1]) },
            { key: "k25", label: { it: `2025 (rinnovabile ${n(Number(ren[2]), 0)}%)`, en: `2025 (renewable ${n(Number(ren[2]), 0)}%)` }, value: int(kwh[2]) }] },
        source: [usc(F.lic, "PDF p. 73: 'Qualità dell'energia' and 'Consumo d'energia totale'")] }] },
    { id: "ambiente.aria", constellation: "ambiente", label: { it: "Qualità dell'aria", en: "Air quality" },
      about: { it: `Polveri fini (PM10) a Lugano nel 2025: ${pm[2]} μg/m³ in media (${pm[1]} nel 2024). Il diossido di azoto è sceso a ${no2[2]} μg/m³ (${no2[1]}), mentre il limite di 100 μg/m³ per l'ozono è stato superato ${o3[2]} volte (${o3[1]} nel 2024).`,
        en: `Fine particles (PM10) in Lugano in 2025: ${pm[2]} μg/m³ on average (${pm[1]} in 2024). Nitrogen dioxide fell to ${no2[2]} μg/m³ (${no2[1]}), while the 100 μg/m³ ozone limit was exceeded ${o3[2]} times (${o3[1]} in 2024).` },
      value: Number(pm[2]), unit: "μg/m³", year: 2025, area: "Lugano", kind: "official",
      method: { it: "Misure dell'Osservatorio ambientale della Svizzera italiana (OASI), come riportate dall'annuario. I valori limite di legge non sono nelle fonti archiviate e non sono mostrati.", en: "Measurements by the Osservatorio ambientale della Svizzera italiana (OASI), as reported by the yearbook. The legal limit values are not in the archived sources and are not shown." },
      source: [usc(F.lic, "PDF p. 73 (book p. 134–135): 'Aria'")],
      context: [{ label: { it: "Diossido di azoto (NO₂)", en: "Nitrogen dioxide (NO₂)" }, value: Number(no2[2]), unit: "μg/m³" },
        { label: { it: "Superamenti del limite dell'ozono", en: "Ozone limit exceedances" }, value: Number(o3[2]), unit: "superamenti" }],
      related: ["ambiente.energia"],
      detail: [{ title: { it: "Polveri fini e diossido di azoto", en: "Fine particles and nitrogen dioxide" },
        chart: { type: "columns", unit: "μg/m³", color: AC, series: [
          { label: yr(2024), data: [{ key: "p24", label: { it: "PM10", en: "PM10" }, value: Number(pm[1]) }, { key: "n24", label: { it: "NO₂", en: "NO₂" }, value: Number(no2[1]) }] },
          { label: yr(2025), data: [{ key: "p25", label: { it: "PM10", en: "PM10" }, value: Number(pm[2]) }, { key: "n25", label: { it: "NO₂", en: "NO₂" }, value: Number(no2[2]) }] }] },
        source: [usc(F.lic, "PDF p. 73, table 'Aria'")] }] },
  ];
  return { stars, anchorDetail, total7, anchorNote, anchorSrc };
}

export const AMBIENTE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.peco]: { url: "https://www.lugano.ch/dam/jcr:e6231a39-ee28-4066-92c9-3f62e5f5da89/PECo.pdf", publisher: "Città di Lugano, Piano energetico comunale (PECo), adottato nel luglio 2026" },
};
