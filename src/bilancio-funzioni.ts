// Spending by function over time, and budget against actual (BUDGET-SOURCES.md): actual 2023 and 2024 from the canton's
// annex (TabA), actual 2025 and the 2025 and 2027 budgets from the City's functional tables. The PDF tables are read by
// column position (some numbers are split across text items); every row must satisfy revenue − costs = balance, the
// functions must add up to the printed total, and each total must match the City's department tables.

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { Datum, Detail, Source, Text } from "./catalog";
import { fail, rawPath } from "./adapters/common";
import { readPdf, type Item } from "./adapters/pdf";
import { APPENDICE } from "./adapters/sel";
import { BUDGET27_MSG } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;
export const F = { c25: "city-consuntivo-2025-messaggio.pdf", p25: "city-preventivo-2025-messaggio.pdf", sel23: "sel-2023-appendice.xlsx" };
const PAGES = { c25: [238, 239], p25: [221, 222, 223], p27: [214, 215, 216], c25dept: 233, p25dept: 21 };
export const FUNCTIONS = "0123456789".split("");
const num = (s: string) => Number(s.replace(/[’'\s]/g, "").replace(",", "."));
const close = (a: number, b: number, what: string, tol = 0.02) => { if (Math.abs(a - b) > tol) fail(`${what}: ${a} vs ${b}`); };

/** One-digit function totals of a functional table (costs, revenue, balance), with the printed total, and its two- and
 *  three-digit lines; the lines must add up to their parents. */
async function functional(file: string, pages: number[]) {
  const { items } = await readPdf(file, pages);
  const out = new Map<string, { c: number; r: number; s: number }>();
  const lines = new Map<string, { label: string; c: number; r: number; s: number; page: number }>();
  let total: { c: number; r: number; s: number } | null = null;
  for (const p of pages) {
    const its: Item[] = items[p - 1] ?? fail(`${file}: page ${p} missing`);
    const at = (w: string) => (its.find((i) => i.s === w) ?? fail(`${file} p. ${p}: heading ${w} missing`)).x;
    const [xc, xr, xs] = ["COSTI", "RICAVI", "SALDO"].map(at);
    const rows: Item[][] = [];
    for (const it of [...its].sort((a, b) => b.y - a.y || a.x - b.x)) { const r = rows.find((q) => Math.abs(q[0].y - it.y) <= 2); r ? r.push(it) : rows.push([it]); }
    for (const r of rows) {
      r.sort((a, b) => a.x - b.x);
      const label = r.filter((i) => i.x < xc - 20).map((i) => i.s).join(" ").trim();
      const fn = label.match(/^(\d) [A-ZÀ-Ù]/), isTotal = /TOTALE/.test(label), sub = label.match(/^(\d{2,3}) (\S.*)$/);
      if (!fn && !isTotal && !sub) continue;
      // pieces of a number split across items fall in the same column; joined, they must satisfy the row's arithmetic
      const parts = { c: "", r: "", s: "" };
      for (const i of r.filter((q) => q.x >= xc - 20)) parts[i.x < (xc + xr) / 2 + 10 ? "c" : i.x < (xr + xs) / 2 + 10 ? "r" : "s"] += i.s;
      const v = { c: num(parts.c || "0"), r: num(parts.r || "0"), s: num(parts.s || "0") };
      close(v.r - v.c, v.s, `${file} p. ${p}, row '${label}': revenue − costs`);
      if (isTotal) total ??= v; else if (fn) { if (!out.has(fn[1])) out.set(fn[1], v); } else if (!lines.has(sub![1])) lines.set(sub![1], { label: sub![2].replace(/\s+/g, " ").trim(), ...v, page: p });
    }
  }
  if (!total) fail(`${file}: total row missing`);
  if (out.size !== 10) fail(`${file}: ${out.size} functions found`);
  close([...out.values()].reduce((t, v) => t + v.c, 0), total!.c, `${file}: functions add up to the total`);
  // hierarchy: three-digit lines add up to their two-digit row, two-digit rows to their function (costs)
  const codes = [...lines.keys()];
  for (const c2 of codes.filter((c) => c.length === 2)) {
    const kids = codes.filter((c) => c.length === 3 && c.startsWith(c2));
    if (kids.length) close(kids.reduce((t, c) => t + lines.get(c)!.c, 0), lines.get(c2)!.c, `${file}: lines ${c2}x add up to ${c2}`, 0.05);
  }
  for (const f of FUNCTIONS) close(codes.filter((c) => c.length === 2 && c[0] === f).reduce((t, c) => t + lines.get(c)!.c, 0), out.get(f)!.c, `${file}: two-digit rows add up to function ${f}`, 0.05);
  for (const c of codes.filter((c) => c.length === 3)) if (!lines.has(c.slice(0, 2))) fail(`${file}: line ${c} has no two-digit parent`);
  return { fn: out, total: total!, lines };
}

/** One-digit function totals of the canton annex (TabA spending, sum of the two-digit columns), CHF million. */
function canton(file: string) {
  const a = XLSX.utils.sheet_to_json<(string | number | null)[]>(XLSX.read(readFileSync(rawPath(file))).Sheets["TabA"] ?? fail(`${file}: TabA missing`), { header: 1, defval: null });
  const head = a[1].map((h) => String(h ?? "").trim()), lug = a.find((r) => r[0] === "Lugano") ?? fail(`${file}: Lugano missing`);
  const out = new Map<string, number>(FUNCTIONS.map((f) => [f, 0]));
  head.forEach((h, i) => { if (/^\d\d$/.test(h)) out.set(h[0], out.get(h[0])! + (Number(lug[i]) || 0) / 1000); });
  return out;
}

export async function bilancioFunzioni(src: Src, ledger2024: Map<string, number>) {
  const c23 = canton(F.sel23), c24 = canton(APPENDICE);
  for (const f of FUNCTIONS) close(c24.get(f)!, ledger2024.get(`f${f}`)!, `function ${f} 2024: TabA vs the ledger chapter`, 0.005);
  const c25 = await functional(F.c25, PAGES.c25), p25 = await functional(F.p25, PAGES.p25), p27 = await functional(BUDGET27_MSG, PAGES.p27);

  // the totals must equal the City's department tables: actual 2025 (final accounts) and the 2025 budget as proposed
  const dept25 = (await readPdf(F.c25, [PAGES.c25dept])).pages[PAGES.c25dept - 1];
  const M = String.raw`\d{1,3}(?:’\d{3})*\.\d\d`;
  const d25 = dept25.match(new RegExp(`TOTALE SPESE E RICAVI (${M}) (${M}) (${M}) (${M}) (${M}) (${M})`)) ?? fail(`${F.c25} p. ${PAGES.c25dept}: totals row`);
  close(c25.total.c, num(d25[1]), "2025 actual: functional table vs department table");
  const approved25 = num(d25[3]), actual24 = num(d25[5]);
  close(actual24 / 1e6, [...c24.values()].reduce((t, v) => t + v, 0), "2024 actual: City department table vs canton TabA", 0.01);
  const prop = (await readPdf(F.p25, [PAGES.p25dept])).pages[PAGES.p25dept - 1];
  const pTot = prop.match(new RegExp(`TOTALE (${M}) (${M}) (${M})`)) ?? fail(`${F.p25} p. ${PAGES.p25dept}: totals row`);
  close(p25.total.c, num(pTot[1]), "2025 budget: functional table vs department table (proposal)");
  // the only change between proposal and approved budget is in one department; find it and say so
  const DEPTS = ["Istituzioni", "Consulenza e gestione", "Immobili", "Sicurezza e spazi urbani", "Formazione, Socialità e Sostegno", "Cultura, Sport ed Eventi", "Sviluppo territoriale"];
  const deptRow = (t: string, d: string, k: number) => num((t.match(new RegExp(`${d} (${M}) (${M})(?: (${M}))?(?: (${M}))?`)) ?? fail(`department row ${d}`))[k]);
  const amend = DEPTS.map((d) => ({ d, diff: deptRow(dept25, d, 3) - deptRow(prop, d, 1) })).filter((x) => Math.abs(x.diff) > 0.005);
  close(amend.reduce((t, x) => t + x.diff, 0), approved25 - p25.total.c, "council amendments: departments vs totals");

  const mio = (v: number) => v / 1e6;
  const series = new Map(FUNCTIONS.map((f) => {
    const v = { c23: c23.get(f)!, c24: c24.get(f)!, p25: mio(p25.fn.get(f)!.c), c25: mio(c25.fn.get(f)!.c), p27: mio(p27.fn.get(f)!.c) };
    return [`f${f}`, { ...v, diff: v.c25 - v.p25, pct: ((v.c25 - v.p25) / v.p25) * 100 }];
  }));
  const amendText: Text = amend.length
    ? { it: `Il preventivo per funzione è quello proposto dal Municipio; il Consiglio comunale lo ha modificato di ${amend.map((x) => `CHF ${(x.diff / 1000).toLocaleString("de-CH")} mila nel dicastero ${x.d}`).join(", ")}, che la tabella per funzione non ripartisce.`,
      en: `The budget by function is the Municipio's proposal; the Council changed it by ${amend.map((x) => `CHF ${(x.diff / 1000).toLocaleString("de-CH")} thousand in the department ${x.d}`).join(", ")}, which the functional table does not allocate.` }
    : { it: "Il preventivo per funzione coincide con quello approvato.", en: "The budget by function equals the approved budget." };
  const source = [src(F.sel23, "sheet TabA, row 'Lugano', two-digit columns summed by function (2023)"), src(APPENDICE, "sheet TabA, row 'Lugano', two-digit columns summed by function (2024)"),
    src(F.p25, `pp. ${PAGES.p25.join("–")}: 'Preventivo 2025 Gestione corrente – ripartizione funzionale', column COSTI`), src(F.c25, `pp. ${PAGES.c25.join("–")}: 'Consuntivo 2025 Gestione corrente – Ripartizione funzionale', column COSTI`),
    src(BUDGET27_MSG, `pp. ${PAGES.p27.join("–")}: 'Preventivo 2027 Gestione corrente – Ripartizione funzionale', column COSTI`)];
  const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const detail = (key: string, color: string): Detail => {
    const s = series.get(key)!;
    const yr = (y: number, it: string, en: string) => ({ it: `${y}${it}`, en: `${y}${en}` });
    return {
      title: { it: "Spesa per anno: consuntivo e preventivo", en: "Spending by year: actual and budget" },
      chart: { type: "columns", unit: "mio CHF", digits: 1, color, series: [
        { label: { it: "Consuntivo", en: "Actual" }, data: [
          { key: "a2023", label: yr(2023, "", ""), value: s.c23, status: "actual" }, { key: "a2024", label: yr(2024, "", ""), value: s.c24, status: "actual" },
          { key: "a2025", label: yr(2025, "", ""), value: s.c25, status: "actual" }] as Datum[] },
        { label: { it: "Preventivo", en: "Budget" }, data: [
          { key: "a2025", label: yr(2025, "", ""), value: s.p25, status: "budget" }, { key: "a2027", label: yr(2027, "", ""), value: s.p27, status: "budget" }] as Datum[] }] },
      note: { it: `Nel 2025 la spesa è stata di ${sign(s.diff)} milioni (${sign(s.pct)}%) rispetto al preventivo. Sopra o sotto il preventivo non è di per sé un bene o un male: può essere un risparmio, un lavoro non fatto o un bisogno in crescita. ${amendText.it}`,
        en: `In 2025 spending was CHF ${sign(s.diff)} million (${sign(s.pct)}%) against the budget. Above or below budget is not good or bad by itself: it can be a saving, work not done, or a growing need. ${amendText.en}` },
      source,
    };
  };
  // budget against actual 2025 for every leaf line (three digits, or two digits without children), matched by code
  const leaves = (m: Map<string, { label: string; c: number }>) => [...m.keys()].filter((c) => ![...m.keys()].some((k) => k !== c && k.startsWith(c)));
  const codes25 = [...new Set([...leaves(c25.lines), ...leaves(p25.lines)])].sort();
  const lines25 = codes25.map((code) => {
    const a = c25.lines.get(code), b = p25.lines.get(code);
    if (a && b && a.label.toLowerCase() !== b.label.toLowerCase()) console.log(`  note: line ${code} label differs: '${b.label}' (budget) vs '${a.label}' (actual)`);
    return { code, label: (a ?? b)!.label, p25: b ? mio(b.c) : 0, c25: a ? mio(a.c) : 0, pagesP: b?.page ?? null, pagesC: a?.page ?? null };
  });
  for (const f of FUNCTIONS) {
    const inF = lines25.filter((l) => l.code[0] === f);
    close(inF.reduce((t, l) => t + l.c25, 0), mio(c25.fn.get(f)!.c), `2025 actual: lines add up to function ${f}`, 0.0001);
    close(inF.reduce((t, l) => t + l.p25, 0), mio(p25.fn.get(f)!.c), `2025 budget: lines add up to function ${f}`, 0.0001);
  }
  // the two-digit groups the lines belong to, matched by code
  const codes2 = [...new Set([...c25.lines.keys(), ...p25.lines.keys()].filter((c) => c.length === 2))].sort();
  const groups25 = codes2.map((code) => { const a = c25.lines.get(code), b = p25.lines.get(code); return { code, label: (a ?? b)!.label, p25: b ? mio(b.c) : 0, c25: a ? mio(a.c) : 0 }; });
  for (const g of groups25) {
    const kids = lines25.filter((l) => l.code.startsWith(g.code));
    if (!kids.length) fail(`2025 group ${g.code} has no lines`);
    close(kids.reduce((t, l) => t + l.c25, 0), g.c25, `2025 actual: lines add up to group ${g.code}`, 0.0001);
    close(kids.reduce((t, l) => t + l.p25, 0), g.p25, `2025 budget: lines add up to group ${g.code}`, 0.0001);
  }
  const only = (x: "p25" | "c25") => lines25.filter((l) => (x === "p25" ? l.c25 === 0 && l.p25 !== 0 : l.p25 === 0 && l.c25 !== 0)).map((l) => l.code);
  console.log(`2025 lines: ${lines25.length} (${only("p25").length} budget only: ${only("p25").join(", ") || "none"}; ${only("c25").length} actual only: ${only("c25").join(", ") || "none"})`);
  const linesSource = [src(F.p25, `pp. ${PAGES.p25.join("–")}: 'Preventivo 2025 Gestione corrente – ripartizione funzionale a 3 cifre', column COSTI, row by code`),
    src(F.c25, `pp. ${PAGES.c25.join("–")}: 'Consuntivo 2025 Gestione corrente – Ripartizione funzionale a 3 cifre', column COSTI, row by code`)];
  const totals = { c23: [...c23.values()].reduce((t, v) => t + v, 0), c24: mio(actual24), p25: mio(p25.total.c), approved25: mio(approved25), c25: mio(c25.total.c), p27: mio(p27.total.c) };
  console.log(`functions by year: ${FUNCTIONS.map((f) => { const s = series.get(`f${f}`)!; return `${f} ${sign(s.pct)}%`; }).join(" · ")} · total ${totals.c25.toFixed(2)} vs ${totals.p25.toFixed(2)}`);
  return { series, detail, totals, amendText, source, lines25, groups25, linesSource };
}

export const BILANCIO_FUNZIONI_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.c25]: { url: "https://www.lugano.ch/dam/jcr:ba72012d-214d-44e7-b29c-f94db736fe98/20260423-consuntivo-2025-messaggio.pdf", publisher: "Città di Lugano, Messaggio municipale no. 12700, Consuntivo 2025 (23 aprile 2026)" },
  [F.p25]: { url: "https://www.lugano.ch/dam/jcr:e41cc168-7d55-48fe-ae68-48517ff418aa/messaggio-preventivo-2025.pdf", publisher: "Città di Lugano, Messaggio municipale no. 12068, Preventivo 2025" },
  [F.sel23]: { url: "https://www4.ti.ch/fileadmin/DI/DI_DI/SEL/Comuni/DatiFinanziari/StatisticaFinanziaria/2023-appendice.xlsx", publisher: "Cantone Ticino, Sezione degli enti locali – statistica finanziaria dei comuni 2023, appendice" },
};
