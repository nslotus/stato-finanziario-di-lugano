// Builds the data of the public page "Cielo del preventivo, Lugano" (docs/) from the catalogue (catalog/*.json), which
// npm run build makes from the archived sources. Every number on the page comes from here; none is typed by hand.
// Each step checks its sums and stops on the first failure.
//   npm run site   -> docs/data/data.js and docs/data/data-more.js (see sitedata.ts)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { CENTRE, DEPT, GROUP } from "./personale-names";
import { readPdf } from "./adapters/pdf";
import { splitSite } from "./sitedata";

const cat = JSON.parse(readFileSync("catalog/stars.json", "utf8"));
const star = (id: string) => cat.stars.find((s: any) => s.id === id) ?? (() => { throw new Error(`star ${id} missing`); })();
const ch = (id: string) => cat.chapters.find((c: any) => c.id === id) ?? (() => { throw new Error(`chapter ${id} missing`); })();

// short names a child reads on a building or a jar; the full accounts label stays in the card
const NAMES: Record<string, [string, string]> = {
  f0: ["Amministrazione", "Administration"], f1: ["Sicurezza", "Safety"], f2: ["Scuole", "Schools"], f3: ["Cultura e sport", "Culture and sport"],
  f4: ["Salute", "Health"], f5: ["Socialità", "Social help"], f6: ["Trasporti", "Transport"], f7: ["Ambiente", "Environment"],
  f8: ["Economia", "Economy"], f9: ["Finanze", "Finance"],
};
const FACTS: Record<string, string[]> = {
  f1: ["sicurezza.reati", "sicurezza.incidenti"], f2: ["istruzione.allievi", "istruzione.classe-elementare"], f3: ["cultura.lac", "cultura.musei"],
  f4: ["salute.case-cura", "salute.letti-cpa"], f5: ["sociale.casi", "sociale.nidi"], f6: ["trasporti.tpl", "trasporti.ffs"],
  f7: ["ambiente.rifiuti", "ambiente.energia"], f8: ["economia.addetti", "economia.pernottamenti"], f9: ["finanze.interessi", "finanze.debito-lordo"],
};
const HUE: Record<string, string> = {
  f0: "#e9edff", f1: "#4cf8e7", f2: "#9085e9", f3: "#3b5bf0", f4: "#0e97ab", f5: "#e5e75b", f6: "#d55181", f7: "#abca84", f8: "#b0b5c4", f9: "#5aab3c",
};
const F9: Record<string, [string, string]> = {
  "910": ["Riscossione delle imposte", "Tax collection"], "930": ["Perequazione con gli altri comuni", "Equalisation with other municipalities"],
  "950": ["Quote di entrate del Cantone", "Shares of cantonal revenue"], "961": ["Interessi sui debiti", "Interest on debt"], "962": ["Costi dei prestiti", "Borrowing costs"],
  "963": ["Immobili da reddito", "Investment property"], "969": ["Altri beni", "Other assets"], "990": ["Voci non ripartite", "Unallocated items"],
};

const sun = star("bilancio.spesa");
const pop = sun.comparison.values.find((v: any) => v.bfs === 5192).population;
const fn = ch("uscite").chart.data.map((d: any) => {
  const anchor = d.star ? star(d.star) : null;
  const facts = (FACTS[d.key] ?? []).map((id) => { const s = star(id); return { id, label: s.label, value: s.value, unit: s.unit, digits: s.digits, year: s.year }; });
  return { key: d.key, code: d.key.slice(1), name: { it: NAMES[d.key][0], en: NAMES[d.key][1] }, account: d.label, value: d.value, hue: HUE[d.key],
    perRes: (d.value * 1e6) / pop, rank: anchor?.comparison ? { rank: anchor.comparison.lugano.rank, of: anchor.comparison.lugano.of } : null,
    unranked: anchor && !anchor.comparison ? true : false, star: d.star ?? null, facts };
});

// function 9 by line (canton annex, appendice TabD, row 'Lugano', CHF thousands)
const wb = XLSX.read(readFileSync("sources/sel-2024-appendice.xlsx"));
const tabD = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets["TabD"], { header: 1, defval: null });
const head = tabD[1].map((x) => String(x ?? "").trim()), lug = tabD.find((r) => r[0] === "Lugano") ?? (() => { throw new Error("TabD: Lugano missing"); })();
const f9lines = Object.keys(F9).map((code) => ({ code, label: { it: F9[code][0], en: F9[code][1] }, value: Number(lug[head.indexOf(code)] ?? 0) / 1000 })).filter((l) => l.value > 0.05)
  .sort((a, b) => b.value - a.value);
const f9 = fn.find((f: any) => f.key === "f9");
if (Math.abs(f9lines.reduce((s, l) => s + l.value, 0) - f9.value) > 0.1) throw new Error(`function 9 lines add up to ${f9lines.reduce((s, l) => s + l.value, 0)}, not ${f9.value}`);
f9.lines = f9lines;

const rev = ch("entrate").chart.data.map((d: any) => ({ key: d.key, label: d.label, value: d.value }));
const total = ch("bilancio").chart.value;
if (Math.abs(fn.reduce((s: number, f: any) => s + f.value, 0) - total) > 0.05) throw new Error("functions do not add up to the total");
const pf = star("finanze.imposte-pf").value, pg = star("finanze.imposte-pg").value;

const data = JSON.stringify({ year: 2024, total, pop, perRes: sun.value, sunRank: { rank: sun.comparison.lugano.rank, of: sun.comparison.lugano.of }, fn, rev, revTotal: rev.reduce((s: number, r: any) => s + r.value, 0), pf, pg,
  source: { it: "Conti 2024 della Città, come pubblicati dalla Sezione degli enti locali del Cantone (allegato e appendice statistica); cifre e fonti di ogni voce nei dati della pagina.", en: "The City's 2024 accounts, as published by the cantonal Local Authorities Section (statistical annex and appendix); figures and sources of every figure in the page's data." } })
  .replace(/<\//g, "<\\/");


// ---- sectors (functions) with their figures, the full figure records and the source manifest
// revenue planets: accounts 40–46 from the revenue chapter, plus the rest of the canton's revenue total (TabB) so both sides meet at the result
const REV_NAMES: Record<string, [string, string]> = {
  r40: ["Imposte", "Taxes"], r41: ["Regalie e concessioni", "Royalties and concessions"], r42: ["Tasse e tariffe", "Fees and charges"], r43: ["Ricavi diversi", "Other revenue"],
  r44: ["Ricavi finanziari", "Financial revenue"], r45: ["Prelievi da fondi", "Drawings from funds"], r46: ["Trasferimenti ricevuti", "Transfers received"], r4x: ["Altri ricavi", "Remaining revenue"],
};
const REV_HUE: Record<string, string> = { r40: "#f2b84b", r41: "#c9875a", r42: "#e3a08c", r43: "#b8a46a", r44: "#e8d9b0", r45: "#a8865a", r46: "#f0c98a", r4x: "#8f8a7a" };
const tabB = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets["TabB"], { header: 1, defval: null });
const lugB = tabB.find((r) => r[0] === "Lugano") ?? (() => { throw new Error("TabB: Lugano missing"); })();
const revAll = lugB.slice(1).reduce((t: number, v) => t + (Number(v) || 0), 0) / 1000;
const result2024 = ch("risultato").chart.series[0].data.find((d: any) => d.key === "a2024").value;
if (Math.abs(revAll - total - result2024) > 0.01) throw new Error(`revenue ${revAll} minus spending ${total} is not the 2024 result ${result2024}`);
const revRest = revAll - rev.reduce((t: number, r: any) => t + r.value, 0);
if (revRest < 0) throw new Error("accounts 40–46 exceed total revenue");
const revPlanets = [...rev, { key: "r4x", label: { it: "altri ricavi (differenza dal totale)", en: "remaining revenue (difference from the total)" }, value: revRest }]
  .map((r: any) => ({ key: r.key, code: r.key === "r4x" ? "47–49" : r.key.slice(1), name: { it: REV_NAMES[r.key][0], en: REV_NAMES[r.key][1] }, account: r.label, value: r.value, hue: REV_HUE[r.key] }));
const MOON_FN: Record<string, string> = { "finanze.imposte-pf": "r40", "finanze.imposte-pg": "r40", "finanze.pg-cantone": "r40", "finanze.ifd-quota": "r40", "finanze.contribuente": "r40", "economia.imprese-pubbliche": "r44" };
const CONST_FN: Record<string, string> = { sicurezza: "f1", istruzione: "f2", cultura: "f3", salute: "f4", sociale: "f5", trasporti: "f6", ambiente: "f7", economia: "f8", finanze: "f9" };
const moons = cat.stars.filter((s: any) => CONST_FN[s.constellation] && !s.id.endsWith(".spesa")).map((s: any) => ({
  id: s.id, fn: MOON_FN[s.id] ?? CONST_FN[s.constellation], label: s.label, about: s.about, value: s.value, unit: s.unit, digits: s.digits, year: s.year, kind: s.kind,
  method: s.method ?? null, context: s.context ?? [], operator: s.operator ?? null, source: s.source,
  rank: s.comparison ? { rank: s.comparison.lugano.rank, of: s.comparison.lugano.of, median: s.comparison.median } : null }));
const anchors = Object.fromEntries(fn.filter((f: any) => f.star).map((f: any) => { const s = star(f.star); return [f.key, { about: s.about, method: s.method ?? null, source: s.source }]; }));
const manifest = JSON.parse(readFileSync("sources/MANIFEST.json", "utf8")).map((m: any) => ({ file: m.file, url: m.url, publisher: m.publisher }));
// ---- staff (2025 actual, from the tables of the 2027 budget message): one planet per department, sized by gross
// salaries; the moons are its services, each listing its cost centres; the rest of account 30 is one more planet
const PERS = JSON.parse(readFileSync("catalog/personale.json", "utf8"));
const norm = (x: string) => x.toLowerCase().replace(/[^a-zà-ù]/g, "");
const STAFF_HUE = ["#e9edff", "#5aab3c", "#b0b5c4", "#4cf8e7", "#9085e9", "#3b5bf0", "#abca84"];
const mio = (v: number) => v / 1e6;
const f2 = (v: number) => v.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const persSrc = [...PERS.perm.source, ...PERS.temp.source];
const staffPlanets: any[] = [], staffMoons: any[] = [], staffAnchors: Record<string, any> = {};
let permU = 0, permS = 0, tempU = 0, tempS = 0;
PERS.perm.depts.forEach((d: any, i: number) => {
  const key = `p${i + 1}`, names = DEPT[d.name] ?? (() => { throw new Error(`staff: no name for department ${d.name}`); })();
  const td = PERS.temp.depts.find((x: any) => norm(x.name) === norm(d.name));
  // permanent centres, then non-permanent ones merged by code (or into the service of the same name)
  const groups = d.groups.map((g: any) => ({ name: g.name, centres: g.centres.map((c: any) => ({ code: c.code, u: c.u25 ?? 0, s: c.s25 ?? 0, tu: 0, ts: 0, s27: c.s27 ?? 0 })) }));
  for (const tg of td?.groups ?? []) for (const c of tg.centres) {
    let host = groups.flatMap((g: any) => g.centres).find((x: any) => x.code === c.code);
    if (!host) {
      let g = groups.find((q: any) => norm(q.name) === norm(tg.name));
      if (!g) { g = { name: tg.name, centres: [] }; groups.push(g); }
      host = { code: c.code, u: 0, s: 0, tu: 0, ts: 0, s27: 0 }; g.centres.push(host);
    }
    host.tu += c.u25 ?? 0; host.ts += c.s25 ?? 0; host.s27 += c.s27 ?? 0;
  }
  const dU = d.total.u25, dS = d.total.s25, dTU = td?.total.u25 ?? 0, dTS = td?.total.s25 ?? 0;
  const sumG = groups.flatMap((g: any) => g.centres).reduce((t: number, c: any) => t + c.s + c.ts, 0);
  if (Math.abs(sumG - dS - dTS) > 1) throw new Error(`staff ${d.name}: centres ${sumG} vs totals ${dS + dTS}`);
  permU += dU; permS += dS; tempU += dTU; tempS += dTS;
  for (const g of groups) {
    const live = g.centres.filter((c: any) => c.s + c.ts > 0);
    if (!live.length) continue;
    const gname = GROUP[norm(g.name)] ?? (() => { throw new Error(`staff: no name for service ${g.name}`); })();
    const u = live.reduce((t: number, c: any) => t + c.u, 0), su = live.reduce((t: number, c: any) => t + c.s, 0);
    const tu = live.reduce((t: number, c: any) => t + c.tu, 0), ts = live.reduce((t: number, c: any) => t + c.ts, 0);
    const s27 = g.centres.reduce((t: number, c: any) => t + c.s27, 0);
    staffMoons.push({
      id: `personale.${key}.${norm(g.name)}`, fn: key, label: gname, value: mio(su + ts), unit: "mio CHF", digits: 2, year: PERS.year, kind: "official",
      about: {
        it: `Stipendi lordi pagati nel ${PERS.year} a chi lavora in ${gname.it} (${names.full.it}): ${f2(u)} unità a tempo pieno di ruolo${tu ? ` e ${f2(tu)} non di ruolo` : ""}. Le unità sommano i tempi parziali: due persone a metà tempo contano come una.`,
        en: `Gross salaries paid in ${PERS.year} to the staff of ${gname.en} (${names.full.en}): ${f2(u)} permanent full-time units${tu ? ` and ${f2(tu)} non-permanent` : ""}. Units add up part-time posts: two people working half time count as one.` },
      method: {
        it: `Unità e stipendi lordi del consuntivo ${PERS.year}, per centro di costo, dalle tabelle 1 (personale di ruolo) e 1a (non di ruolo) del messaggio sul preventivo ${PERS.budgetYear}. Gli stipendi lordi non comprendono i contributi del datore di lavoro (AVS, cassa pensioni), che la Città registra a parte. Lo stipendio medio è il totale degli stipendi lordi di ruolo diviso per le unità di ruolo.`,
        en: `Units and gross salaries of the ${PERS.year} accounts, by cost centre, from tables 1 (permanent staff) and 1a (non-permanent) of the ${PERS.budgetYear} budget message. Gross salaries exclude the employer's contributions (social security, pension fund), which the City books separately. The average salary is total permanent gross salaries divided by permanent units.` },
      context: [
        { label: { it: "Unità di ruolo", en: "Permanent units" }, value: u, unit: "unità", digits: 2 },
        ...(tu ? [{ label: { it: "Unità non di ruolo", en: "Non-permanent units" }, value: tu, unit: "unità", digits: 2 }] : []),
        ...(u >= 1 ? [{ label: { it: "Stipendio lordo medio per unità di ruolo", en: "Average gross salary per permanent unit" }, value: Math.round(su / u / 100) * 100, unit: "CHF", digits: 0 }] : []),
        { label: { it: `Preventivo ${PERS.budgetYear}`, en: `${PERS.budgetYear} budget` }, value: mio(s27), unit: "mio CHF", digits: 2 },
      ],
      lines: live.map((c: any) => ({ label: CENTRE[c.code] ?? (() => { throw new Error(`staff: no name for centre ${c.code}`); })(), s: mio(c.s + c.ts), u: c.u + c.tu }))
        .sort((a: any, b: any) => b.s - a.s),
      operator: null, source: persSrc, rank: null,
    });
  }
  staffPlanets.push({ key, code: "", name: names.short, account: names.full, value: mio(dS + dTS), hue: STAFF_HUE[i] });
  staffAnchors[key] = {
    about: { it: `${names.full.it}: ${f2(dU)} unità a tempo pieno di ruolo e ${f2(dTU)} non di ruolo nel ${PERS.year}, con stipendi lordi di CHF ${f2(mio(dS + dTS))} milioni.`,
      en: `${names.full.en}: ${f2(dU)} permanent full-time units and ${f2(dTU)} non-permanent in ${PERS.year}, with gross salaries of CHF ${f2(mio(dS + dTS))} million.` },
    method: null, source: persSrc };
});
if (Math.abs(permS - PERS.perm.comune.s25) > 1 || Math.abs(tempS - PERS.temp.comune.s25) > 1) throw new Error("staff: departments do not add up to the City totals");
// the rest of account 30: employer contributions, allowances, authorities, and the salaries the staff tables do not assign
const nat = PERS.nature, byCode = (c: string) => nat.lines.find((l: any) => l.code === c).value;
const unassigned = byCode("301") + byCode("302") + byCode("303") - permS - tempS;
if (unassigned < 0) throw new Error("staff tables exceed salary accounts 301–303");
const restLines = [
  ...["305", "306", "304", "300", "309"].map((c) => ({ label: nat.lines.find((l: any) => l.code === c).label, value: mio(byCode(c)) })),
  { label: { it: "Stipendi non ripartiti nelle tabelle del personale", en: "Salaries not assigned in the staff tables" }, value: mio(unassigned) },
].filter((l) => l.value > 0.005).sort((a, b) => b.value - a.value);
const restValue = mio(nat.total - permS - tempS);
if (Math.abs(restLines.reduce((t, l) => t + l.value, 0) - restValue) > 0.01) throw new Error("staff: rest of account 30 does not add up");
staffPlanets.push({ key: "p0", code: "", name: { it: "Oneri sociali e altro", en: "Social charges and other" }, account: { it: "Resto del conto 30 'Spese per il personale'", en: "Rest of account 30 'Personnel costs'" },
  value: restValue, hue: "#8f8a7a", lines: restLines });
staffAnchors.p0 = {
  about: { it: "La parte delle spese per il personale che non è stipendio lordo dei servizi: soprattutto i contributi del datore di lavoro (AVS, cassa pensioni, assicurazioni).", en: "The part of personnel costs that is not the services' gross salaries: mostly the employer's contributions (social security, pension fund, insurance)." },
  method: { it: `Conto 30 del consuntivo ${PERS.year} (CHF ${f2(mio(nat.total))} mio) meno gli stipendi lordi delle tabelle 1 e 1a (CHF ${f2(mio(permS + tempS))} mio). Gli stipendi non ripartiti sono la differenza tra i conti 301–303 e le tabelle.`,
    en: `Account 30 of the ${PERS.year} accounts (CHF ${f2(mio(nat.total))} million) minus the gross salaries of tables 1 and 1a (CHF ${f2(mio(permS + tempS))} million). Unassigned salaries are the difference between accounts 301–303 and the tables.` },
  source: [...PERS.nature.source, ...persSrc] };
const staff = { year: PERS.year, budgetYear: PERS.budgetYear, total: mio(nat.total), spend: mio(nat.spend), permU, tempU, permS: mio(permS), tempS: mio(tempS),
  nature: nat.lines.map((l: any) => ({ ...l, value: mio(l.value) })).filter((l: any) => l.value > 0.005).sort((a: any, b: any) => b.value - a.value), planets: staffPlanets, source: PERS.nature.source };
console.log(`staff: ${staffPlanets.length} planets, ${staffMoons.length} moons, rest ${restValue.toFixed(2)} mio (unassigned ${mio(unassigned).toFixed(2)})`);

const debt = star("finanze.debito-lordo");
// datasets residents and businesses ask for that are not published yet; each one is an open issue on the public repo
const missing = JSON.parse(readFileSync("src/missing.json", "utf8")).map((m: any) => ({ ...m, url: `https://github.com/nslotus/stato-finanziario-di-lugano/issues/${m.issue}` }));
// spending by function over time and budget against actual 2025 (BUDGET-SOURCES.md), built by npm run build
const FUN = JSON.parse(readFileSync("catalog/funzioni.json", "utf8"));
const base = JSON.parse(data);
for (const f of base.fn) f.trend = FUN.series[f.key] ?? (() => { throw new Error(`trend for ${f.key} missing`); })();
const sys = JSON.stringify({ ...base, trendTotals: FUN.totals, trendNote: FUN.amend, trendSource: FUN.source, missing, moons: [...moons, ...staffMoons], anchors: { ...anchors, ...staffAnchors }, staff, manifest, revPlanets, revAll, result: result2024, resultSource: ch("risultato").source,
  debt: { value: debt.value, year: debt.year, label: debt.label }, revSource: { it: "Ricavi 2024 per genere di conto (40–46) e totale dei ricavi per funzione, appendice statistica del Cantone (tabella B).", en: "2024 revenue by account type (40–46) and total revenue by function, canton statistical appendix (table B)." } }).replace(/<\//g, "<\\/");

// ---- the overview's data: money in and out, staff, budget against actual, results, investment, the debt to 2033 and
// missing data, checked against each other
const rec = (s: any) => ({ id: s.id, constellation: s.constellation, label: s.label, about: s.about, value: s.value, unit: s.unit, digits: s.digits, year: s.year, kind: s.kind,
  method: s.method ?? null, context: s.context ?? [], operator: s.operator ?? null, source: s.source, detail: s.detail ?? [],
  rank: s.comparison ? { rank: s.comparison.lugano.rank, of: s.comparison.lugano.of, median: s.comparison.median } : null });
const chap = (id: string) => { const c = ch(id); return { title: c.title, lede: c.lede ?? null, chart: c.chart, notes: c.notes ?? [], source: c.source }; };
const plan = Object.fromEntries(["piano-debito", "piano-investimenti", "piano-rivalorizzazioni", "piano-misure"].map((k) => [k, rec(star(`finanze.${k}`))]));
const debtCh = chap("debito");
if (debtCh.chart.data.some((d: any) => !d.date || !["actual", "estimate", "plan"].includes(d.status))) throw new Error("site: every debt point needs a date and a known status");
const sysData = JSON.parse(sys);
const story = { ...sysData, sun: rec(sun), taxes: { pf: rec(star("finanze.imposte-pf")), pg: rec(star("finanze.imposte-pg")) }, plan, debtCh, resultCh: chap("risultato"), investCh: chap("investire"),
  revCh: chap("entrate"), outCh: chap("uscite"), revAllSource: [{ file: "sources/sel-2024-appendice.xlsx", locator: "sheet TabB, row 'Lugano' (total revenue by function, CHF thousands)" }],
  atlas: cat.stars.map(rec) };
// every source the story cites must be an archived file
const files = new Set(manifest.map((m: any) => m.file));
const walk = (o: any, path: string): void => {
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`));
  if (o && typeof o === "object") { if (typeof o.file === "string" && "locator" in o && !files.has(o.file)) throw new Error(`site: ${path} cites ${o.file}, not in sources/MANIFEST.json`); for (const k of Object.keys(o)) walk(o[k], `${path}.${k}`); }
};
walk(story, "story");
for (const [k, v] of Object.entries({ sun: story.sun.source, revenue: story.revCh.source, spending: story.outCh.source, staff: story.staff.source, trend: story.trendSource, result: story.resultCh.source, invest: story.investCh.source, debt: story.debtCh.source }))
  if (!v?.length) throw new Error(`site: no source for ${k}`);
const flowIn = story.revPlanets.reduce((t: number, r: any) => t + r.value, 0), flowOut = story.fn.reduce((t: number, f: any) => t + f.value, 0);
if (Math.abs(flowIn - story.revAll) > 0.01 || Math.abs(flowOut - story.total) > 0.05 || Math.abs(flowIn - flowOut - story.result) > 0.06) throw new Error(`site: flow in ${flowIn} − out ${flowOut} is not the result ${story.result}`);

// ---- Cielo del preventivo, Lugano: a planetarium dome. Every 2025 spending line (three digits, or two without children) is a
// star; the horizon is the 2025 budget, height is the gap between actual and budget, direction is the function.
let cupola: any;
{
  const lines = FUN.lines25 ?? (() => { throw new Error("cupola: funzioni.json has no lines25; run npm run build"); })();
  const groups = FUN.groups25 ?? (() => { throw new Error("cupola: funzioni.json has no groups25; run npm run build"); })();
  for (const l of lines) if (l.code.length === 3 && !groups.some((g: any) => g.code === l.code.slice(0, 2))) throw new Error(`cupola: line ${l.code} has no group`);
  const fns = story.fn.map((f: any) => ({ key: f.key, code: f.code, name: f.name, account: f.account, hue: f.hue, p25: f.trend.p25, c25: f.trend.c25, pct: f.trend.pct,
    trend: { c23: f.trend.c23, c24: f.trend.c24, p25: f.trend.p25, c25: f.trend.c25, p27: f.trend.p27 },
    facts: story.moons.filter((m: any) => m.fn === f.key && !m.id.startsWith("personale.")).map((m: any) => ({ label: m.label, about: m.about, value: m.value, unit: m.unit, digits: m.digits, year: m.year, source: m.source })) }));
  for (const f of fns) {
    const mine = lines.filter((l: any) => l.code[0] === f.code);
    if (Math.abs(mine.reduce((t: number, l: any) => t + l.c25, 0) - f.c25) > 0.001 || Math.abs(mine.reduce((t: number, l: any) => t + l.p25, 0) - f.p25) > 0.001) throw new Error(`cupola: lines of function ${f.code} do not add up`);
  }
  // the same spending by the City's departments: divisions are the groups, cost centres (or divisions without centres) the stars
  const ORG = JSON.parse(readFileSync("catalog/dicasteri.json", "utf8"));
  const DEPT_HUE = ["#e9edff", "#5aab3c", "#d55181", "#4cf8e7", "#9085e9", "#3b5bf0", "#abca84"];
  const pctOf = (b: number, c: number) => (b ? ((c - b) / b) * 100 : 0);
  const org = {
    slices: ORG.depts.map((d: any) => ({ key: `d${d.n}`, code: String(d.n), name: { it: d.name, en: d.name }, account: { it: `Dicastero ${d.n} – ${d.name}`, en: `Department ${d.n} – ${d.name}` },
      hue: DEPT_HUE[d.n - 1], p25: d.p25, c25: d.c25, pct: pctOf(d.p25, d.c25), trend: null, facts: [] })),
    groups: ORG.depts.flatMap((d: any) => d.divisions.map((v: any) => ({ code: v.code, label: v.name.replace(/^CONTRIBUTI DEL DICASTERO .*/, "Contributi del dicastero"), p25: v.p25, c25: v.c25, text: v.text, page: v.page }))),
    lines: ORG.depts.flatMap((d: any) => d.divisions.flatMap((v: any) => (v.centres.length ? v.centres : [v]).filter((c: any) => c.c25 || c.p25)
      .map((c: any) => ({ code: c.code, label: c.name.replace(/^CONTRIBUTI DEL DICASTERO .*/, "Contributi del dicastero"), p25: c.p25, c25: c.c25, text: c.text ?? [], kind: c.kind, page: c.page })))),
    source: ORG.source, note: ORG.note,
  };
  const orgTotal = org.lines.reduce((t: number, l: any) => t + l.c25, 0);
  if (Math.abs(orgTotal - FUN.totals.c25) > 0.0001) throw new Error(`cupola: department stars add up to ${orgTotal}, functions to ${FUN.totals.c25}`);
  for (const g of org.groups) { const k = org.lines.filter((l: any) => l.code.startsWith(g.code)); if (k.length && Math.abs(k.reduce((t: number, l: any) => t + l.c25, 0) - g.c25) > 0.0001) throw new Error(`cupola: centres of division ${g.code} do not add up`); }
  cupola = { fns, lines, groups, amend: FUN.amend, linesSource: FUN.linesSource, trendSource: FUN.source, org, manifest };
  walk(cupola, "cupola");
}

// ================================================================================================================
// The page: every 2025 spending line as a star (above), and each sector's figures with their full records (below).
// ================================================================================================================

// which sector of the sky a catalogue constellation belongs to
const SECTOR: Record<string, string> = { sicurezza: "1", istruzione: "2", cultura: "3", salute: "4", sociale: "5", trasporti: "6", ambiente: "7", economia: "8", finanze: "9" };

// a figure's full record: the page shows its explanation, method, comparison with Ticino's municipalities,
// breakdown charts, related figures and sources
const record = (s: any) => {
  const o: any = { id: s.id, c: s.constellation, label: s.label, about: s.about, value: s.value, unit: s.unit, year: s.year, kind: s.kind };
  if (s.method) o.method = s.method;
  if (s.context?.length) o.context = s.context;
  if (s.operator) o.operator = s.operator;
  if (s.digits != null) o.digits = s.digits;
  if (s.comparison) {
    const c = s.comparison;
    o.cmp = { unit: c.unit, median: c.median, rank: c.lugano?.rank, of: c.lugano?.of, order: c.rankOrder, v: c.values.map((r: any) => [r.name, r.value, r.population]) };
    o.rank = { rank: c.lugano.rank, of: c.lugano.of, median: c.median };
  }
  if (s.detail?.length) o.detail = s.detail.map((d: any) => { const chart = { ...d.chart }; delete chart.color; return { title: d.title, chart, note: d.note, source: d.source }; });
  if (s.related?.length) o.related = s.related;
  o.source = s.source;
  return o;
};
const X: any = { stars: {}, anchors: {}, dept: {}, chapters: [], relations: [], missing, staff, extras: [] };
for (const s of cat.stars) X.stars[s.id] = record(s);

// every figure in a sector's list carries the id of its catalogue record
for (const f of cupola.fns) for (const x of f.facts) {
  const hit = cat.stars.find((s: any) => SECTOR[s.constellation] === f.code && s.label.it === x.label.it);
  if (!hit) throw new Error(`site: figure '${x.label.it}' of sector ${f.code} has no catalogue record`);
  x.id = hit.id;
}
// a sector's spending per resident heads its list; the City total per resident opens the overview
for (const s of cat.stars.filter((s: any) => s.id.endsWith(".spesa") && s.id !== "bilancio.spesa")) X.anchors[SECTOR[s.constellation]] = s.id;
// figures the moons of the old planet view kept apart (taxes and revenue) join the sector of their constellation
const onPage = new Set(cupola.fns.flatMap((f: any) => f.facts.map((x: any) => x.id)));
for (const s of cat.stars) {
  if (onPage.has(s.id) || s.id.endsWith(".spesa")) continue;
  const f = cupola.fns.find((g: any) => g.code === SECTOR[s.constellation]) ?? (() => { throw new Error(`site: no sector for ${s.id}`); })();
  f.facts.push({ id: s.id, label: s.label, about: s.about, value: s.value, unit: s.unit, digits: s.digits, year: s.year, source: s.source });
}
if (cupola.fns.reduce((t: number, f: any) => t + f.facts.length, 0) + Object.keys(X.anchors).length + 1 !== cat.stars.length) throw new Error("site: not every catalogue figure is on the page");

// departments: staff and gross salaries per service (tables 1 and 1a of the 2027 budget message)
for (const sl of cupola.org.slices) {
  const p = `p${sl.code}`, moons = staffMoons.filter((m: any) => m.fn === p);
  if (!moons.length) throw new Error(`site: department ${sl.code} has no staff figures`);
  sl.facts = moons.map((m: any) => ({ id: m.id, label: m.label, about: m.about, value: m.value, unit: m.unit, digits: m.digits, year: m.year, source: m.source }));
  for (const m of moons) X.stars[m.id] = { id: m.id, c: p, label: m.label, about: m.about, value: m.value, unit: m.unit, digits: m.digits, year: m.year, kind: m.kind, method: m.method, context: m.context, source: m.source };
  const planet = staffPlanets.find((q: any) => q.key === p);
  X.dept[sl.code] = { about: staffAnchors[p].about, source: staffAnchors[p].source, salaries: planet.value, name: planet.name };
}

// the overview: the catalogue's chapters and relations, total spending by year, staff, missing datasets
X.chapters = cat.chapters.map((c: any) => { const o = JSON.parse(JSON.stringify(c)); if (o.chart) delete o.chart.color; return o; });
X.relations = cat.relations;
for (const r of X.relations) if (!X.stars[r.x]?.cmp || !X.stars[r.y]?.cmp) throw new Error(`site: relation ${r.id} needs comparisons for ${r.x} and ${r.y}`);
const tt = FUN.totals;
for (const k of ["c23", "c24", "p25", "c25", "p27"]) {
  const sum = cupola.fns.reduce((t: number, f: any) => t + f.trend[k], 0);
  if (Math.abs(sum - tt[k]) > 0.01) throw new Error(`site: functions add up to ${sum} for ${k}, the total is ${tt[k]}`);
}
X.totals = { type: "columns", unit: "mio CHF", series: [
  { label: { it: "Consuntivo", en: "Actual" }, data: [["2023", tt.c23], ["2024", tt.c24], ["2025", tt.c25]].map(([y, v]) => ({ key: `a${y}`, label: { it: y, en: y }, value: v, status: "actual" })) },
  { label: { it: "Preventivo", en: "Budget" }, data: [["2025", tt.approved25], ["2027", tt.p27]].map(([y, v]) => ({ key: `b${y}`, label: { it: y, en: y }, value: v, status: "budget" })) }] };
X.totalsNote = {
  it: `Spesa totale della Città per anno. Il preventivo 2025 è quello approvato dal Consiglio comunale (${tt.approved25.toFixed(1)} milioni); la proposta del Municipio, ripartita per funzione, era di ${tt.p25.toFixed(1)} milioni.`,
  en: `The City's total spending by year. The 2025 budget is the one approved by the Council (CHF ${tt.approved25.toFixed(1)} million); the Municipio's proposal, split by function, was CHF ${tt.p25.toFixed(1)} million.` };
X.totalsSource = FUN.source;

// more on the debt: read from the debt profile of dati-di-lugano (pinned) and the 2026 budget release
const DEBT_FILE = "dati-di-lugano@8c1fd28-debt-profile.json";
const dp = JSON.parse(readFileSync(`sources/${DEBT_FILE}`, "utf8"));
const snap = (label: string) => dp.snapshots.find((x: any) => x.label === label) ?? (() => { throw new Error(`site: debt snapshot ${label} missing`); })();
const s24 = snap("end 2024"), s25 = snap("end 2025"), q1 = snap("Q1 2026"), b26 = dp.plan.budget;
const it1 = (v: number) => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct0 = (v: number) => Math.round(v * 100);
const bondsM = (x: any) => x.publicBondsM + x.privatePlacementsM;
const bonds = (x: any) => bondsM(x).toLocaleString("de-CH");
for (const x of [s24, s25, q1]) if (Math.abs(bondsM(x) / x.grossDebt.M - x.bondShareOfGross) > 0.001) throw new Error(`site: bond share of ${x.label} does not recompute`);
// 2026 net investment: the figure the overview uses (262.4, from the 2027 message), not the 2026 release's 263.5, which
// does not give the overall result; with it, self-financing − investment = overall result to the rounding (0.1)
const inv26 = ch("investire").chart.series[0].data.find((d: any) => d.key === "n26").value;
if (Math.abs(b26.autofinanziamento.M - inv26 - b26.risultatoGlobale.M) > 0.06) throw new Error("site: 2026 self-financing − investment is not the overall result");
const dpSrc = (loc: string) => [{ file: `sources/${DEBT_FILE}`, locator: loc }];
const BUDGET26 = "city-preventivo-2026-comunicato.pdf";
const netPerRes = star("finanze.debito-pro-capite"), netTotal = (netPerRes.value * pop) / 1e6;

async function debtNotes() {
  const { pages } = await readPdf(BUDGET26, [2]);
  const t = (pages[1] ?? "").replace(/moltip\s*li\s*c\s*atore|moltiplic\s*atore/g, "moltiplicatore");
  const m = (who: string) => t.match(new RegExp(`${who} con moltiplicatore all.(\\d+)%\\s*\\(\\+(\\d+) punti\\)`)) ?? (() => { throw new Error(`site: ${BUDGET26} p. 2 has no multiplier for ${who}`); })();
  const pf = m("persone fisiche"), pg = m("persone giuridiche");
  if (pf[2] !== pg[2]) throw new Error("site: the two multipliers rise by different steps");
  return [
    { text: { it: `Debito netto a fine marzo 2026: ${it1(q1.netDebt.M)} milioni (debito lordo meno liquidità).`,
        en: `Net debt at the end of March 2026: CHF ${it1(q1.netDebt.M)} million (gross debt minus liquid assets).` },
      source: dpSrc("snapshots['Q1 2026'].netDebt, from the City's 2025 accounts presentation, p. 2") },
    { text: { it: `Quota del debito in obbligazioni: ${pct0(s24.bondShareOfGross)}% a fine 2024 (${bonds(s24)} su ${it1(s24.grossDebt.M)} milioni), ${pct0(s25.bondShareOfGross)}% a fine 2025 (${bonds(s25)} su ${it1(s25.grossDebt.M)}), ${pct0(q1.bondShareOfGross)}% a fine marzo 2026 (${bonds(q1)} su ${it1(q1.grossDebt.M)}). Il resto non è ripartito nei documenti della Città; si presume debito bancario a breve termine (stima).`,
        en: `Share of the debt in bonds: ${pct0(s24.bondShareOfGross)}% at the end of 2024 (${bonds(s24)} of ${it1(s24.grossDebt.M)} million), ${pct0(s25.bondShareOfGross)}% at the end of 2025 (${bonds(s25)} of ${it1(s25.grossDebt.M)}), ${pct0(q1.bondShareOfGross)}% at the end of March 2026 (${bonds(q1)} of ${it1(q1.grossDebt.M)}). The City's documents do not break down the rest; it is presumed to be short-term bank debt (estimate).` },
      source: dpSrc("snapshots[*].bondShareOfGross = (publicBondsM + privatePlacementsM) / grossDebt, bond register × City debt figures") },
    { text: { it: `Preventivo 2026: risultato globale di ${it1(b26.risultatoGlobale.M)} milioni (fabbisogno di finanziamento), autofinanziamento di ${it1(b26.autofinanziamento.M)} milioni, investimenti netti di ${it1(inv26)} milioni; moltiplicatore comunale ${pf[1]}% per le persone fisiche e ${pg[1]}% per le aziende (+${pf[2]} punti).`,
        en: `2026 budget: overall result of CHF ${it1(b26.risultatoGlobale.M)} million (borrowing need), self-financing CHF ${it1(b26.autofinanziamento.M)} million, net investment CHF ${it1(inv26)} million; municipal tax multiplier ${pf[1]}% for individuals and ${pg[1]}% for companies (+${pf[2]} points).` },
      source: [...dpSrc("plan.budget"), ch("investire").source.find((s: any) => /preventivo-2027-messaggio/.test(s.file)), { file: `sources/${BUDGET26}`, locator: "p. 2: 'moltiplicatore all'80% (+3 punti)' (individuals), 'all'85% (+3 punti)' (companies)" }] },
    { text: { it: `Due misure del debito da non confondere: il debito finanziario lordo della Città (${it1(s25.grossDebt.M)} milioni a fine 2025) e il debito pubblico netto I del Cantone, debiti meno beni finanziari (${it1(netTotal)} milioni nel 2024, ${Math.round(netPerRes.value).toLocaleString("de-CH")} CHF per abitante).`,
        en: `Two debt measures not to confuse: the City's gross financial debt (CHF ${it1(s25.grossDebt.M)} million at the end of 2025) and the canton's net public debt I, debt minus financial assets (CHF ${it1(netTotal)} million in 2024, CHF ${Math.round(netPerRes.value).toLocaleString("de-CH")} per resident).` },
      source: [...dpSrc("snapshots['end 2025'].grossDebt"), ...netPerRes.source] },
  ];
}

// English names of the accounts' lines, groups and departments: the sources give them in Italian only
const EN: Record<string, string> = JSON.parse(readFileSync("translations/labels-en.json", "utf8"));
const needEn = new Set<string>([...cupola.lines.map((l: any) => l.label), ...cupola.groups.map((g: any) => g.label), ...cupola.org.groups.map((g: any) => g.label),
  ...cupola.org.lines.map((l: any) => l.label), ...cupola.org.slices.map((s: any) => s.name.it)]);
const noEn = [...needEn].filter((k) => !EN[k]);
if (noEn.length) throw new Error(`site: no English name for ${noEn.join(" | ")}`);
const unused = Object.keys(EN).filter((k) => !needEn.has(k));
if (unused.length) throw new Error(`site: translations/labels-en.json has names no longer used: ${unused.join(" | ")}`);

(async () => {
  X.extras = await debtNotes();
  // every source a record cites must be an archived file listed in sources/MANIFEST.json
  walk({ cupola, X }, "site");
  // the Italian page shows each source in Italian; check 9 requires one for every locator and publisher, none unused
  const it = JSON.parse(readFileSync("translations/sources-it.json", "utf8"));
  X.srcIt = { locators: it.locators, publishers: it.publishers };
  const out = { D: cupola, X, EN };
  const stars = Object.keys(X.stars).length;
  const more = splitSite(out);                          // the detail goes to a second file, read after the first screen
  mkdirSync("docs/data", { recursive: true });
  const js = (o: unknown) => JSON.stringify(o).replace(/<\//g, "<\\/");
  const json = js(out), jsonMore = js(more);
  writeFileSync("docs/data/data.js", `// Generated by npm run site from catalog/*.json. Do not edit by hand.\nwindow.CIELO = ${json};\n`);
  writeFileSync("docs/data/data-more.js", `// Generated by npm run site from catalog/*.json. Do not edit by hand.\nwindow.CIELO_MORE = ${jsonMore};\n`);
  console.log(`docs/data/data.js ${Math.round(json.length / 1024)} KB + data-more.js ${Math.round(jsonMore.length / 1024)} KB · ${cupola.lines.length} lines · ${stars} figure records · ${X.chapters.length} chapters`);
})().catch((e) => { console.error(e.message); process.exit(1); });
