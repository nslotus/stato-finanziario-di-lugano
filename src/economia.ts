// The economy constellation (ECONOMY-SOURCES.md): jobs, workplaces, cross-border workers, unemployment, hotel nights,
// vacancy, property transactions and the City's revenue from its public companies. All sources are tables or literal
// phrases, read deterministically; series end values are checked against the stars, totals against the tables.
// Boundaries: the newest USTAT sheets use the 2025 municipalities (100); comparisons use each table's own set and say so.

import { readFileSync } from "node:fs";
import { compare, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, rawPath, sheet, type Row } from "./adapters/common";
import { AGE_FILE, matcher, type Municipality } from "./adapters/municipalities";
import { ALLEGATO, APPENDICE } from "./adapters/sel";
import { readPdf } from "./adapters/pdf";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const EC = "var(--economia)";
export const F = {
  jobs: "ustat-T_030203_040.xlsx", cross: "ustat-T_030204_040.xlsx", empty: "ustat-T_090203_020.xls", dwell: "ustat-T_090203_030.xls",
  sales: "ustat-T_090502_010.xlsx", hotel: "ustat-T_100301_010.xls", nights: "ustat-T_100301_040.xls",
  city: "20260129-dati-statistici-citta-lugano-2025-rapporto.pdf", unemp: "20260213-analisi-disoccupazione-lugano-2025-comunicato.pdf",
  ail: "ail-rapporto-integrato-2025.pdf",
};
/** Page texts of the given pages (all when omitted). */
const pdfPages = async (file: string, wanted?: number[]) => (await readPdf(file, wanted)).pages;
/** First page matching a phrase: its number (1-based) and the match. */
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}
/** "41’ 499" → 41499; "1 2.0" → 12.0 (the PDFs split digits into separate text items) */
const int = (s: string) => Number(s.replace(/[\s’']/g, ""));
const N = String.raw`\d{1,3}(?:[’'] ?\d{3})*`;
const USTAT = "https://www3.ti.ch/DFE/DR/USTAT/allegati/tabella/";
const LUGANO = "5192 Lugano";

/** Rows with a BFS number ("5192 Lugano"), keyed by number. */
function byBfs(rows: Row[]) {
  const out = new Map<number, { name: string; r: Row }>();
  for (const r of rows) { const m = String(r[0] ?? "").trim().match(/^(\d{4}) (.+)$/); if (m) out.set(Number(m[1]), { name: m[2], r }); }
  return out;
}
const rowOf = (rows: Row[], label: string) => rows.find((r) => String(r[0] ?? "").trim() === label) ?? fail(`row ${label} missing`);
/** Column index of each year in a header row (years may be numbers or strings, with a "p" for provisional). */
function yearCols(header: Row) {
  const m = new Map<number, number>();
  header.forEach((h, i) => { const y = String(h ?? "").match(/^(\d{4})p?$/); if (y && !m.has(Number(y[1]))) m.set(Number(y[1]), i); });
  return m;
}

export async function economia(register: Municipality[], src: Src) {
  const pop24 = new Map(register.map((m) => [m.bfs, m.population]));
  const lugPop = pop24.get(5192)!;

  // ---- 1, 2: workplaces and jobs (STATENT 2024; series since 2011)
  const j24 = sheet(F.jobs, "2024");
  const jl = rowOf(j24, LUGANO), jt = rowOf(j24, "Ticino");
  const [az, azP, azS, azT, ad, adP, adS, adT, etp] = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => num(jl[i]) ?? fail(`${F.jobs}: Lugano column ${i}`));
  if (azP + azS + azT !== az || adP + adS + adT !== ad) fail(`${F.jobs}: sectors do not add up for Lugano`);
  const [azTI, adTI] = [num(jt[2])!, num(jt[6])!];
  const rows24 = byBfs(j24);
  if (rows24.size !== 106) fail(`${F.jobs} 2024: ${rows24.size} municipalities`);
  const jobsCmp = compare([...rows24].map(([bfs, x]) => {
    const p = pop24.get(bfs) ?? fail(`${F.jobs}: ${bfs} ${x.name} not in the 2024 register`);
    return { bfs, name: x.name, value: ((num(x.r[6]) ?? 0) / p) * 100, population: p };
  }), "per 100 abitanti", "highest-first");
  const jser = sheet(F.jobs, "Addetti, dal 2011"), jyc = yearCols(jser[2]), jsl = rowOf(jser, LUGANO);
  const jobsSeries = [...jyc].filter(([y]) => y >= 2011 && y <= 2024).slice(0, 14).map(([y, i]) => ({ y, v: num(jsl[i])! }));
  if (jobsSeries[jobsSeries.length - 1].v !== ad) fail(`${F.jobs}: series 2024 differs from the 2024 sheet`);

  // ---- 3: cross-border workers (STAF, annual average, 2025 boundaries)
  const cr = sheet(F.cross, "Serie dal 2011"), cyc = yearCols(cr[1]), cl = rowOf(cr, LUGANO), ct = rowOf(cr, "Ticino");
  const crossYears = [...cyc.keys()].filter((y) => y >= 2011).sort();
  const crossLast = crossYears[crossYears.length - 1];
  const cross = (y: number, r = cl) => num(r[cyc.get(y)!]) ?? fail(`${F.cross}: ${y} missing`);

  // ---- 4: unemployment (City statistics report at 31.12.2025, table 20; Ticino and Switzerland from the City's
  // February 2026 analysis): literal phrases, checked by arithmetic for both years
  const cp = await pdfPages(F.city, [14, 15]);
  const t20 = findPage(cp, new RegExp(`\\(SECO\\) (\\d{4}) (\\d{4}) Variazione Disoccupati URC (${N}) (${N}) .{0,30}?Popolazione attiva (${N}) (${N}) .{0,30}?Tasso di disoccupazione (\\d+\\.\\d+) ?% (\\d+\\.\\d+) ?%`), F.city);
  const [yPrev, yNow, uPrev, unemp, aPrev, active] = t20.m.slice(1, 7).map(int);
  const [rPrev, rNow] = [Number(t20.m[7]), Number(t20.m[8])];
  for (const [u, a, r, y] of [[uPrev, aPrev, rPrev, yPrev], [unemp, active, rNow, yNow]])
    if (Math.abs((u / a) * 100 - r) > 0.01) fail(`${F.city}: ${u} / ${a} does not give ${r}% (${y})`);
  const t23 = findPage(cp, new RegExp(`Altri \\(con Noga non definiti\\).{0,40}?TOTALE (${N}) (${N}) \\+(\\d+)`), F.city);
  const [actPrev, actNow, actDiff] = t23.m.slice(1, 4).map(int);
  if (actNow - actPrev !== actDiff) fail(`${F.city}: economic activities ${actPrev} → ${actNow} is not +${actDiff}`);
  const uc = findPage(await pdfPages(F.unemp), /a fine (\d{4}), il tasso era del (\d+\.\d) ?% nel Canton Ticino e del (\d+\.\d) ?% in Svizzera/, F.unemp);
  if (Number(uc.m[1]) !== yNow) fail(`${F.unemp}: Ticino rate is for ${uc.m[1]}, not ${yNow}`);
  const [rTI, rCH] = [Number(uc.m[2]), Number(uc.m[3])];

  // ---- AIL SA, wholly owned by the City: dividends by financial year (integrated report 2025), checked against the
  // proposed appropriation of the 2025 profit
  const ap = await pdfPages(F.ail, [5, 9, 33]);
  const own = findPage(ap, /capitale interamente detenuto dalla Città di Lugano/, F.ail);
  const D = String.raw`(\d ?\d?\.\d)`;
  const dv = findPage(ap, new RegExp(String.raw`((?:\d ?){3}\d) ((?:\d ?){3}\d) ((?:\d ?){3}\d) mio di CHF Al personale.{0,200}?Agli azionisti \(dividendi\) ${D} ${D} ${D}`), F.ail);
  const dividends = [1, 2, 3].map((k) => ({ y: int(dv.m[k]), v: int(dv.m[k + 3]) }));
  const prop = findPage(ap, new RegExp(`Proposta di versamento di dividendo (${N})`), F.ail);
  const dLast = dividends[dividends.length - 1];
  if (int(prop.m[1]) / 1e6 !== dLast.v) fail(`${F.ail}: proposed dividend ${prop.m[1]} differs from ${dLast.v} million (${dLast.y})`);

  // ---- 5: hotel nights (HESTA), Lugano's boundaries are unchanged since 2013
  const nightsSeries: { y: number; v: number }[] = [];
  for (const name of ["2013-2015 Stato 135 Comuni", "2016 Stato 130 Comuni", "2017-2019 Stato 115 Comuni", "2020 Stato 111 Comuni", "2021 Stato 108 Comuni", "Dal 2022 Stato 106 Comuni", "Dal 2025 Stato 100 Comuni"]) {
    const rows = sheet(F.nights, name), yc = yearCols(rows[1]), l = rowOf(rows, LUGANO);
    for (const [y, i] of yc) nightsSeries.push({ y, v: num(l[i]) ?? fail(`${F.nights} ${name}: ${y}`) });
  }
  nightsSeries.sort((a, b) => a.y - b.y);
  const nl = nightsSeries[nightsSeries.length - 1];
  const hs = sheet(F.hotel, String(nl.y)), hl = rowOf(hs, LUGANO), ht = rowOf(hs, "Ticino");
  if (num(hl[6]) !== nl.v) fail(`${F.hotel}: nights ${num(hl[6])} differ from ${F.nights} ${nl.v}`);
  const [arrivals, beds, occ, occTI, nightsTI] = [num(hl[5])!, num(hl[3])!, num(hl[7])!, num(ht[7])!, num(ht[6])!];

  // ---- 6: vacancy rate = empty dwellings on 1 June ÷ dwellings at the end of the previous year (BFS definition)
  const em = sheet(F.empty, "Sere dal 2003"), eyc = yearCols(em[1]);
  const dw = sheet(F.dwell, "Serie dal 2010"), dyc = yearCols(dw[1]);
  const vYear = Math.max(...[...eyc.keys()].filter((y) => dyc.has(y - 1)));
  const emB = byBfs(em), dwB = byBfs(dw);
  const pop25 = byBfs(sheet(AGE_FILE, "2025"));
  const head25 = sheet(AGE_FILE, "2025").find((r) => r.includes("Totale")) ?? fail("2025 age header missing");
  const iTot25 = head25.indexOf("Totale");
  const vacCmp = compare([...emB].map(([bfs, x]) => {
    const d = dwB.get(bfs) ?? fail(`${F.dwell}: ${bfs} ${x.name} missing`);
    const p = pop25.get(bfs) ?? fail(`2025 population: ${bfs} ${x.name} missing`);
    return { bfs, name: x.name, value: ((num(x.r[eyc.get(vYear)!]) ?? 0) / (num(d.r[dyc.get(vYear - 1)!]) ?? fail("dwellings empty"))) * 100, population: num(p.r[iTot25]) ?? 0 };
  }), "%", "highest-first");
  const eL = emB.get(5192)!.r, dL = dwB.get(5192)!.r;
  const vacSeries = [...eyc.keys()].filter((y) => y >= 2014 && dyc.has(y - 1)).sort().map((y) => ({ y, v: ((num(eL[eyc.get(y)!]) ?? 0) / num(dL[dyc.get(y - 1)!])!) * 100, e: num(eL[eyc.get(y)!]) ?? 0 }));
  const emptyNow = num(eL[eyc.get(vYear)!])!, dwellPrev = num(dL[dyc.get(vYear - 1)!])!;
  const peak = vacSeries.reduce((a, b) => (b.e > a.e ? b : a));

  // ---- 7: property transactions (count and value), from 2013
  const tr = sheet(F.sales, "Serie dal 2010"), tyc = yearCols(tr[1]), tl = rowOf(tr, LUGANO);
  const provisional = (y: number) => /p$/.test(String(tr[1][tyc.get(y)!]));
  const salesSeries = [...tyc.keys()].filter((y) => y >= 2013).sort().map((y) => ({ y, c: num(tl[tyc.get(y)!])!, v: num(tl[tyc.get(y)! + 1])! / 1000, p: provisional(y) }));
  const sFinal = [...salesSeries].reverse().find((s) => !s.p)!, sProv = salesSeries.find((s) => s.p);

  // ---- 8: revenue from public companies (446) and concessions (412), every municipality (canton annex 2024)
  const match = matcher(register), t9d = sheet(ALLEGATO, "tab9d");
  const i446 = t9d[1].findIndex((h) => /^446\b/.test(String(h ?? ""))), i412 = t9d[1].findIndex((h) => /^412\b/.test(String(h ?? "")));
  if (i446 < 0 || i412 < 0) fail("tab9d: 446/412 not found");
  const isRow = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d)/i.test(norm(r[0])) && r.slice(1).some((c) => num(c) !== null);
  const pub = new Map<number, { c446: number; c412: number }>();
  for (const r of t9d.slice(2)) if (isRow(r)) pub.set(match(r[0], "tab9d").bfs, { c446: num(r[i446]) ?? 0, c412: num(r[i412]) ?? 0 });
  if (pub.size !== 106) fail(`tab9d: ${pub.size} municipalities`);
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;
  const lp = pub.get(5192)!;
  const noPub = [...pub.values()].filter((v) => v.c446 <= 0).length;

  // ---- function 8 lines (appendice): spending (TabD) and revenue (TabE)
  const line = (tab: string, code: string) => { const rows = sheet(APPENDICE, tab), i = rows[1].findIndex((h) => String(h ?? "").trim() === code);
    return i < 0 ? 0 : (num(rowOf(rows, "Lugano")[i]) ?? 0) / 1000; };

  const usc = (file: string, what: string) => src(file, what);
  const stars: Star[] = [
    { id: "economia.addetti", constellation: "economia", label: { it: "Posti di lavoro", en: "Jobs" },
      about: { it: `A Lugano lavorano ${n(ad)} persone (2024), ${n(etp)} a tempo pieno equivalente: ${n((ad / adTI) * 100, 1)}% degli addetti del Ticino. Sono ${n(jobsCmp.lugano.value, 0)} posti di lavoro ogni 100 abitanti: molti vengono da altri comuni o da oltre confine. I posti si contano dove si lavora, non dove si abita.`,
        en: `${n(ad)} people work in Lugano (2024), ${n(etp)} full-time equivalent: ${n((ad / adTI) * 100, 1)}% of Ticino's jobs. That is ${n(jobsCmp.lugano.value, 0)} jobs per 100 residents: many workers come from other municipalities or across the border. Jobs are counted where people work, not where they live.` },
      value: jobsCmp.lugano.value, unit: "per 100 abitanti", year: 2024, area: "Lugano", kind: "derived",
      method: { it: "Addetti (STATENT 2024) divisi per la popolazione residente al 31.12.2024, per 100.", en: "Employees (STATENT 2024) divided by the resident population at 31.12.2024, per 100." },
      source: [usc(F.jobs, "sheet 2024, rows with a BFS number, column Addetti Totale"), src(AGE_FILE, "sheet 2024, column Totale")],
      context: [{ label: { it: "Addetti", en: "Employees" }, value: ad, unit: "addetti" }, { label: { it: "Equivalenti a tempo pieno", en: "Full-time equivalents" }, value: etp, unit: "addetti" },
        { label: { it: `Addetti nel ${jobsSeries[0].y}`, en: `Employees in ${jobsSeries[0].y}` }, value: jobsSeries[0].v, unit: "addetti" }],
      comparison: jobsCmp, related: ["economia.spesa", "economia.frontalieri"],
      detail: [
        { title: { it: "Addetti a Lugano, per anno", en: "Employees in Lugano, by year" },
          chart: { type: "columns", unit: "addetti", color: EC, series: [{ label: { it: "Addetti", en: "Employees" }, data: jobsSeries.map((p) => ({ key: `a${p.y}`, label: { it: String(p.y), en: String(p.y) }, value: p.v })) }] },
          source: [usc(F.jobs, "sheet 'Addetti, dal 2011', row '5192 Lugano', columns Totale 2011–2024")] },
        { title: { it: "Addetti per settore, 2024", en: "Employees by sector, 2024" },
          chart: { type: "hbars", unit: "addetti", color: EC, caption: { it: "addetti · 2024", en: "employees · 2024" },
            data: [{ key: "t", label: { it: "Terziario (servizi)", en: "Services" }, value: adT }, { key: "s", label: { it: "Secondario (industria, costruzioni)", en: "Industry and construction" }, value: adS },
              { key: "p", label: { it: "Primario (agricoltura)", en: "Farming and forestry" }, value: adP }] },
          source: [usc(F.jobs, "sheet 2024, row '5192 Lugano', columns Addetti by sector")] }] },
    { id: "economia.aziende", constellation: "economia", label: { it: "Aziende", en: "Workplaces" },
      about: { it: `Aziende (unità locali) con sede a Lugano nel 2024: ${n((az / azTI) * 100, 1)}% di quelle del Ticino. ${n((azT / az) * 100, 0)}% sono nei servizi. La Città conta ${n(actPrev)} «attività economiche» nel suo registro a fine 2024 e ${n(actNow)} a fine ${yNow}: è un'altra definizione.`,
        en: `Workplaces (local units) in Lugano in 2024: ${n((az / azTI) * 100, 1)}% of Ticino's. ${n((azT / az) * 100, 0)}% are in services. The City counts ${n(actPrev)} "economic activities" in its own register at the end of 2024 and ${n(actNow)} at the end of ${yNow}: a different definition.` },
      value: az, unit: "aziende", year: 2024, area: "Lugano", kind: "official",
      source: [usc(F.jobs, "sheet 2024, row '5192 Lugano', columns Aziende"), usc(F.city, `p. ${t23.p}, table 23, row TOTALE (City register)`)],
      context: [{ label: { it: "Ticino", en: "Ticino" }, value: azTI, unit: "aziende" }],
      related: ["economia.addetti"],
      detail: [{ title: { it: "Aziende per settore, 2024", en: "Workplaces by sector, 2024" },
        chart: { type: "hbars", unit: "aziende", color: EC, caption: { it: "aziende · 2024", en: "workplaces · 2024" },
          data: [{ key: "t", label: { it: "Terziario (servizi)", en: "Services" }, value: azT }, { key: "s", label: { it: "Secondario (industria, costruzioni)", en: "Industry and construction" }, value: azS },
            { key: "p", label: { it: "Primario (agricoltura)", en: "Farming and forestry" }, value: azP }] },
        source: [usc(F.jobs, "sheet 2024, row '5192 Lugano', columns Aziende by sector")] }] },
    { id: "economia.frontalieri", constellation: "economia", label: { it: "Frontalieri", en: "Cross-border workers" },
      about: { it: `Frontalieri stranieri che lavorano a Lugano (media annua ${crossLast}): ${n((cross(crossLast) / cross(crossLast, ct)) * 100, 1)}% di quelli del Ticino. Nel ${crossYears[0]} erano ${n(cross(crossYears[0]), 0)}. È un'altra statistica rispetto ai posti di lavoro: le due cifre non vanno sommate né divise.`,
        en: `Foreign cross-border workers working in Lugano (annual average ${crossLast}): ${n((cross(crossLast) / cross(crossLast, ct)) * 100, 1)}% of Ticino's. In ${crossYears[0]} there were ${n(cross(crossYears[0]), 0)}. It is a different statistic from jobs: the two figures should not be added or divided.` },
      value: cross(crossLast), unit: "frontalieri", year: crossLast, area: "Lugano", kind: "official",
      source: [usc(F.cross, `sheet 'Serie dal 2011', rows '5192 Lugano' and 'Ticino', ${crossYears[0]}–${crossLast}`)],
      context: [{ label: { it: "Ticino", en: "Ticino" }, value: cross(crossLast, ct), unit: "frontalieri" }],
      related: ["economia.addetti"],
      detail: [{ title: { it: "Frontalieri che lavorano a Lugano, media annua", en: "Cross-border workers working in Lugano, annual average" },
        chart: { type: "columns", unit: "frontalieri", color: EC, series: [{ label: { it: "Frontalieri", en: "Cross-border workers" },
          data: crossYears.map((y) => ({ key: `a${y}`, label: { it: String(y), en: String(y) }, value: cross(y) })) }] },
        source: [usc(F.cross, "sheet 'Serie dal 2011', row '5192 Lugano'")] }] },
    { id: "economia.disoccupazione", constellation: "economia", label: { it: "Disoccupazione", en: "Unemployment" },
      about: { it: `Tasso di disoccupazione a Lugano nel ${yNow} secondo la SECO: ${n(unemp)} disoccupati iscritti agli Uffici regionali di collocamento su ${n(active)} persone attive, al 31 dicembre. Nel ${yPrev} era ${n(rPrev, 2)}% (${n(uPrev)} disoccupati). A fine ${yNow} in Ticino era ${n(rTI, 1)}%, in Svizzera ${n(rCH, 1)}%.`,
        en: `Unemployment rate in Lugano in ${yNow} by the SECO definition: ${n(unemp)} people registered as unemployed out of ${n(active)} in the labour force, at 31 December. In ${yPrev} it was ${n(rPrev, 2)}% (${n(uPrev)} unemployed). At the end of ${yNow}, Ticino: ${n(rTI, 1)}%, Switzerland: ${n(rCH, 1)}%.` },
      value: rNow, unit: "%", digits: 2, year: yNow, area: "Lugano", kind: "official",
      method: { it: "Cifre del rapporto statistico della Città (fonte SECO); controllo per entrambi gli anni: disoccupati ÷ popolazione attiva = tasso.", en: "Figures from the City's statistics report (source SECO); check for both years: unemployed ÷ labour force = rate." },
      source: [usc(F.city, `p. ${t20.p}, table 20: Disoccupati URC, Popolazione attiva, Tasso di disoccupazione, ${yPrev} and ${yNow}`), usc(F.unemp, `p. ${uc.p}: "a fine ${yNow}, il tasso era del ${uc.m[2]}% nel Canton Ticino e del ${uc.m[3]}% in Svizzera"`)],
      context: [{ label: { it: "Disoccupati iscritti", en: "Registered unemployed" }, value: unemp, unit: "persone" }, { label: { it: "Ticino", en: "Ticino" }, value: rTI, unit: "%" }, { label: { it: "Svizzera", en: "Switzerland" }, value: rCH, unit: "%" }],
      related: ["economia.addetti"],
      detail: [{ title: { it: `Tasso di disoccupazione, ${yNow}`, en: `Unemployment rate, ${yNow}` },
        chart: { type: "hbars", unit: "%", digits: 2, color: EC, caption: { it: `% · ${yNow} · definizione SECO`, en: `% · ${yNow} · SECO definition` },
          data: [{ key: "lug", label: { it: `Lugano ${yNow}`, en: `Lugano ${yNow}` }, value: rNow }, { key: "prev", label: { it: `Lugano ${yPrev}`, en: `Lugano ${yPrev}` }, value: rPrev },
            { key: "ti", label: { it: "Ticino", en: "Ticino" }, value: rTI }, { key: "ch", label: { it: "Svizzera", en: "Switzerland" }, value: rCH }] },
        source: [usc(F.city, `p. ${t20.p}, table 20`), usc(F.unemp, `p. ${uc.p}`)] }] },
    { id: "economia.pernottamenti", constellation: "economia", label: { it: "Pernottamenti", en: "Hotel nights" },
      about: { it: `Pernottamenti negli alberghi di Lugano nel ${nl.y}: ${n((nl.v / nightsTI) * 100, 1)}% di quelli del Ticino, con ${n(arrivals)} arrivi. I letti erano occupati al ${n(occ, 1)}% (Ticino ${n(occTI, 1)}%).`,
        en: `Nights spent in Lugano's hotels in ${nl.y}: ${n((nl.v / nightsTI) * 100, 1)}% of Ticino's, with ${n(arrivals)} arrivals. Bed occupancy was ${n(occ, 1)}% (Ticino ${n(occTI, 1)}%).` },
      value: nl.v, unit: "pernottamenti", year: nl.y, area: "Lugano", kind: "official",
      source: [usc(F.nights, "sheets 2013–2025, row '5192 Lugano'"), usc(F.hotel, `sheet ${nl.y}, rows '5192 Lugano' and 'Ticino': arrivals, beds, net bed occupancy`)],
      context: [{ label: { it: "Arrivi", en: "Arrivals" }, value: arrivals, unit: "arrivi" }, { label: { it: "Letti (media)", en: "Beds (average)" }, value: beds, unit: "letti" },
        { label: { it: "Occupazione dei letti", en: "Bed occupancy" }, value: occ, unit: "%" }],
      related: ["economia.spesa"],
      detail: [{ title: { it: "Pernottamenti alberghieri a Lugano, per anno", en: "Hotel nights in Lugano, by year" },
        chart: { type: "columns", unit: "pernottamenti", color: EC, series: [{ label: { it: "Pernottamenti", en: "Nights" }, data: nightsSeries.map((p) => ({ key: `a${p.y}`, label: { it: String(p.y), en: String(p.y) }, value: p.v })) }] },
        note: { it: "Dal 2013, anno dell'ultima aggregazione di Lugano. Il 2020 è l'anno della pandemia.", en: "From 2013, the year of Lugano's last merger. 2020 is the pandemic year." },
        source: [usc(F.nights, "sheets '2013-2015' … 'Dal 2025', row '5192 Lugano'")] }] },
    { id: "economia.sfitto", constellation: "economia", label: { it: "Abitazioni sfitte", en: "Vacant dwellings" },
      about: { it: `Abitazioni vuote a Lugano al 1° giugno ${vYear}: ${n(emptyNow)} su ${n(dwellPrev)}. Il massimo recente è stato nel ${peak.y} con ${n(peak.e)} abitazioni vuote.`,
        en: `Empty dwellings in Lugano on 1 June ${vYear}: ${n(emptyNow)} of ${n(dwellPrev)}. The recent peak was ${peak.y}, with ${n(peak.e)} empty dwellings.` },
      value: vacCmp.lugano.value, unit: "%", digits: 2, year: vYear, area: "Lugano", kind: "derived",
      method: { it: `Abitazioni vuote al 1° giugno ${vYear} divise per le abitazioni a fine ${vYear - 1} (definizione dell'UST). Confronto sui ${vacCmp.lugano.of} comuni nei confini del 2025.`,
        en: `Empty dwellings on 1 June ${vYear} divided by dwellings at the end of ${vYear - 1} (BFS definition). Compared across the ${vacCmp.lugano.of} municipalities in their 2025 boundaries.` },
      source: [usc(F.empty, `sheet 'Sere dal 2003', column ${vYear}`), usc(F.dwell, `sheet 'Serie dal 2010', column ${vYear - 1}`), src(AGE_FILE, "sheet 2025, column Totale (bubble size)")],
      context: [{ label: { it: "Abitazioni vuote", en: "Empty dwellings" }, value: emptyNow, unit: "abitazioni" }],
      comparison: vacCmp, related: ["economia.transazioni"],
      detail: [{ title: { it: "Tasso di abitazioni vuote a Lugano, al 1° giugno", en: "Vacancy rate in Lugano, on 1 June" },
        chart: { type: "columns", unit: "%", digits: 2, color: EC, series: [{ label: { it: "Abitazioni vuote ÷ abitazioni", en: "Empty ÷ all dwellings" },
          data: vacSeries.map((p) => ({ key: `a${p.y}`, label: { it: String(p.y), en: String(p.y) }, value: p.v, note: { it: `${n(p.e)} vuote`, en: `${n(p.e)} empty` } })) }] },
        source: [usc(F.empty, "sheet 'Sere dal 2003', row '5192 Lugano'"), usc(F.dwell, "sheet 'Serie dal 2010', row '5192 Lugano'")] }] },
    { id: "economia.transazioni", constellation: "economia", label: { it: "Compravendite immobiliari", en: "Property sales" },
      about: { it: `Compravendite di immobili a Lugano nel ${sFinal.y}, per un valore di ${n(sFinal.v, 1)} milioni di franchi.${sProv ? ` Nel ${sProv.y} (dato provvisorio) sono ${n(sProv.c)}, per ${n(sProv.v, 1)} milioni.` : ""}`,
        en: `Property sales in Lugano in ${sFinal.y}, worth CHF ${n(sFinal.v, 1)} million.${sProv ? ` In ${sProv.y} (provisional) there were ${n(sProv.c)}, worth CHF ${n(sProv.v, 1)} million.` : ""}` },
      value: sFinal.c, unit: "compravendite", year: sFinal.y, area: "Lugano", kind: "official",
      source: [usc(F.sales, "sheet 'Serie dal 2010', row '5192 Lugano', columns No. and Valore (CHF thousands)")],
      context: [{ label: { it: "Valore", en: "Value" }, value: sFinal.v, unit: "mio CHF" }],
      related: ["economia.sfitto"],
      detail: [
        { title: { it: "Compravendite per anno", en: "Sales by year" },
          chart: { type: "columns", unit: "compravendite", color: EC, series: [{ label: { it: "Compravendite", en: "Sales" },
            data: salesSeries.map((p) => ({ key: `a${p.y}`, label: { it: p.p ? `${p.y}p` : String(p.y), en: p.p ? `${p.y}p` : String(p.y) }, value: p.c, status: p.p ? "estimate" as const : undefined })) }] },
          note: { it: "p = dato provvisorio. Dal 2013, anno dell'ultima aggregazione di Lugano.", en: "p = provisional. From 2013, the year of Lugano's last merger." },
          source: [usc(F.sales, "sheet 'Serie dal 2010', row '5192 Lugano', columns No.")] },
        { title: { it: "Valore delle compravendite per anno", en: "Value of sales by year" },
          chart: { type: "columns", unit: "mio CHF", color: EC, series: [{ label: { it: "Valore", en: "Value" },
            data: salesSeries.map((p) => ({ key: `a${p.y}`, label: { it: p.p ? `${p.y}p` : String(p.y), en: p.p ? `${p.y}p` : String(p.y) }, value: p.v, status: p.p ? "estimate" as const : undefined })) }] },
          source: [usc(F.sales, "sheet 'Serie dal 2010', row '5192 Lugano', columns Valore")] }] },
    { id: "economia.imprese-pubbliche", constellation: "economia", label: { it: "Ricavi dalle imprese pubbliche", en: "Revenue from public companies" },
      about: { it: `Ricavi della Città dalle imprese di cui il settore pubblico ha più della metà del capitale (conto 446): ${n(lp.c446 / 1000, 2)} milioni nel 2024. In più, le concessioni (conto 412) portano ${n(lp.c412 / 1000, 2)} milioni. I conti non indicano le singole imprese. La Città possiede tutto il capitale di AIL SA (Aziende Industriali di Lugano), che sull'utile ${dLast.y} versa ${n(dLast.v, 0)} milioni di dividendo.`,
        en: `The City's revenue from companies more than half publicly owned (account 446): CHF ${n(lp.c446 / 1000, 2)} million in 2024. Concessions (account 412) add CHF ${n(lp.c412 / 1000, 2)} million. The accounts do not name the companies. The City owns all of AIL SA (Lugano's energy and water utility), which pays a dividend of CHF ${n(dLast.v, 0)} million on its ${dLast.y} profit.` },
      value: lp.c446 / 1000, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: `Conto 446 «ricavi da imprese pubbliche» del conto economico 2024 della Città, come pubblicato dalla Sezione degli enti locali. È ciò che la Città incassa dalle imprese che possiede, non dagli abitanti: per questo la cifra non è divisa per la popolazione. Non è confrontata con gli altri comuni, perché dipende da quali imprese ciascun comune possiede: ${n(noPub)} dei ${n(pub.size)} comuni ticinesi non registrano ricavi su questo conto.`,
        en: `Account 446 'revenue from public companies' in the City's 2024 accounts, as published by the cantonal Local Authorities Section. It is what the City collects from the companies it owns, not from residents, so the figure is not divided by the population. It is not compared with other municipalities, because it depends on which companies each municipality owns: ${n(noPub)} of Ticino's ${n(pub.size)} municipalities record no revenue in this account.` },
      source: [src(ALLEGATO, "sheet tab9d, columns 446 and 412, row 'Lugano' (CHF thousands)")],
      context: [{ label: { it: "Concessioni 412", en: "Concessions (412)" }, value: lp.c412 / 1000, unit: "mio CHF" },
        { label: { it: `Dividendo AIL (utile ${dLast.y})`, en: `AIL dividend (${dLast.y} profit)` }, value: dLast.v, unit: "mio CHF" },
        { label: { it: "Comuni ticinesi con ricavi 446", en: "Ticino municipalities with revenue in 446" }, value: pub.size - noPub, unit: "comuni" }],
      related: ["economia.spesa", "finanze.imposte-pg"],
      detail: [{ title: { it: "Dividendi di AIL SA alla Città, per esercizio", en: "AIL SA dividends to the City, by financial year" },
        chart: { type: "columns", unit: "mio CHF", digits: 1, color: EC, series: [{ label: { it: "Dividendo", en: "Dividend" },
          data: dividends.map((d) => ({ key: `a${d.y}`, label: { it: String(d.y), en: String(d.y) }, value: d.v })) }] },
        note: { it: `AIL SA è interamente della Città. Il dividendo sull'utile di un anno è deciso dall'assemblea nel giugno seguente (quello sul ${dLast.y}: ${n(int(prop.m[1]))} franchi). Il conto 446 comprende anche altre imprese; il rapporto non dice in quale anno dei conti della Città entra ogni dividendo, quindi le due cifre non vanno sottratte.`,
          en: `AIL SA is wholly owned by the City. The dividend on a year's profit is decided by the general meeting the following June (on ${dLast.y}: CHF ${n(int(prop.m[1]))}). Account 446 also covers other companies, and the report does not say in which year of the City's accounts each dividend arrives, so the two figures should not be subtracted.` },
        source: [usc(F.ail, `p. ${dv.p}: 'Distribuzione di valore economico', row 'Agli azionisti (dividendi)', ${dividends[0].y}–${dLast.y}`), usc(F.ail, `p. ${prop.p}: 'Proposta di versamento di dividendo'`), usc(F.ail, `p. ${own.p}: 'capitale interamente detenuto dalla Città di Lugano'`)] }] },
  ];
  const fn8 = {
    title: { it: "Economia pubblica nei conti della Città, 2024: spese e ricavi per voce", en: "Public economy in the City's accounts, 2024: spending and revenue by line" } as Text,
    chart: { type: "columns" as const, unit: "mio CHF", digits: 2, color: "#737a92", series: [
      { label: { it: "Spese", en: "Spending" }, data: [["840", "Turismo", "Tourism"], ["850", "Industria, artigianato e commercio", "Industry, crafts and commerce"], ["871", "Elettricità", "Electricity"]].map(([c, it, en]) => ({ key: `a${c}`, label: { it, en }, value: line("TabD", c) })) },
      { label: { it: "Ricavi", en: "Revenue" }, data: [["840", "Turismo", "Tourism"], ["850", "Industria, artigianato e commercio", "Industry, crafts and commerce"], ["871", "Elettricità", "Electricity"]].map(([c, it, en]) => ({ key: `b${c}`, label: { it, en }, value: line("TabE", c) })) }] },
    source: [src(APPENDICE, "sheets TabD (spending) and TabE (revenue), columns 840, 850, 871, row 'Lugano' (CHF thousands)")],
  };
  return { stars, fn8 };
}

export const ECONOMIA_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.jobs]: { url: `${USTAT}T_030203_040.xlsx`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – aziende e addetti (STATENT)" },
  [F.cross]: { url: `${USTAT}T_030204_040.xlsx`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – frontalieri (STAF)" },
  [F.empty]: { url: `${USTAT}T_090203_020.xls`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – abitazioni vuote" },
  [F.dwell]: { url: `${USTAT}T_090203_030.xls`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – abitazioni" },
  [F.sales]: { url: `${USTAT}T_090502_010.xlsx`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – transazioni immobiliari" },
  [F.hotel]: { url: `${USTAT}T_100301_010.xls`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – offerta e domanda alberghiera (HESTA)" },
  [F.nights]: { url: `${USTAT}T_100301_040.xls`, publisher: "Ufficio di statistica del Cantone Ticino (USTAT) – pernottamenti alberghieri (HESTA)" },
  [F.city]: { url: "https://www.lugano.ch/dam/jcr:5370eb7f-b2f8-4dca-98d3-db45e9c7b6cc/20260129-dati-statistici-citta-lugano-2025-rapporto.pdf", publisher: "Città di Lugano, Dati statistici al 31 dicembre 2025 (29 gennaio 2026)" },
  [F.unemp]: { url: "https://www.lugano.ch/dam/jcr:2eed6771-7f80-45bd-a130-3df0ff0838eb/20260213-analisi-disoccupazione-lugano-2025-comunicato.pdf", publisher: "Città di Lugano, comunicato: la disoccupazione a Lugano nel 2025 (13 febbraio 2026)" },
  [F.ail]: { url: "https://de.ail.ch/dam/jcr:ef45a429-fe78-4b5d-b9b2-08f904b4afb4/Rapporto%20integrato%202025.pdf", publisher: "AIL SA, Rapporto annuale integrato 2025" },
};
