// Finance for the budget sun and the Ledger.
//   canton accounts 2024 (allegato): tab9e spending by function 0–9, tab9b revenue by type, tab9d taxes, tab8 multipliers
//   Dati di Lugano @8c1fd28 (pinned): city figures from the city's PDFs, debt profile, canton indicators with ratings
//   budget 2026 release (PDF): tax multipliers for 2026, read by phrase match
// City figures marked "review" are used only if METHODOLOGY.md of Dati di Lugano records a hand check.

import pdf from "pdf-parse/lib/pdf-parse.js";
import { readFileSync } from "node:fs";
import { fail, norm, num, rawPath, sheet, type Row } from "./common";
import { matcher, type Municipality } from "./municipalities";
import { ALLEGATO } from "./sel";
import { firstPages, readPdf } from "./pdf";

export const PIN = "8c1fd28";
export const CITY_PIN = "61e3dbe"; // city figures with the 2027 budget (2024–2026 unchanged from 8c1fd28)
export const CITY_FIGURES = `dati-di-lugano@${CITY_PIN}-city-figures.json`;
export const DEBT_PROFILE = `dati-di-lugano@${PIN}-debt-profile.json`;
export const INDICATORS = `dati-di-lugano@${PIN}-lugano-indicators.json`;
export const BUDGET_PDF = "city-preventivo-2026-comunicato.pdf";
export const BUDGET27_PDF = "city-preventivo-2027-comunicato.pdf";
export const BUDGET27_SLIDES = "city-preventivo-2027-slides.pdf";
export const BUDGET27_MSG = "city-preventivo-2027-messaggio.pdf";
export const BVA_PIN = "6627e5f";
export const BUDGET_VS_ACTUAL = `dati-di-lugano@${BVA_PIN}-budget-vs-actual.json`;

/** Budget vs actual rows (CHF) read from the city's recap tables; each row already passed actual − budget = printed difference. */
export function budgetVsActual() {
  const j = JSON.parse(readFileSync(rawPath(BUDGET_VS_ACTUAL), "utf8")) as { decks: { year: number; rows: { key: string; label: { it: string; en: string };
    actualCHF: number; budgetCHF: number; differenceCHF: number; page: number | null; checks: { differenceAddsUp: boolean } }[] }[] };
  for (const d of j.decks) for (const r of d.rows) {
    if (!r.checks.differenceAddsUp || Math.abs(r.actualCHF - r.budgetCHF - r.differenceCHF) > 0.02) fail(`budget vs actual ${d.year} ${r.key}: difference does not add up`);
  }
  return (year: number, key: string) => {
    const r = j.decks.find((d) => d.year === year)?.rows.find((x) => x.key === key) ?? fail(`budget vs actual: no ${key} for ${year}`);
    return { ...r, actual: r.actualCHF / 1e6, budget: r.budgetCHF / 1e6, diff: r.differenceCHF / 1e6 };
  };
}
export const BVA_ROWS = ["risultatoTotaleEsercizio", "ricaviOperativi", "speseOperative", "risultatoOperativo", "autofinanziamento",
  "usciteInvestimenti", "entrateInvestimenti", "onereNettoInvestimenti", "risultatoGlobale"];

/** Review-status figures that Dati di Lugano's METHODOLOGY.md lists as checked by hand against the PDF. */
const HAND_CHECKED = new Set([
  "consuntivo:2024:onereNettoInvestimenti", "consuntivo:2025:risultatoTotaleEsercizio", "consuntivo:2025:onereNettoInvestimenti",
  "consuntivo:2025:debitoLordoFineAnno", "consuntivo:2025:liquiditaFineAnno", "preventivo:2026:debitoDopoInvestimenti",
]);

const isRow = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d)/i.test(norm(r[0])) && r.slice(1).some((c) => num(c) !== null);
const clean = (h: unknown) => String(h ?? "").replace(/^\d+\s*\n?/, "").replace(/(\p{L})-\s*\n?(\p{L})/gu, "$1$2").replace(/\s+/g, " ").trim();

export interface FunctionSplit { code: number; label: string }

export function finance(register: Municipality[]) {
  const match = matcher(register);

  // spending by function 0–9 (tab9e, "Spese" rows; name on the Spese row)
  const t9e = sheet(ALLEGATO, "tab9e");
  const fcols = t9e[1].map((h, i) => [i, String(h ?? "").match(/^(\d)\b/)?.[1]] as const).filter(([, c]) => c !== undefined);
  if (fcols.length !== 10) fail(`tab9e: expected 10 function columns, found ${fcols.length}`);
  const functions: FunctionSplit[] = fcols.map(([i, c]) => ({ code: Number(c), label: clean(t9e[1][i]) }));
  const spend = new Map<number, number[]>();
  for (const r of t9e) if (r[0] === "Spese" && typeof r[1] === "string" && !/^totale/i.test(norm(r[1]))) {
    spend.set(match(r[1], "tab9e").bfs, fcols.map(([i]) => num(r[i]) ?? fail(`tab9e ${r[1]}: missing value`)));
  }
  if (spend.size !== 106) fail(`tab9e: ${spend.size} municipalities`);

  // taxes from individuals (400) and companies (401), every municipality (tab9d)
  const t9d = sheet(ALLEGATO, "tab9d");
  const i400 = t9d[1].findIndex((h) => /^400\b/.test(String(h ?? ""))), i401 = t9d[1].findIndex((h) => /^401\b/.test(String(h ?? "")));
  if (i400 < 0 || i401 < 0) fail("tab9d: 400/401 not found");
  const taxes = new Map<number, { pf: number; pg: number }>();
  for (const r of t9d.slice(2)) if (isRow(r)) taxes.set(match(r[0], "tab9d").bfs, { pf: num(r[i400]) ?? 0, pg: num(r[i401]) ?? 0 });

  // Lugano's revenue by type (tab9b), excluding pass-through (47) and internal credits (49)
  const t9b = sheet(ALLEGATO, "tab9b");
  const lug9b = t9b.find((r) => isRow(r) && match(r[0], "tab9b").bfs === 5192) ?? fail("tab9b: Lugano");
  const revenue = t9b[1].map((h, i) => ({ i, code: String(h ?? "").match(/^(\d\d)\b/)?.[1], label: clean(h) }))
    .filter((c) => c.code && !["47", "49"].includes(c.code)).map((c) => ({ code: c.code!, label: c.label, value: num(lug9b[c.i]) ?? 0 }));

  // tax multipliers 2025 (tab8) and 2026 (budget release, phrase match)
  const t8 = sheet(ALLEGATO, "tab8");
  const lug8 = t8.find((r) => isRow(r) && match(r[0], "tab8").bfs === 5192) ?? fail("tab8: Lugano");
  const mp2025 = { pf: num(lug8[2]) ?? fail("tab8 MP PF"), pg: num(lug8[3]) ?? fail("tab8 MP PG") };

  // functional sums must equal the total in tab9a ("Totale spese") for Lugano
  const t9a = sheet(ALLEGATO, "tab9a");
  const iTot = t9a[1].findIndex((h) => /totale/i.test(String(h ?? "")));
  const lug9a = t9a.find((r) => isRow(r) && match(r[0], "tab9a").bfs === 5192) ?? fail("tab9a: Lugano");
  const lugSum = spend.get(5192)!.reduce((s, v) => s + v, 0);
  if (Math.abs(lugSum - (num(lug9a[iTot]) ?? NaN)) > 1) fail(`Lugano: functions sum ${lugSum.toFixed(1)} != tab9a total ${lug9a[iTot]}`);

  return { functions, spend, taxes, revenue, mp2025 };
}

export async function budgetMultipliers() {
  const text = (await pdf(readFileSync(rawPath(BUDGET_PDF)))).text.replace(/\s+/g, " ");
  const pf = text.match(/persone fisiche con moltiplicatore all[’']\s?(\d{2})%/), pg = text.match(/persone giuridiche con moltiplicatore all[’']\s?(\d{2})%/);
  if (!pf || !pg) fail("budget 2026 release: multiplier phrases not found");
  return { pf: Number(pf[1]), pg: Number(pg[1]), quote: `${pf[0]} … ${pg[0]}` };
}

/** Page texts (whitespace collapsed); `max` reads only the first pages of long documents. */
async function pages(file: string, max = 0) {
  const { pages: p } = await readPdf(file, max ? firstPages(max) : undefined);
  return Array.from(p, (s) => s ?? "");
}
const chf = (s: string) => Number(s.replace(/['’\s]/g, ""));

/** Phrases from the 2027 budget publication, each matched literally and located by page. */
export async function budget2027Phrases() {
  const rel = (await pdf(readFileSync(rawPath(BUDGET27_PDF)))).text.replace(/\s+/g, " ");
  const mp = rel.match(/moltiplicatori d[’']imposta: (\d{2})% per le persone fisiche e (\d{2})% per le persone giuridiche/);
  if (!mp) fail("budget 2027 release: multiplier phrase not found");
  const slides = await pages(BUDGET27_SLIDES);
  const iOut = slides.findIndex((p) => /Il risultato totale di esercizio è atteso in territorio positivo/.test(p));
  if (iOut < 0) fail("budget 2027 slides: 2026 outlook phrase not found");
  const msg = await pages(BUDGET27_MSG, 40);
  // table columns: Preventivo 2027 | Preventivo 2026 | Differenza | % | Consuntivo 2025 | …
  const re = /3401 Interessi passivi per debiti a breve e lungo termine ([\d']+\.\d{2}) ([\d']+\.\d{2}) (-?[\d']+\.\d{2}) -?[\d.]+% ([\d']+\.\d{2})/;
  const iInt = msg.findIndex((p) => re.test(p));
  if (iInt < 0) fail("budget 2027 message: account 3401 row not found");
  const m = msg[iInt].match(re)!;
  const int = { p2027: chf(m[1]) / 1e6, p2026: chf(m[2]) / 1e6, c2025: chf(m[4]) / 1e6, page: iInt + 1, quote: m[0] };
  if (Math.abs(int.p2027 - int.p2026 - chf(m[3]) / 1e6) > 0.00001) fail("account 3401: 2027 − 2026 != printed difference");
  // the 2026 budget's self-financing and net investment as the 2027 message restates them (the 2026 release says 263.5)
  const reInv = /Nel 2026, questo rapporto era di CHF ([\d.]+) mio di autofinanziamento su CHF ([\d.]+) mio di investimenti netti \(([\d.]+)%\)/;
  const flat = msg.map((p) => p.replace(/\s+/g, " "));
  const iInv = flat.findIndex((p) => reInv.test(p));
  if (iInv < 0) fail("budget 2027 message: the 2026 self-financing and net investment phrase not found");
  const mi = flat[iInv].match(reInv)!;
  const inv2026 = { self: Number(mi[1]), net: Number(mi[2]), page: iInv + 1, quote: mi[0] };
  if (Math.abs((inv2026.self / inv2026.net) * 100 - Number(mi[3])) > 0.05) fail("budget 2027 message: 2026 self-financing ratio does not recompute");
  return { pf: Number(mp[1]), pg: Number(mp[2]), mpQuote: mp[0], outlookPage: iOut + 1, interest3401: int, inv2026 };
}

type CityFigure = { valueCHF: number | null; status: string };
export function cityFigures() {
  const c = JSON.parse(readFileSync(rawPath(CITY_FIGURES), "utf8")) as { results: { kind: string; year: number; source: string; figures: Record<string, CityFigure> }[] };
  return (kind: "consuntivo" | "preventivo", year: number, key: string) => {
    const r = c.results.find((x) => x.kind === kind && x.year === year) ?? fail(`city figures: no ${kind} ${year}`);
    const f = r.figures[key] ?? fail(`city figures: ${kind} ${year} has no ${key}`);
    if (f.valueCHF === null) fail(`city figures: ${kind} ${year} ${key} is empty`);
    if (f.status !== "accepted" && !HAND_CHECKED.has(`${kind}:${year}:${key}`)) fail(`city figures: ${kind} ${year} ${key} is "${f.status}" and not hand-checked`);
    return { value: f.valueCHF! / 1e6, status: f.status, source: r.source };
  };
}

export const debtProfile = () => JSON.parse(readFileSync(rawPath(DEBT_PROFILE), "utf8"));
export const indicators = () => JSON.parse(readFileSync(rawPath(INDICATORS), "utf8"));
