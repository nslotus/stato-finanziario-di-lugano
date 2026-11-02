// The City's open investment works at the end of 2025 (the register in the 2025 accounts, pp. 385–413): credit voted,
// spent, progress, and how long each work has been open. One star in the finance arm: credit not yet spent, with the
// works voted by 2020 that have spent under a fifth of their credit, the works over their credit, and the largest
// remaining credits. Every figure is summed here from the register rows, which the adapter checks against the
// City's printed totals (src/adapters/investments.ts).

import type { Source, Star, Text } from "./catalog";
import { readPdf } from "./adapters/pdf";
import { REGISTER_PAGES, investmentRegister, type Work } from "./adapters/investments";
import { F } from "./bilancio-funzioni";

type Src = (file: string, locator: string) => Source;
const M = (v: number) => v / 1e6;
const n = (v: number, d = 1) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (a: number, b: number) => `${Math.round((100 * a) / b)}%`;
/** Work names run long: cut at a word near 70 characters. */
const short = (s: string) => (s.length <= 72 ? s : s.slice(0, s.lastIndexOf(" ", 70)) + " …");
const IDLE_BY = 2020, IDLE_SHARE = 0.2;

export async function investimenti(src: Src) {
  const { works, asPrinted } = await investmentRegister(readPdf, F.c25);
  const S = src(F.c25, `pp. ${REGISTER_PAGES.from}–${REGISTER_PAGES.to}: register of open works ('Situazione investimenti amministrativi 2025'), columns Credito aggiornato, Sit. Lav. %, Uscite al 31.12.2025`);
  const voted = (w: Work) => Math.min(...w.resolutions.map((r) => Number(r.date.slice(6))));
  const open = works.filter((w) => w.credit > 0 && w.resolutions.length);
  const credit = open.reduce((t, w) => t + w.credit, 0), spent = open.reduce((t, w) => t + w.out25, 0);
  const left = (w: Work) => Math.max(0, w.credit - w.out25);
  const remaining = open.reduce((t, w) => t + left(w), 0);
  const idle = open.filter((w) => voted(w) <= IDLE_BY && w.out25 < IDLE_SHARE * w.credit && !w.liquidation).sort((a, b) => left(b) - left(a));
  const idleSum = idle.reduce((t, w) => t + left(w), 0);
  const over = open.filter((w) => w.out25 > w.credit).sort((a, b) => (b.out25 - b.credit) - (a.out25 - a.credit));
  const overSum = over.reduce((t, w) => t + w.out25 - w.credit, 0);
  const biggest = [...open].sort((a, b) => left(b) - left(a)).slice(0, 12);

  const note = (w: Work): Text => ({
    it: `votata ${voted(w)} · credito ${n(M(w.credit), 2)} · speso ${pct(w.out25, w.credit)} · avanzamento ${w.progress ?? "–"}%`,
    en: `voted ${voted(w)} · credit ${n(M(w.credit), 2)} · spent ${pct(w.out25, w.credit)} · progress ${w.progress ?? "–"}%` });
  const bar = (w: Work, i: number, value: number, k: string) => ({ key: `${k}${i}`, label: { it: short(w.name), en: short(w.name) }, value: Number(M(value).toFixed(4)), note: note(w) });

  // credit and spending by the year of the first Council or Municipio resolution
  const bands = [{ k: "≤’10", lo: 0, hi: 2010 }, { k: "’11–15", lo: 2011, hi: 2015 },
    ...Array.from({ length: 10 }, (_, i) => ({ k: `’${16 + i}`, lo: 2016 + i, hi: 2016 + i }))];
  const inBand = (b: { lo: number; hi: number }) => open.filter((w) => voted(w) >= b.lo && voted(w) <= b.hi);
  // credit dashed (an authorised amount), spent solid (actual), as on the page's other charts
  const series = (key: string, label: Text, f: (w: Work) => number, status: "budget" | "actual") => ({ label,
    data: bands.map((b) => ({ key: `${key}${b.k}`, label: { it: b.k, en: b.k }, value: Number(M(inBand(b).reduce((t, w) => t + f(w), 0)).toFixed(4)), status })) });
  const counts = bands.map((b) => `${b.k} ${inBand(b).length}`).join(", ");

  const star: Star = {
    id: "finanze.opere", constellation: "finanze",
    label: { it: "Credito d'investimento non ancora speso", en: "Investment credit not yet spent" },
    about: {
      it: `A fine 2025 la Città aveva ${open.length} opere d'investimento aperte, con un credito aggiornato di CHF ${n(M(credit))} mio; ne aveva spesi ${n(M(spent))}. Restano ${n(M(remaining))} mio di credito. ${idle.length} opere votate entro il ${IDLE_BY} hanno speso meno di un quinto del credito: ${n(M(idleSum))} mio fermi. ${over.length} opere hanno superato il credito, in tutto di ${n(M(overSum))} mio.`,
      en: `At the end of 2025 the City had ${open.length} open investment works, with an updated credit of CHF ${n(M(credit))} million, of which ${n(M(spent))} was spent. ${n(M(remaining))} million of credit remains. ${idle.length} works voted by ${IDLE_BY} have spent less than a fifth of their credit: ${n(M(idleSum))} million idle. ${over.length} works have gone over their credit, by ${n(M(overSum))} million in all.` },
    value: Number(M(remaining).toFixed(4)), unit: "mio CHF", year: 2025, area: "Lugano", kind: "derived",
    method: {
      it: `Registro delle opere aperte nel consuntivo 2025 (pp. ${REGISTER_PAGES.from}–${REGISTER_PAGES.to}), crediti votati dal Consiglio comunale e di competenza del Municipio, letto per posizione. Credito = credito aggiornato (votato più rincari); speso = uscite al 31.12.2025; restante = credito meno speso, opera per opera, mai sotto zero. L'avanzamento è quello stampato dalla Città, «indipendentemente dall'evoluzione delle uscite» (p. 351). Ogni opera soddisfa 31.12.2024 + 2025 = 31.12.2025 e le opere sommano a ogni totale stampato; nei totali delle categorie del Municipio (${asPrinted.length} righe) la colonna «Entrate al 31.12.2024» ripete le uscite, come stampato, e non torna con la sua riga. Escluse le 2 opere dei beni patrimoniali (p. 415) e una voce di soli incassi senza credito (INV.980000).`,
      en: `The register of open works in the 2025 accounts (pp. ${REGISTER_PAGES.from}–${REGISTER_PAGES.to}), credits voted by the Council and within the Municipio's authority, read by position. Credit = updated credit (voted plus price increases); spent = outgoings at 31.12.2025; remaining = credit minus spent, work by work, never below zero. Progress is the City's printed figure, "independently of the evolution of spending" (p. 351). Every work satisfies 31.12.2024 + 2025 = 31.12.2025, and the works add up to every printed total; in the Municipio's category totals (${asPrinted.length} rows) the column "Entrate al 31.12.2024" repeats the outgoings, as printed, and does not agree with its own row. Left out: the 2 patrimonial works (p. 415) and one income-only line without a credit (INV.980000).` },
    source: [S],
    related: ["finanze.piano-investimenti", "finanze.piano-debito"],
    detail: [
      { title: { it: "Credito e speso, per anno del voto", en: "Credit and spent, by year voted" },
        chart: { type: "columns", unit: "mio CHF", color: "var(--finanze)", digits: 1, series: [
          series("c", { it: "Credito aggiornato", en: "Updated credit" }, (w) => w.credit, "budget"),
          series("s", { it: "Speso al 31.12.2025", en: "Spent to 31.12.2025" }, (w) => w.out25, "actual")] },
        note: { it: `Anno della prima risoluzione dell'opera. Tratteggio: credito; pieno: speso. Opere per anno: ${counts}.`, en: `Year of the work's first resolution. Dashed: credit; solid: spent. Works per year: ${counts}.` }, source: [S] },
      { title: { it: `Votate entro il ${IDLE_BY}, spese meno di un quinto: credito fermo`, en: `Voted by ${IDLE_BY}, under a fifth spent: credit idle` },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: idle.map((w, i) => bar(w, i, left(w), "i")) },
        note: { it: "Senza le opere in liquidazione (contrassegnate * dalla Città).", en: "Without works being closed (marked * by the City)." }, source: [S] },
      { title: { it: "Opere oltre il credito: quanto oltre", en: "Works over their credit: by how much" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: over.map((w, i) => bar(w, i, w.out25 - w.credit, "o")) }, source: [S] },
      { title: { it: "Il credito residuo più grande", en: "The largest remaining credits" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 1, data: biggest.map((w, i) => bar(w, i, left(w), "b")) }, source: [S] },
    ],
  };
  return { stars: [star] };
}
