// The debt and investment outlook (OUTLOOK-SOURCES.md): the City's financial plan 2026–2033 (MM 12521), read from its
// recap (p. 3–4, without asset sales), the debt table (p. 15), the investment plan by category (p. 19) and the list of
// assets to sell (p. 5–6), with the 2027 budget's comparison against the plan. Checks: net investment = gross − revenue;
// global result = self-financing − net investment; self-financing ratio = self-financing / net investment; the change in
// debt each year = −global result − asset proceeds (± a listed adjustment); the 22 assets add up to the yearly proceeds;
// the categories add up to the investment totals.

import type { Datum, Source, Star, Text } from "./catalog";
import { fail } from "./adapters/common";
import { readPdf } from "./adapters/pdf";
import { BUDGET27_MSG } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;
export const F = { pf: "city-piano-finanziario-2026-2033.pdf" };
const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
const n = (v: number, d = 1) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const FC = "var(--finanze)";
const close = (a: number, b: number, what: string, tol = 1.01) => { if (Math.abs(a - b) > tol) fail(`${what}: ${a} vs ${b}`); };
/** Rejoin numbers the PDF split ("287’87 5 ’000", "68’33 9’000", "54’024 ’000") and attach minus signs ("- 299’418’854"). */
const tidy = (t: string, minus = true) => {
  let s = t.replace(/\s+/g, " ").replace(/(\d) ’/g, "$1’").replace(/’(\d{1,2}) (\d)/g, "’$1$2");
  if (minus) s = s.replace(/- (\d)/g, "-$1");
  return s;
};
const money = (s: string) => (s === "-" ? 0 : Number(s.replace(/’/g, "")));
const TOK = /-?\d{1,3}(?:’\d{3})*(?:\.\d+)?%?|(?<=\s|^)-(?=\s|$)/g;
/** The k values that follow a row label (the first occurrence after `from`). */
function row(text: string, label: string, k: number, from = 0) {
  const i = text.indexOf(label, from);
  if (i < 0) fail(`${F.pf}: row '${label}' not found`);
  const toks = text.slice(i + label.length).match(TOK) ?? [];
  if (toks.length < k) fail(`${F.pf}: row '${label}' has ${toks.length} values`);
  return { at: i, v: toks.slice(0, k).map((x) => money(x.replace("%", ""))) };
}

export async function pianoFinanziario(src: Src) {
  const { pages } = await readPdf(F.pf);
  const p = (k: number) => pages[k - 1] ?? fail(`${F.pf}: page ${k} missing`);

  // ---- recap without asset sales: 2026–2029 on p. 3, 2030–2033 on p. 4
  const recap = (label: string, k = 4) => [...row(tidy(p(3)), label, k).v, ...row(tidy(p(4)).slice(tidy(p(4)).indexOf("2030 2031 2032 2033")), label, k).v];
  const gross = recap("Uscite per investimenti"), inrev = recap("Entrate per investimenti"), net = recap("Onere netto per investimenti");
  const selfFin = recap("Autofinanziamento"), global = recap("Risultato globale"), result = recap("Risultato totale d'esercizio");
  // the measures row is empty in 2026–2027: its values belong to the last years of each block
  const measRow = (t: string) => { const r = t.slice(t.indexOf("Misure di risanamento decisioni 28.09.2025") + 43, t.indexOf("Risultato ordinario", t.indexOf("Misure di risanamento"))).match(TOK) ?? []; return r.map(money); };
  const m3 = measRow(tidy(p(3))), m4 = measRow(tidy(p(4)));
  const measures = [...Array(4 - m3.length).fill(0), ...m3, ...m4];
  if (measures.length !== 8) fail(`${F.pf}: measures row has ${measures.length} values`);
  YEARS.forEach((y, i) => {
    close(gross[i] - inrev[i], net[i], `${y}: net investment = gross − revenue`);
    close(selfFin[i] - net[i], global[i], `${y}: global result = self-financing − net investment`);
  });
  const decided = Number((p(3).replace(/\s+/g, " ").match(/per complessivi CHF ([\d.]+) mio a regime/) ?? fail(`${F.pf} p. 3: decided measures`))[1]);
  const pending = measures[7] / 1e6;

  // ---- debt table (p. 15): self-financing ratio, asset proceeds, gross debt, debt / revenue
  const t15 = tidy(p(15), false);
  const ratioSF = row(t15, "Grado di autofinanziamento", 8).v;
  YEARS.forEach((y, i) => close(ratioSF[i], (selfFin[i] / net[i]) * 100, `${y}: self-financing ratio`, 0.06));
  const proceeds = row(t15, "Incasso/uscite da rivalorizzazione", 8).v;
  const debt = row(t15, "Debito lordo diretto e indiretto MCA2", 8).v;
  const ratio = row(t15, "Ratio Debito diretto e indiretto su ricavi", 8).v;
  const adj = Math.abs(Number((t15.match(/Utilizzo c\/c PCi per rifugio Comano -?(\d{1,3}(?:’\d{3})*)/) ?? fail(`${F.pf} p. 15: PCi adjustment`))[1].replace(/’/g, "")));
  const adjYears: number[] = [];
  for (let i = 1; i < 8; i++) {
    const gap = debt[i] - debt[i - 1] - (-global[i] - proceeds[i]);
    if (Math.abs(gap) <= 1) continue;
    if (Math.abs(Math.abs(gap) - adj) <= 1) { adjYears.push(YEARS[i]); continue; }
    fail(`${YEARS[i]}: change in debt ${debt[i] - debt[i - 1]} vs −global − proceeds ${-global[i] - proceeds[i]}`);
  }
  if (adjYears.length > 1) fail(`${F.pf}: the PCi adjustment appears in ${adjYears.length} years`);

  // ---- the assets to sell (p. 5–6)
  const t56 = tidy(`${p(5)} ${p(6)}`.replace(/'(?=\d{3})/g, "’"), false).replace(/(?<![\d’])(\d{1,2}) (\d{1,2}’\d{3})/g, "$1$2").replace(/Plus - \/minus - valenza - (\d)/g, "Plus - /minus - valenza -$1");
  const N = String.raw`\d{1,3}(?:’\d{3})*`;
  const ASSET = new RegExp(`([A-ZÀ-Ü][^]*?) (?:Valore di perizia (${N}) )?(?:Valore contabile (${N}|-) )?(?:Plus - /minus - valenza (-?${N}|-) )?Incasso (${N})`, "g");
  const start = t56.indexOf("considera le seguenti");
  const assets = [...t56.slice(start).matchAll(ASSET)].map((m) => ({ name: m[1].replace(/^.*?: /, "").replace(/^(?:“?rivalorizzazioni”?:?\s*)/i, "").trim(), proceeds: money(m[5]) }));
  // the plan lists companies by name; what is sold is the City's shareholding
  const STAKE: Record<string, Text> = { "Alpiq SA": { it: "Partecipazione in Alpiq SA", en: "Stake in Alpiq SA" }, "Casinò SA": { it: "Partecipazione nel Casinò SA", en: "Stake in Casinò SA" } };
  const label = (name: string): Text => STAKE[name] ?? { it: name, en: name };
  const assetSum = assets.reduce((t, a) => t + a.proceeds, 0), procSum = proceeds.reduce((t, x) => t + x, 0);
  close(assetSum, procSum, `${F.pf}: the ${assets.length} assets vs the yearly proceeds`);

  // ---- investment plan by category (p. 19): gross by category; totals and net must agree with p. 3
  const t19 = tidy(p(19), false);
  const CATS: [string, Text][] = [
    ["Strade, piazze, vie di comunicazione", { it: "Strade e piazze", en: "Roads and squares" }], ["Altre opere del genio civile", { it: "Altre opere del genio civile", en: "Other civil engineering" }],
    ["Immobili", { it: "Edifici", en: "Buildings" }], ["Boschi", { it: "Boschi", en: "Forests" }], ["Beni mobili", { it: "Beni mobili", en: "Equipment and vehicles" }],
    ["Altri investimenti mat eriali", { it: "Altri investimenti materiali", en: "Other tangible investment" }], ["Altri investimenti immat eriali", { it: "Investimenti immateriali", en: "Intangible investment" }],
    ["Contributi per investimenti di terzi", { it: "Contributi a investimenti di terzi", en: "Contributions to others' investment" }], ["Prestiti", { it: "Prestiti", en: "Loans" }],
    ["Beni patrimoniali", { it: "Beni patrimoniali", en: "Financial assets" }], ["PSE", { it: "Polo sportivo e degli eventi (PSE)", en: "Sports and events hub (PSE)" }]];
  const outEnd = t19.indexOf("Uscite per inv");
  const cats = CATS.map(([lab, text]) => ({ text, v: row(t19, lab, 8).v, rev: row(t19, lab, 8, outEnd).v }));
  const grossAll = row(t19, "Uscite per inv", 8).v;
  const revAll = row(t19, "Entrate per investimenti", 8).v, netAll = row(t19, "Onere netto per investimenti", 8).v;
  const patr = cats.find((c) => c.text.en === "Financial assets")!;
  YEARS.forEach((y, i) => {
    // p. 19 is in round thousands: a total may differ from its categories by one unit (1'000), and is reported
    const sg = cats.reduce((t, c) => t + c.v[i], 0), sr = cats.reduce((t, c) => t + c.rev[i], 0);
    close(sg, grossAll[i], `${y}: investment categories add up (gross)`, 1000.01); close(sr, revAll[i], `${y}: investment categories add up (revenue)`, 1000.01);
    if (sg !== grossAll[i] || sr !== revAll[i]) console.log(`  note: ${F.pf} p. 19, ${y}: categories ${sg} / ${sr} vs printed totals ${grossAll[i]} / ${revAll[i]} (rounding to thousands)`);
    close(grossAll[i] - revAll[i], netAll[i], `${y}: p. 19 net = gross − revenue`, 1000.01);
    close(netAll[i] - net[i], patr.v[i] - patr.rev[i], `${y}: p. 19 vs p. 3 differ by the financial assets`, 1000.01);
  });
  const netTotal = net.reduce((t, x) => t + x, 0);

  // ---- what the 2027 budget says against the plan (message p. 20)
  const msg = (await readPdf(BUDGET27_MSG, [20])).pages[19].replace(/\s+/g, " ");
  const upd = msg.match(/investimento netto complessivo di CHF ([\d.]+) mio .*?prevedeva, per il medesimo periodo, investimenti complessivi netti per CHF ([\d.]+) mio/) ?? fail(`${BUDGET27_MSG} p. 20: investment comparison`);
  const glob = msg.match(/Il risultato globale atteso per il 2027 con i suoi CHF (-?[\d.]+) mio risulta peggiorativo rispetto al Piano Finanziario \(CHF (-?[\d.]+) mio\)/) ?? fail(`${BUDGET27_MSG} p. 20: global result comparison`);
  close(Number(glob[2]), global[1] / 1e6, "plan 2027 global result: budget message vs plan", 0.06);

  const mio = (x: number) => x / 1e6;
  const pk = debt.indexOf(Math.max(...debt)), pr = ratio.indexOf(Math.max(...ratio));
  const S = (loc: string) => src(F.pf, loc);
  const notLaw: Text = { it: "Il piano finanziario non è votato dal Consiglio comunale: per legge (LOC art. 152) gli è presentato «per informazione e discussione». È l'intenzione del Municipio, aggiornata ogni anno con il preventivo. Non è confrontato con gli altri comuni: i piani finanziari non sono raccolti dal Cantone.",
    en: "The financial plan is not voted by the Council: by law (LOC art. 152) it is presented 'for information and discussion'. It is the Municipio's intention, updated every year with the budget. Not compared with other municipalities: financial plans are not collected by the canton." };
  const yearData = (vals: number[], f = (x: number) => mio(x), status: Datum["status"] = "plan") => YEARS.map((y, i) => ({ key: `a${y}`, label: { it: String(y), en: String(y) }, value: f(vals[i]), status }));
  const sales = [...assets].sort((a, b) => b.proceeds - a.proceeds);
  const top = sales.slice(0, 7), rest = sales.slice(7);
  const stars: Star[] = [
    { id: "finanze.piano-debito", constellation: "finanze", label: { it: "Debito previsto dal piano finanziario", en: "Debt in the financial plan" },
      about: { it: `Secondo il piano finanziario 2026–2033, il debito lordo della Città sale a ${n(mio(debt[0]))} milioni a fine 2026, tocca il massimo di ${n(mio(debt[pk]))} milioni nel ${YEARS[pk]} e scende a ${n(mio(debt[7]))} milioni nel 2033. Il calo dopo il ${YEARS[pk]} dipende dalla vendita di beni e da misure di risparmio ancora da definire.`,
        en: `According to the 2026–2033 financial plan, the City's gross debt rises to CHF ${n(mio(debt[0]))} million at the end of 2026, peaks at ${n(mio(debt[pk]))} million in ${YEARS[pk]} and falls to ${n(mio(debt[7]))} million in 2033. The fall after ${YEARS[pk]} depends on selling assets and on savings not yet defined.` },
      value: mio(debt[pk]), unit: "mio CHF", year: YEARS[pk], area: "Lugano", kind: "official",
      method: { it: `Debito lordo diretto e indiretto (MCA2) a fine anno, dalla tabella dell'evoluzione del debito del piano. Ogni anno la variazione del debito corrisponde al risultato globale meno l'incasso delle vendite di beni${adjYears.length ? ` (nel ${adjYears[0]} con un aggiustamento di ${n(adj / 1000, 0)} mila franchi indicato nel piano)` : ""}. ${notLaw.it}`,
        en: `Gross direct and indirect debt (MCA2) at year end, from the plan's debt table. Each year the change in debt equals the global result less the proceeds from asset sales${adjYears.length ? ` (in ${adjYears[0]} with an adjustment of CHF ${n(adj / 1000, 0)} thousand listed in the plan)` : ""}. ${notLaw.en}` },
      source: [S("p. 15: 'Debito lordo diretto e indiretto MCA2', 'Ratio Debito diretto e indiretto su ricavi', 'Incasso/uscite da rivalorizzazione'"), S("p. 3–4: 'Risultato globale'")],
      context: [{ label: { it: "Fine 2026", en: "End 2026" }, value: mio(debt[0]), unit: "mio CHF" }, { label: { it: "Fine 2033", en: "End 2033" }, value: mio(debt[7]), unit: "mio CHF" },
        { label: { it: `Debito su ricavi, massimo (${YEARS[pr]})`, en: `Debt to revenue, peak (${YEARS[pr]})` }, value: ratio[pr], unit: "%" }],
      related: ["finanze.debito-lordo", "finanze.piano-rivalorizzazioni", "finanze.piano-misure", "finanze.piano-investimenti"],
      detail: [{ title: { it: "Debito lordo a fine anno, piano finanziario 2026–2033", en: "Gross debt at year end, financial plan 2026–2033" },
        chart: { type: "columns", unit: "mio CHF", digits: 0, color: FC, series: [{ label: { it: "Previsto", en: "Planned" }, data: yearData(debt) }] }, source: [S("p. 15")] },
        { title: { it: "Debito su ricavi", en: "Debt to revenue" },
        chart: { type: "columns", unit: "%", digits: 1, color: FC, series: [{ label: { it: "Previsto", en: "Planned" }, data: yearData(ratio, (x) => x) }] },
        note: { it: "Il rapporto tra debito lordo e ricavi era del 219% nel 2024; è l'indicatore che l'agenzia di rating usa per la Città.", en: "Gross debt to revenue was 219% in 2024; it is the indicator the rating agency uses for the City." }, source: [S("p. 15")] }] },
    { id: "finanze.piano-investimenti", constellation: "finanze", label: { it: "Investimenti previsti 2026–2033", en: "Planned investment 2026–2033" },
      about: { it: `Il piano prevede ${n(mio(netTotal))} milioni di investimenti netti in otto anni: ${n(mio(net[0]))} nel 2026, soprattutto per il riscatto di Arena e Palazzetto dello sport, poi tra ${n(mio(Math.min(...net.slice(1))))} e ${n(mio(Math.max(...net.slice(1))))} milioni l'anno. Il preventivo 2027 porta gli investimenti 2027–2030 a ${upd[1]} milioni, contro i ${upd[2]} del piano, per lavori rinviati dal 2026.`,
        en: `The plan foresees CHF ${n(mio(netTotal))} million of net investment over eight years: ${n(mio(net[0]))} in 2026, mostly to buy back the Arena and the Palazzetto dello Sport, then between ${n(mio(Math.min(...net.slice(1))))} and ${n(mio(Math.max(...net.slice(1))))} million a year. The 2027 budget raises 2027–2030 investment to CHF ${upd[1]} million, against ${upd[2]} in the plan, because works were postponed from 2026.` },
      value: mio(netTotal), unit: "mio CHF", year: 2033, area: "Lugano", kind: "derived",
      method: { it: `Somma dell'onere netto per investimenti (beni amministrativi) del piano, 2026–2033. Il grafico per categoria somma le uscite lorde di p. 19, comprese quelle in beni patrimoniali. ${notLaw.it}`, en: `Sum of net investment (administrative assets) in the plan, 2026–2033. The chart by category sums the gross outlays on p. 19, including financial assets. ${notLaw.en}` },
      source: [S("p. 3–4: 'Onere netto per investimenti'"), S("p. 19: 'Piano investimenti', by category"), src(BUDGET27_MSG, "p. 20: investment 2027–2030 against the plan")],
      context: [{ label: { it: "2026 (Arena e Palazzetto)", en: "2026 (Arena and Palazzetto)" }, value: mio(net[0]), unit: "mio CHF" },
        { label: { it: "2027–2030 nel preventivo 2027", en: "2027–2030 in the 2027 budget" }, value: Number(upd[1]), unit: "mio CHF" },
        { label: { it: "2027–2030 nel piano", en: "2027–2030 in the plan" }, value: Number(upd[2]), unit: "mio CHF" }],
      related: ["finanze.piano-debito", "cultura.pse"],
      detail: [{ title: { it: "Investimenti netti per anno, piano finanziario", en: "Net investment by year, financial plan" },
        chart: { type: "columns", unit: "mio CHF", digits: 1, color: FC, series: [{ label: { it: "Previsti", en: "Planned" }, data: yearData(net) }] }, source: [S("p. 3–4")] },
        { title: { it: "Investimenti lordi 2026–2033 per categoria", en: "Gross investment 2026–2033 by category" },
        chart: { type: "hbars", unit: "mio CHF", digits: 1, color: FC, data: cats.map((c, i) => ({ key: `c${i}`, label: c.text, value: mio(c.v.reduce((t, x) => t + x, 0)) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value) },
        source: [S("p. 19")] }] },
    { id: "finanze.piano-rivalorizzazioni", constellation: "finanze", label: { it: "Beni da vendere (rivalorizzazioni)", en: "Assets to sell ('rivalorizzazioni')" },
      about: { it: `Per ridurre il debito il piano conta di vendere ${assets.length} beni per ${n(mio(assetSum))} milioni entro il 2033, soprattutto negli ultimi anni: ${n(mio(proceeds[5] + proceeds[6] + proceeds[7]))} milioni tra il 2031 e il 2033. I più grandi sono ${top.slice(0, 3).map((a) => `${label(a.name).it.toLowerCase().startsWith("partecipazione") ? label(a.name).it.replace("Partecipazione", "la partecipazione") : a.name} (${n(mio(a.proceeds))} mio)`).join(", ")}.`,
        en: `To reduce the debt the plan counts on selling ${assets.length} assets for CHF ${n(mio(assetSum))} million by 2033, mostly in the last years: ${n(mio(proceeds[5] + proceeds[6] + proceeds[7]))} million between 2031 and 2033. The largest are ${top.slice(0, 3).map((a) => `${label(a.name).en.startsWith("Stake") ? label(a.name).en.replace("Stake", "the stake") : a.name} (CHF ${n(mio(a.proceeds))} million)`).join(", ")}.` },
      value: mio(assetSum), unit: "mio CHF", year: 2033, area: "Lugano", kind: "official",
      method: { it: `Incasso previsto per ogni bene (valore di perizia, o valore contabile per i titoli), dall'elenco del piano; il piano li sceglie perché la loro vendita avrebbe un impatto limitato sui servizi. L'anno di incasso viene dalla tabella del debito. Nessuna vendita è ancora decisa. ${notLaw.it}`,
        en: `Expected proceeds for each asset (appraised value, or book value for securities), from the plan's list; the plan chose them because selling them would have limited impact on services. The year of each sale comes from the debt table. No sale has been decided yet. ${notLaw.en}` },
      source: [S("p. 5–6: list of 'rivalorizzazioni' (Valore di perizia, Valore contabile, Incasso)"), S("p. 15: 'Incasso/uscite da rivalorizzazione' by year")],
      context: [{ label: { it: "Incassi 2031–2033", en: "Proceeds 2031–2033" }, value: mio(proceeds[5] + proceeds[6] + proceeds[7]), unit: "mio CHF" }],
      related: ["finanze.piano-debito"],
      detail: [{ title: { it: "I beni più grandi da vendere", en: "The largest assets to sell" },
        chart: { type: "hbars", unit: "mio CHF", digits: 1, color: FC, data: [...top.map((a, i) => ({ key: `r${i}`, label: label(a.name), value: mio(a.proceeds) })),
          { key: "rx", label: { it: `Altri ${rest.length} beni`, en: `${rest.length} other assets` }, value: mio(rest.reduce((t, a) => t + a.proceeds, 0)) }] },
        note: { it: `Gli altri: ${rest.map((a) => a.name).join(", ")}.`, en: `The others: ${rest.map((a) => a.name).join(", ")}.` }, source: [S("p. 5–6")] },
        { title: { it: "Incassi previsti per anno", en: "Expected proceeds by year" },
        chart: { type: "columns", unit: "mio CHF", digits: 1, color: FC, series: [{ label: { it: "Previsti", en: "Planned" }, data: yearData(proceeds) }] }, source: [S("p. 15")] }] },
    { id: "finanze.piano-misure", constellation: "finanze", label: { it: "Risparmi ancora da definire", en: "Savings still to be defined" },
      about: { it: `Il piano conta su ${n(pending)} milioni l'anno di nuove misure di risanamento dal 2030, introdotte a terzi dal 2028, per compensare gli effetti delle votazioni del 28 settembre 2025. Il piano non dice ancora quali siano. Altri ${n(decided)} milioni l'anno di misure sono già decisi e compresi nei conti dal 2026–2027.`,
        en: `The plan counts on CHF ${n(pending)} million a year of new recovery measures from 2030, phased in by thirds from 2028, to offset the effects of the votes of 28 September 2025. The plan does not yet say what they are. Another ${n(decided)} million a year of measures are already decided and included in the accounts from 2026–2027.` },
      value: pending, unit: "mio CHF / anno", year: 2030, area: "Lugano", kind: "official",
      method: { it: `Riga «Misure di risanamento decisioni 28.09.2025» del riepilogo del piano: la manovra non è attribuita ai singoli conti («manovra correttiva non dettagliata»). Secondo il preventivo 2027, il Comitato di risanamento presenta al Municipio misure di efficienza entro dicembre 2026 e, nel corso del 2027, proposte per ridefinire le attività della Città. ${notLaw.it}`,
        en: `Row 'Misure di risanamento decisioni 28.09.2025' in the plan's recap: the package is not allocated to individual accounts ('corrective package not detailed'). According to the 2027 budget, the recovery committee presents efficiency measures to the Municipio by December 2026 and, during 2027, proposals to redefine the City's activities. ${notLaw.en}` },
      source: [S("p. 3–4: 'Misure di risanamento decisioni 28.09.2025'; p. 3: 'per complessivi CHF 13.8 mio a regime'"), S("p. 11: 'manovra correttiva CHF 22.9 mio non dettagliata'"), src("city-preventivo-2027-slides.pdf", "'Chiusura 2026 e risanamento finanziario': timeline")],
      context: [{ label: { it: "Misure già decise", en: "Measures already decided" }, value: decided, unit: "mio CHF / anno" }],
      related: ["finanze.piano-debito"],
      detail: [{ title: { it: "Nuove misure previste per anno", en: "New measures planned by year" },
        chart: { type: "columns", unit: "mio CHF", digits: 1, color: FC, series: [{ label: { it: "Da definire", en: "To be defined" }, data: yearData(measures) }] }, source: [S("p. 3–4")] }] },
  ];
  // the debt chapter's plan line gets every year of the plan
  const debtPlan = YEARS.map((y, i) => ({ key: `p${y}`, label: { it: `fine ${y} (piano)`, en: `end ${y} (plan)` }, value: mio(debt[i]), status: "plan" as const, date: `${y}-12-31` }));
  console.log(`plan: debt ${n(mio(debt[0]))} → peak ${n(mio(debt[pk]))} (${YEARS[pk]}) → ${n(mio(debt[7]))} · net investment ${n(mio(netTotal))} · ${assets.length} assets ${n(mio(assetSum))} · measures ${n(pending)} pending, ${n(decided)} decided${adjYears.length ? ` · PCi adjustment ${adjYears[0]}` : ""}`);
  return { stars, debtPlan, source: [S("p. 15: 'Debito lordo diretto e indiretto MCA2'")] };
}

export const PIANO_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.pf]: { url: "https://www.lugano.ch/dam/jcr:0ed3bd5e-4927-4a75-9ec0-3956cc7d090d", publisher: "Città di Lugano, Messaggio municipale no. 12521, Piano Finanziario 2026–2033 (23 ottobre 2025)" },
};
