// Companies by legal form (commercial register) and what legal persons earn (federal direct tax), in the economy arm.
// Register: active entities in Zefix (open data on LINDAS), counted by registered office and legal form (eCH-0097);
// the query and its result are archived. Tax: ESTV, federal direct tax of legal persons by municipality.
// Boundaries: the register uses the 2025 municipalities (100), matched to the 2025 population; the ESTV file uses its
// own 2022 tax units, so its measures are per company (no population needed) and compared across those units.

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { compare, type Source, type Star, type Text } from "./catalog";
import { fail, num, rawPath, sheet } from "./adapters/common";
import { AGE_FILE } from "./adapters/municipalities";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const EC = "var(--economia)";
/** Italian article before a rounded percentage: l'8%, l'11%, il 42% */
const il = (p: number) => { const r = Math.round(p); return `${/^(8|11|8\d)$/.test(String(r)) ? "l'" : "il "}${r}%`; };
export const F = { zefix: "zefix-forme-giuridiche-ti-20261018.csv", query: "zefix-forme-giuridiche-ti.rq", estv: "estv-dbst-jp-gden-2022.xlsx" };
const FORMS: Record<string, Text> = {
  "0106": { it: "Società anonime (SA)", en: "Companies limited by shares (SA)" },
  "0107": { it: "Società a garanzia limitata (Sagl)", en: "Limited liability companies (Sagl)" },
  "0101": { it: "Ditte individuali", en: "Sole proprietorships" },
  "0110": { it: "Fondazioni", en: "Foundations" }, "0109": { it: "Associazioni", en: "Associations" },
  "0151": { it: "Succursali svizzere", en: "Swiss branches" }, "0111": { it: "Succursali di imprese estere", en: "Branches of foreign companies" },
  "0103": { it: "Società in nome collettivo", en: "General partnerships" }, "0108": { it: "Cooperative", en: "Cooperatives" },
  "0104": { it: "Società in accomandita", en: "Limited partnerships" }, "0117": { it: "Istituti di diritto pubblico", en: "Public-law institutions" },
};
const CAPITAL = ["0106", "0107"];

export function imprese(src: Src) {
  // ---- register: counts by municipality and legal form
  const lines = readFileSync(rawPath(F.zefix), "utf8").trim().split(/\r?\n/);
  if (lines[0] !== "bfs,form,n") fail(`${F.zefix}: unexpected header ${lines[0]}`);
  const reg = new Map<number, Record<string, number>>();
  for (const l of lines.slice(1)) { const [b, f, c] = l.split(","); (reg.get(+b) ?? reg.set(+b, {}).get(+b)!)[f] = +c; }
  const p25rows = sheet(AGE_FILE, "2025"), head25 = p25rows.find((r) => r.includes("Totale")) ?? fail("2025 age header missing");
  const pop25 = new Map<number, { name: string; pop: number }>();
  for (const r of p25rows) { const m = String(r[0] ?? "").trim().match(/^(\d{4}) (.+)$/); if (m) pop25.set(+m[1], { name: m[2], pop: num(r[head25.indexOf("Totale")]) ?? 0 }); }
  if (reg.size !== pop25.size || [...reg.keys()].some((b) => !pop25.has(b))) fail(`${F.zefix}: ${reg.size} municipalities do not match the 2025 population (${pop25.size})`);
  const lug = reg.get(5192) ?? fail(`${F.zefix}: Lugano missing`);
  const lugTotal = Object.values(lug).reduce((s, v) => s + v, 0);
  const per1000 = (b: number, codes: string[]) => (codes.reduce((s, c) => s + (reg.get(b)![c] ?? 0), 0) / pop25.get(b)!.pop) * 1000;
  const capCmp = compare([...reg.keys()].map((b) => ({ bfs: b, name: pop25.get(b)!.name, value: per1000(b, CAPITAL), population: pop25.get(b)!.pop })), "per 1.000 abitanti", "highest-first");
  const tiPop = [...pop25.values()].reduce((s, v) => s + v.pop, 0);
  const tiCount = (c: string) => [...reg.values()].reduce((s, v) => s + (v[c] ?? 0), 0);
  const rankOf = (codes: string[]) => compare([...reg.keys()].map((b) => ({ bfs: b, name: pop25.get(b)!.name, value: per1000(b, codes), population: pop25.get(b)!.pop })), "per 1.000 abitanti", "highest-first").lugano;
  const rSA = rankOf(["0106"]), rSagl = rankOf(["0107"]), rDI = rankOf(["0101"]);
  const unknown = Object.keys(lug).filter((c) => !FORMS[c]);
  if (unknown.length) fail(`${F.zefix}: legal forms without a label for Lugano: ${unknown.join(", ")}`);

  // ---- federal direct tax of legal persons, 2022: count, net profit, tax, equity; rows "Total" and "without net profit"
  const wb = XLSX.read(readFileSync(rawPath(F.estv)));
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets["Gemeinden - Communes"], { header: 1, defval: null });
  const year = String(rows[1][0]);
  const pick = (r: (string | number | null)[]) => ({ n: Number(r[6]), profit: Number(r[7]), tax: Number(r[8]), equity: Number(r[9]) });
  const units = new Map<number, { name: string; tot: ReturnType<typeof pick>; zero: ReturnType<typeof pick> }>();
  let tiRow: ReturnType<typeof pick> | null = null, tiZero: ReturnType<typeof pick> | null = null, chRow: ReturnType<typeof pick> | null = null, chZero: ReturnType<typeof pick> | null = null;
  for (const r of rows.slice(1)) {
    const total = /^Total/.test(String(r[5])), zero = /^Ohne Reingewinn/.test(String(r[5]));
    if (r[2] === "TI" && /^\d+$/.test(String(r[3]))) {
      const u = units.get(+r[3]!) ?? units.set(+r[3]!, { name: String(r[4]), tot: pick(r), zero: { n: 0, profit: 0, tax: 0, equity: 0 } }).get(+r[3]!)!;
      if (total) u.tot = pick(r); else if (zero) u.zero = pick(r);
    } else if (r[2] === "TI" && r[3] === "Total") { if (total) tiRow = pick(r); else if (zero) tiZero = pick(r); }
    else if (r[2] === "CH") { if (total) chRow = pick(r); else if (zero) chZero = pick(r); }
  }
  if (!tiRow || !tiZero || !chRow || !chZero) fail(`${F.estv}: canton or Swiss totals missing`);
  // the canton's total vs the sum of its tax units: the FTA withholds figures that would breach tax secrecy ("Explication"),
  // so the units may add up to slightly less than the total, never more
  const ok = (u: { tot: ReturnType<typeof pick> }) => Number.isFinite(u.tot.n) && Number.isFinite(u.tot.profit);
  const sumN = [...units.values()].filter(ok).reduce((s, u) => s + u.tot.n, 0), sumP = [...units.values()].filter(ok).reduce((s, u) => s + u.tot.profit, 0);
  if (sumN > tiRow!.n || sumP > tiRow!.profit + 1000 || tiRow!.n - sumN > tiRow!.n * 0.001 || tiRow!.profit - sumP > tiRow!.profit * 0.001)
    fail(`${F.estv}: Ticino units add up to ${sumN} / ${sumP}, total row says ${tiRow!.n} / ${tiRow!.profit}`);
  console.log(`  ${F.estv}: Ticino units ${sumN} of ${tiRow!.n} legal persons (${tiRow!.n - sumN} withheld for tax secrecy)`);
  const L = units.get(5192) ?? fail(`${F.estv}: Lugano missing`);
  if (L.zero.n > L.tot.n || L.zero.profit !== 0) fail(`${F.estv}: Lugano rows inconsistent`);
  const popOf = (b: number) => pop25.get(b)?.pop ?? 0; // bubble size only; the measures need no population
  const valid = [...units].filter(([, u]) => ok(u) && u.tot.n > 0 && Number.isFinite(u.zero.n));
  const profitCmp = compare(valid.map(([b, u]) => ({ bfs: b, name: u.name, value: u.tot.profit / u.tot.n / 1000, population: popOf(b) })), "mila CHF / persona giuridica", "highest-first");
  const zeroCmp = compare(valid.map(([b, u]) => ({ bfs: b, name: u.name, value: (u.zero.n / u.tot.n) * 100, population: popOf(b) })), "%", "highest-first");
  const lugAvg = L.tot.profit / L.tot.n / 1000, tiAvg = tiRow!.profit / tiRow!.n / 1000, chAvg = chRow!.profit / chRow!.n / 1000;
  const lugZero = (L.zero.n / L.tot.n) * 100, tiZeroP = (tiZero!.n / tiRow!.n) * 100, chZeroP = (chZero!.n / chRow!.n) * 100;
  const unitsNote: Text = { it: `Confronto sulle ${valid.length} unità fiscali del file dell'AFC per il ${year} (i confini comunali di quell'anno fiscale, con alcuni comuni poi aggregati). Le bolle senza popolazione 2025 sono comuni non più esistenti.`,
    en: `Compared across the ${valid.length} tax units in the FTA file for ${year} (the municipal boundaries of that tax year, including some municipalities since merged). Bubbles without a 2025 population are municipalities that no longer exist.` };

  const regSrc = (loc: string) => src(F.zefix, loc);
  const estvSrc = (loc: string) => src(F.estv, `sheet 'Gemeinden - Communes', ${loc}`);
  const stars: Star[] = [
    { id: "economia.forme-giuridiche", constellation: "economia", label: { it: "Società di capitali", en: "Incorporated companies" },
      about: { it: `Società anonime e Sagl con sede a Lugano iscritte al registro di commercio: ${n(lug["0106"])} SA e ${n(lug["0107"])} Sagl, ${n(capCmp.lugano.value, 0)} ogni 1'000 abitanti (Ticino ${n(((tiCount("0106") + tiCount("0107")) / tiPop) * 1000, 0)}). Lugano ospita ${il((lug["0106"] / tiCount("0106")) * 100)} delle SA e ${il((lug["0107"] / tiCount("0107")) * 100)} delle Sagl del Ticino. Le ditte individuali iscritte sono ${n(lug["0101"])}, nella media del cantone.`,
        en: `Companies limited by shares (SA) and limited liability companies (Sagl) registered in Lugano: ${n(lug["0106"])} SA and ${n(lug["0107"])} Sagl, ${n(capCmp.lugano.value, 0)} per 1,000 residents (Ticino ${n(((tiCount("0106") + tiCount("0107")) / tiPop) * 1000, 0)}). Lugano is the seat of ${n((lug["0106"] / tiCount("0106")) * 100, 0)}% of Ticino's SA and ${n((lug["0107"] / tiCount("0107")) * 100, 0)}% of its Sagl. ${n(lug["0101"])} sole proprietorships are registered, about the cantonal average.` },
      value: capCmp.lugano.value, unit: "per 1.000 abitanti", year: 2026, area: "Lugano", kind: "derived",
      method: { it: `Enti attivi nel registro di commercio (Zefix, dati aperti aggiornati ogni giorno), contati per sede e forma giuridica il 18 ottobre 2026; SA e Sagl divisi per la popolazione al 31.12.2025, per 1'000. Le ditte individuali devono iscriversi solo da una cifra d'affari di 100'000 franchi (art. 931 CO): il registro non le conta tutte. Le loro imposte sono pagate come persone fisiche.`,
        en: `Active entities in the commercial register (Zefix, open data updated daily), counted by registered office and legal form on 18 October 2026; SA and Sagl divided by the population at 31.12.2025, per 1,000. Sole proprietorships must register only from CHF 100,000 in turnover (art. 931 CO): the register does not count them all. Their taxes are paid as individuals.` },
      source: [regSrc("all rows; columns bfs (registered office), form (eCH-0097 code), n (active entities)"), src(F.query, "SPARQL query run on https://ld.admin.ch/query on 18.10.2026"), src(AGE_FILE, "sheet 2025, column Totale")],
      context: [{ label: { it: "SA", en: "SA" }, value: lug["0106"], unit: "aziende" }, { label: { it: "Sagl", en: "Sagl" }, value: lug["0107"], unit: "aziende" },
        { label: { it: "Ditte individuali iscritte", en: "Registered sole proprietorships" }, value: lug["0101"], unit: "aziende" }, { label: { it: "Tutti gli enti iscritti", en: "All registered entities" }, value: lugTotal, unit: "aziende" }],
      comparison: capCmp, related: ["economia.aziende", "finanze.imposte-pg", "economia.utile-pg"],
      detail: [
        { title: { it: "Enti iscritti al registro di commercio a Lugano, per forma giuridica", en: "Entities in Lugano's commercial register, by legal form" },
          chart: { type: "hbars", unit: "aziende", color: EC, caption: { it: "enti attivi · 18.10.2026", en: "active entities · 18.10.2026" },
            data: Object.entries(lug).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ key: `f${c}`, label: FORMS[c], value: v })) },
          note: { it: "Le ditte individuali sono iscritte solo sopra 100'000 franchi di cifra d'affari; le altre forme sono tutte iscritte.", en: "Sole proprietorships are registered only above CHF 100,000 in turnover; the other forms are all registered." },
          source: [regSrc("rows bfs = 5192")] },
        { title: { it: "Ogni 1'000 abitanti: Lugano e Ticino", en: "Per 1,000 residents: Lugano and Ticino" },
          chart: { type: "columns", unit: "per 1.000 abitanti", color: EC, series: [
            { label: { it: "Lugano", en: "Lugano" }, data: ["0106", "0107", "0101"].map((c) => ({ key: `l${c}`, label: FORMS[c], value: per1000(5192, [c]) })) },
            { label: { it: "Ticino", en: "Ticino" }, data: ["0106", "0107", "0101"].map((c) => ({ key: `t${c}`, label: FORMS[c], value: (tiCount(c) / tiPop) * 1000 })) }] },
          note: { it: `Posizione di Lugano fra i ${rSA.of} comuni: SA ${rSA.rank}°, Sagl ${rSagl.rank}°, ditte individuali ${rDI.rank}°.`,
            en: `Lugano's rank among the ${rSA.of} municipalities: SA ${rSA.rank}, Sagl ${rSagl.rank}, sole proprietorships ${rDI.rank}.` },
          source: [regSrc("all rows, forms 0106, 0107, 0101"), src(AGE_FILE, "sheet 2025, column Totale")] }] },
    { id: "economia.utile-pg", constellation: "economia", label: { it: "Utile delle persone giuridiche", en: "Profit of legal persons" },
      about: { it: `Nel ${year} le ${n(L.tot.n)} persone giuridiche tassate a Lugano per l'imposta federale diretta (SA, Sagl, cooperative, fondazioni e associazioni) hanno dichiarato un utile netto di ${n(L.tot.profit / 1e9, 2)} miliardi di franchi: in media ${n(lugAvg, 0)} mila franchi ciascuna (Ticino ${n(tiAvg, 0)} mila, Svizzera ${n(chAvg, 0)} mila). È una media: poche grandi società pesano molto. L'imposta federale pagata è stata di ${n(L.tot.tax / 1e6, 1)} milioni.`,
        en: `In ${year} the ${n(L.tot.n)} legal persons taxed in Lugano under the federal direct tax (SA, Sagl, cooperatives, foundations and associations) declared a net profit of CHF ${n(L.tot.profit / 1e9, 2)} billion: on average CHF ${n(lugAvg, 0)} thousand each (Ticino ${n(tiAvg, 0)} thousand, Switzerland ${n(chAvg, 0)} thousand). It is an average: a few large companies weigh heavily. The federal tax paid was CHF ${n(L.tot.tax / 1e6, 1)} million.` },
      value: lugAvg, unit: "mila CHF / persona giuridica", year: Number(year), area: "Lugano", kind: "derived",
      method: { it: `Utile netto totale diviso per il numero di persone giuridiche tassate (riga «Total»), imposta federale diretta, periodo fiscale ${year}. ${unitsNote.it}`,
        en: `Total net profit divided by the number of legal persons taxed (row "Total"), federal direct tax, tax period ${year}. ${unitsNote.en}` },
      source: [estvSrc("rows of each Ticino municipality, Typ 'Total', columns Anzahl, Reingewinn, Steuer, Eigenkapital"), estvSrc("rows TI Total and CH Total")],
      context: [{ label: { it: "Persone giuridiche tassate", en: "Legal persons taxed" }, value: L.tot.n, unit: "aziende" },
        { label: { it: "Utile netto", en: "Net profit" }, value: L.tot.profit / 1e6, unit: "mio CHF" },
        { label: { it: "Imposta federale", en: "Federal tax" }, value: L.tot.tax / 1e6, unit: "mio CHF" },
        { label: { it: "Capitale proprio", en: "Equity" }, value: L.tot.equity / 1e6, unit: "mio CHF" }],
      comparison: profitCmp, related: ["economia.forme-giuridiche", "economia.pg-senza-utile", "finanze.ifd-quota"] },
    { id: "economia.pg-senza-utile", constellation: "economia", label: { it: "Società senza utile", en: "Companies without profit" },
      about: { it: `Delle ${n(L.tot.n)} persone giuridiche tassate a Lugano nel ${year}, ${n(L.zero.n)} (${n(lugZero, 1)}%) non hanno dichiarato utile netto (Ticino ${n(tiZeroP, 1)}%, Svizzera ${n(chZeroP, 1)}%). Possono essere in perdita, a pareggio o senza attività; la statistica non dice quale.`,
        en: `Of the ${n(L.tot.n)} legal persons taxed in Lugano in ${year}, ${n(L.zero.n)} (${n(lugZero, 1)}%) declared no net profit (Ticino ${n(tiZeroP, 1)}%, Switzerland ${n(chZeroP, 1)}%). They may be at a loss, breaking even or inactive; the statistics do not say which.` },
      value: lugZero, unit: "%", digits: 1, year: Number(year), area: "Lugano", kind: "derived",
      method: { it: `Persone giuridiche «senza utile netto» divise per il totale tassato, imposta federale diretta ${year}. ${unitsNote.it}`, en: `Legal persons "without net profit" divided by the total taxed, federal direct tax ${year}. ${unitsNote.en}` },
      source: [estvSrc("rows of each Ticino municipality, Typ 'Ohne Reingewinn' and 'Total', column Anzahl")],
      context: [{ label: { it: "Senza utile", en: "Without profit" }, value: L.zero.n, unit: "aziende" }, { label: { it: "Capitale proprio di queste società", en: "Equity of these companies" }, value: L.zero.equity / 1e6, unit: "mio CHF" },
        { label: { it: "Ticino", en: "Ticino" }, value: tiZeroP, unit: "%" }, { label: { it: "Svizzera", en: "Switzerland" }, value: chZeroP, unit: "%" }],
      comparison: zeroCmp, related: ["economia.utile-pg"] },
  ];
  return { stars };
}

export const IMPRESE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.zefix]: { url: "https://ld.admin.ch/query", publisher: "Ufficio federale del registro di commercio – Zefix, Indice centrale delle ditte (dati aperti LINDAS, enti attivi): risultato dell'interrogazione del 18.10.2026" },
  [F.query]: { url: "https://ld.admin.ch/query", publisher: "Interrogazione SPARQL usata per contare gli enti per sede e forma giuridica (Zefix su LINDAS)" },
  [F.estv]: { url: "https://www.estv.admin.ch/dam/fr/sd-web/hcCkKiHbJFvJ/statistik-dbst-jp-gemeinden-2022.xlsx", publisher: "Amministrazione federale delle contribuzioni (AFC) – Statistica dell'imposta federale diretta, persone giuridiche per comune, 2022" },
};
