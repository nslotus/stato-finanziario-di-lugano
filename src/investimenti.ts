// The City's open investment works at the end of 2025 (the register in the 2025 accounts, pp. 385–413): credit voted,
// spent, progress, and how long each work has been open. One star in the finance arm: credit not yet spent, with the
// works voted by 2020 that have spent under a fifth of their credit, the works over their credit, and the largest
// remaining credits. Every figure is summed here from the register rows, which the adapter checks against the
// City's printed totals (src/adapters/investments.ts).

import type { Source, Star, Text } from "./catalog";
import { readPdf } from "./adapters/pdf";
import { REGISTER_PAGES, investmentRegister, type Work } from "./adapters/investments";
import { PLAN_PAGES, investmentPlan, type PlanWork } from "./adapters/investment-plan";
import { F } from "./bilancio-funzioni";
import { BUDGET27_MSG } from "./adapters/finance";

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

  // the 2027 budget's plan for every voted work: probable spending to 31.12.2026, each year 2027–2030, 2031–2034
  const plan = await investmentPlan(readPdf, BUDGET27_MSG);
  const P = src(BUDGET27_MSG, `pp. ${PLAN_PAGES.council[0]}–${PLAN_PAGES.municipio[1]}: 'Conti investimenti 2027/2030: crediti votati', columns Credito agg., Cons. stimato, Probabile cons. al 31.12.2026, Preventivo 2027–2030, 2031-2034 (CHF thousands)`);
  const inPlan = new Map(plan.works.map((w) => [w.code, w]));
  const voted27 = plan.works.filter((w) => w.credit > 0);
  // credit that no year up to 2034 plans to spend: credit − probable to 31.12.2026 − 2027–2030 − 2031–2034
  const unscheduled = (w: PlanWork) => w.credit - w.prob26 - w.sum27_30 - w.after30;
  const unsched = voted27.filter((w) => unscheduled(w) > 50).sort((a, b) => unscheduled(b) - unscheduled(a));
  const unschedSum = unsched.reduce((t, w) => t + unscheduled(w), 0) * 1000;
  const forecastOver = voted27.filter((w) => w.estimated > w.credit).sort((a, b) => (b.estimated - b.credit) - (a.estimated - a.credit));
  const yearTotal = (f: (w: PlanWork) => number) => voted27.reduce((t, w) => t + f(w), 0) * 1000;
  const planNote = (w: Work): Text => {
    const p = inPlan.get(w.code);
    if (!p) return { it: "non è tra le opere del piano 2027", en: "not among the works in the 2027 plan" };
    const k = (v: number) => n(v / 1000, 2);
    return { it: `piano 2027: 2027–30 ${k(p.sum27_30)} · 2031–34 ${k(p.after30)} · mai previsti ${k(Math.max(0, unscheduled(p)))}`,
      en: `2027 plan: 2027–30 ${k(p.sum27_30)} · 2031–34 ${k(p.after30)} · never scheduled ${k(Math.max(0, unscheduled(p)))}` };
  };
  const tag = (name: string) => { const c = name.split(/:| - /)[0].trim(); const w = c.length >= 12 ? c : name; return w.length <= 40 ? w : w.split(" ").slice(0, 5).join(" ") + " …"; };
  const planLine = (w: Work, lang: "it" | "en") => {
    const p = inPlan.get(w.code), k = (v: number) => n(v / 1000, 2);
    if (!p) return lang === "it" ? `${tag(w.name)}: non è nel piano 2027` : `${tag(w.name)}: not in the 2027 plan`;
    const never = Math.max(0, unscheduled(p));
    return lang === "it" ? `${tag(w.name)}: 2027–30 ${k(p.sum27_30)}, 2031–34 ${k(p.after30)}${never > 0.5 ? `, mai previsti ${k(never)}` : ""}`
      : `${tag(w.name)}: 2027–30 ${k(p.sum27_30)}, 2031–34 ${k(p.after30)}${never > 0.5 ? `, never scheduled ${k(never)}` : ""}`;
  };
  const planBar = (w: PlanWork, i: number, valueK: number, k: string, note: Text) => ({ key: `${k}${i}`, label: { it: short(w.name), en: short(w.name) }, value: Number((valueK / 1000).toFixed(4)), note });

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
      it: `A fine 2025 la Città aveva ${open.length} opere d'investimento aperte, con un credito aggiornato di CHF ${n(M(credit))} mio; ne aveva spesi ${n(M(spent))}. Restano ${n(M(remaining))} mio di credito. ${idle.length} opere votate entro il ${IDLE_BY} hanno speso meno di un quinto del credito: ${n(M(idleSum))} mio fermi. ${over.length} opere hanno superato il credito, in tutto di ${n(M(overSum))} mio. Il preventivo 2027 prevede di spenderne ${n(M(yearTotal((w) => w.sum27_30)))} mio nel 2027–2030 e ${n(M(yearTotal((w) => w.after30)))} nel 2031–2034; ${n(M(unschedSum))} mio di credito votato non sono previsti in nessun anno fino al 2034, soprattutto per ${tag(unsched[0].name)} e ${tag(unsched[1].name)}.`,
      en: `At the end of 2025 the City had ${open.length} open investment works, with an updated credit of CHF ${n(M(credit))} million, of which ${n(M(spent))} was spent. ${n(M(remaining))} million of credit remains. ${idle.length} works voted by ${IDLE_BY} have spent less than a fifth of their credit: ${n(M(idleSum))} million idle. ${over.length} works have gone over their credit, by ${n(M(overSum))} million in all. The 2027 budget plans to spend ${n(M(yearTotal((w) => w.sum27_30)))} million of it in 2027–2030 and ${n(M(yearTotal((w) => w.after30)))} in 2031–2034; ${n(M(unschedSum))} million of voted credit is scheduled in no year up to 2034, mostly for ${tag(unsched[0].name)} and ${tag(unsched[1].name)}.` },
    value: Number(M(remaining).toFixed(4)), unit: "mio CHF", year: 2025, area: "Lugano", kind: "derived",
    method: {
      it: `Registro delle opere aperte nel consuntivo 2025 (pp. ${REGISTER_PAGES.from}–${REGISTER_PAGES.to}), crediti votati dal Consiglio comunale e di competenza del Municipio, letto per posizione. Credito = credito aggiornato (votato più rincari); speso = uscite al 31.12.2025; restante = credito meno speso, opera per opera, mai sotto zero. L'avanzamento è quello stampato dalla Città, «indipendentemente dall'evoluzione delle uscite» (p. 351). Ogni opera soddisfa 31.12.2024 + 2025 = 31.12.2025 e le opere sommano a ogni totale stampato; nei totali delle categorie del Municipio (${asPrinted.length} righe) la colonna «Entrate al 31.12.2024» ripete le uscite, come stampato, e non torna con la sua riga. Escluse le 2 opere dei beni patrimoniali (p. 415) e una voce di soli incassi senza credito (INV.980000). Il calendario viene dal preventivo 2027 (pp. ${PLAN_PAGES.council[0]}–${PLAN_PAGES.municipio[1]}, ${plan.works.length} opere votate, in migliaia di franchi): spesa probabile al 31.12.2026, ogni anno 2027–2030 e il resto 2031–2034; ogni riepilogo 2027–2030 è la somma dei quattro anni e le opere sommano ai ${plan.checks.totals} totali stampati, entro gli arrotondamenti. Mai previsto = credito aggiornato meno spesa probabile al 31.12.2026, meno 2027–2030, meno 2031–2034.`,
      en: `The register of open works in the 2025 accounts (pp. ${REGISTER_PAGES.from}–${REGISTER_PAGES.to}), credits voted by the Council and within the Municipio's authority, read by position. Credit = updated credit (voted plus price increases); spent = outgoings at 31.12.2025; remaining = credit minus spent, work by work, never below zero. Progress is the City's printed figure, "independently of the evolution of spending" (p. 351). Every work satisfies 31.12.2024 + 2025 = 31.12.2025, and the works add up to every printed total; in the Municipio's category totals (${asPrinted.length} rows) the column "Entrate al 31.12.2024" repeats the outgoings, as printed, and does not agree with its own row. Left out: the 2 patrimonial works (p. 415) and one income-only line without a credit (INV.980000). The schedule comes from the 2027 budget (pp. ${PLAN_PAGES.council[0]}–${PLAN_PAGES.municipio[1]}, ${plan.works.length} voted works, in thousands of francs): probable spending to 31.12.2026, each year 2027–2030 and the rest in 2031–2034; every 2027–2030 summary is the sum of its four years, and the works add up to the ${plan.checks.totals} printed totals, within rounding. Never scheduled = updated credit minus probable spending to 31.12.2026, minus 2027–2030, minus 2031–2034.` },
    source: [S, P],
    related: ["finanze.piano-investimenti", "finanze.piano-debito"],
    detail: [
      { title: { it: "Credito e speso, per anno del voto", en: "Credit and spent, by year voted" },
        chart: { type: "columns", unit: "mio CHF", color: "var(--finanze)", digits: 1, series: [
          series("c", { it: "Credito aggiornato", en: "Updated credit" }, (w) => w.credit, "budget"),
          series("s", { it: "Speso al 31.12.2025", en: "Spent to 31.12.2025" }, (w) => w.out25, "actual")] },
        note: { it: `Anno della prima risoluzione dell'opera. Tratteggio: credito; pieno: speso. Opere per anno: ${counts}.`, en: `Year of the work's first resolution. Dashed: credit; solid: spent. Works per year: ${counts}.` }, source: [S] },
      { title: { it: `Votate entro il ${IDLE_BY}, spese meno di un quinto: credito fermo`, en: `Voted by ${IDLE_BY}, under a fifth spent: credit idle` },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: idle.map((w, i) => bar(w, i, left(w), "i")) },
        note: { it: `Senza le opere in liquidazione (contrassegnate * dalla Città). Nel preventivo 2027 (mio CHF): ${idle.map((w) => planLine(w, "it")).join("; ")}.`,
          en: `Without works being closed (marked * by the City). In the 2027 budget (CHF million): ${idle.map((w) => planLine(w, "en")).join("; ")}.` }, source: [S, P] },
      { title: { it: "Quando il preventivo 2027 prevede di spendere il credito votato", en: "When the 2027 budget plans to spend the voted credit" },
        chart: { type: "columns", unit: "mio CHF", color: "var(--finanze)", digits: 1, series: [{ label: { it: "Uscite previste", en: "Planned outgoings" }, data: [
          ...(["y27", "y28", "y29", "y30"] as const).map((k, i) => ({ key: `y${i}`, label: { it: String(2027 + i), en: String(2027 + i) }, value: Number(M(yearTotal((w) => w[k])).toFixed(4)), status: "budget" as const })),
          { key: "y4", label: { it: "2031–34", en: "2031–34" }, value: Number(M(yearTotal((w) => w.after30)).toFixed(4)), status: "plan" as const },
          { key: "y5", label: { it: "mai", en: "never" }, value: Number(M(unschedSum).toFixed(4)), status: "estimate" as const }] }] },
        note: { it: `Opere votate nel preventivo 2027: ${voted27.length}. «Mai»: credito votato che nessun anno fino al 2034 prevede di spendere (calcolato qui).`, en: `Voted works in the 2027 budget: ${voted27.length}. "Never": voted credit that no year up to 2034 plans to spend (calculated here).` }, source: [P] },
      { title: { it: "Credito votato mai previsto fino al 2034", en: "Voted credit scheduled in no year up to 2034" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: unsched.slice(0, 12).map((w, i) => planBar(w, i, unscheduled(w), "u", { it: "", en: "" })) }, source: [P] },
      { title: { it: "Costo stimato oltre il credito", en: "Estimated cost above the credit" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: forecastOver.map((w, i) => planBar(w, i, w.estimated - w.credit, "e", { it: "", en: "" })) },
        note: { it: "Colonna «Cons. stimato» del preventivo 2027 meno il credito aggiornato.", en: "Column 'Cons. stimato' of the 2027 budget minus the updated credit." }, source: [P] },
      { title: { it: "Opere oltre il credito: quanto oltre", en: "Works over their credit: by how much" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 2, data: over.map((w, i) => bar(w, i, w.out25 - w.credit, "o")) }, source: [S] },
      { title: { it: "Il credito residuo più grande", en: "The largest remaining credits" },
        chart: { type: "hbars", unit: "mio CHF", color: "var(--finanze)", digits: 1, data: biggest.map((w, i) => bar(w, i, left(w), "b")) }, source: [S] },
    ],
  };
  return { stars: [star] };
}
