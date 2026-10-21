// The public safety constellation (SAFETY-SOURCES.md): function 1 by line, the City police, criminal-code offences,
// road accidents and the fire service. Rankings left out where they mislead a resident: offences per resident (the
// police's own commuter caveat), police and fire spending (both serve beyond the City). Tables and phrases by page,
// the police call-out chart by position; every figure is checked against a printed total or a second source.

import { compare, type Datum, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, sheet, type Row } from "./adapters/common";
import { matcher, type Municipality } from "./adapters/municipalities";
import { APPENDICE } from "./adapters/sel";
import { readPdf, type Item } from "./adapters/pdf";
import { BUDGET27_MSG } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const SC = "var(--sicurezza)";
export const F = { lic: "lugano-in-cifre-2026.pdf", scp: "ti-statistica-criminale-2025.pdf", pol: "polizia-lugano-rapporto-2025.pdf" };
const LINES: [string, string, string][] = [
  ["111", "Polizia", "Police"], ["120", "Potere giudiziario", "Judiciary"], ["140", "Diritto generale", "General legal affairs"],
  ["150", "Vigili del fuoco", "Fire service"], ["161", "Difesa militare", "Military defence"], ["162", "Protezione civile", "Civil protection"],
];
const OFFENCES: [string, string, string][] = [
  ["Vita e integrità della persona", "Vita e integrità della persona", "Life and limb"], ["Patrimonio", "Patrimonio", "Property"],
  ["Onore, sfera personale riservata", "Onore e sfera privata", "Honour and privacy"], ["Libertà personale", "Libertà personale", "Personal freedom"],
  ["Integrità sessuale", "Integrità sessuale", "Sexual integrity"], ["Famiglia", "Famiglia", "Family"], ["Comune pericolo", "Comune pericolo", "Public danger"],
  ["Falsità monete, valori uff\\. di bollo", "Falsità di monete e valori di bollo", "Counterfeiting"], ["Falsità in atti", "Falsità in atti", "Forgery of documents"],
  ["Tranquillità pubblica", "Tranquillità pubblica", "Public peace"], ["Pubblica autorità", "Pubblica autorità", "Public authority"],
  ["Amministrazione della giustizia", "Amministrazione della giustizia", "Administration of justice"], ["Doveri d'ufficio e professionali", "Doveri d'ufficio", "Official duties"],
  ["Corruzione", "Corruzione", "Corruption"], ["Contravv\\. disp\\. diritto federale", "Contravvenzioni al diritto federale", "Federal-law contraventions"], ["Altri titoli", "Altri titoli", "Other titles"],
];
const CALLOUTS: Record<string, string> = {
  "Incidenti stradali": "Road accidents", "Disturbo / Molestia": "Disturbance", "Discussioni / liti": "Disputes", "Furti": "Thefts",
  "Esercizi pubblici": "Bars and restaurants", "Disagio famigliare": "Family distress", "altri reati CPS": "Other criminal offences", "Incendi": "Fires",
  "Disagio famigliare VIDO+": "Family distress (VIDO+)", "Violenza domestica": "Domestic violence", "Risse": "Brawls", "Truffe": "Fraud", "Rapine": "Robberies", "Aggressioni": "Assaults",
};
const N = String.raw`\d{1,3}(?:[’'] ?\d{3})*`;
const int = (s: string) => Number(s.replace(/[\s’']/g, ""));
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}
/** "name 2024 2025 change (pct)" rows ending in a "∑ total total" row; fails if the rows do not add up. */
function twoYearTable(pages: string[], names: string[], file: string) {
  const re = new RegExp(names.map((nm) => `${nm} (${N}) (${N}) \\S+ \\([^)]*\\)`).join(" ") + ` [∑Σ] (${N}) (${N})`);
  const { p, m } = findPage(pages, re, file);
  const rows = names.map((_, k) => ({ a: int(m[2 * k + 1]), b: int(m[2 * k + 2]) }));
  const ta = int(m[2 * names.length + 1]), tb = int(m[2 * names.length + 2]);
  if (rows.reduce((s, r) => s + r.a, 0) !== ta || rows.reduce((s, r) => s + r.b, 0) !== tb) fail(`${file} p. ${p}: rows do not add up to ${ta} / ${tb}`);
  return { p, rows, ta, tb };
}
/** A row of k numbers after a label (thousands with an apostrophe), as in the yearbook's year-by-year tables. */
const seriesAfter = (text: string, label: string, k: number, file: string) => {
  const m = text.match(new RegExp(`${label} ((?:${N} ){${k - 1}}${N})(?= |$)`)) ?? fail(`${file}: row '${label}' not found`);
  return [...m[1].matchAll(new RegExp(N, "g"))].map((x) => int(x[0]));
};
/** A horizontal bar chart printed as loose labels and values: pair each label with the value on the same line. */
function barsByLine(items: Item[], labels: string[], file: string) {
  const nums = items.filter((i) => /^\d[\d’']*$/.test(i.s));
  return labels.map((lab) => {
    const li = items.find((i) => i.s === lab) ?? fail(`${file}: chart label '${lab}' missing`);
    const hit = nums.filter((v) => Math.abs(v.y - li.y) < 4);
    if (hit.length !== 1) fail(`${file}: chart label '${lab}' has ${hit.length} values on its line`);
    return { lab, v: int(hit[0].s) };
  });
}

export async function sicurezza(register: Municipality[], src: Src) {
  // ---- function 1 by line (TabD spending, TabE revenue)
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
  const total1 = Object.values(ls).reduce((s, v) => s + v, 0) / 1000;
  const lineData = (codes: string[], m: Record<string, number>) => LINES.filter(([c]) => codes.includes(c) && m[c] > 0)
    .map(([c, it, en]) => ({ key: `l${c}`, label: { it: `${c} ${it}`, en: `${c} ${en}` }, value: m[c] / 1000 })).sort((a, b) => b.value - a.value) as Datum[];

  // ---- yearbook: offences by type (2024, 2025), by law 2019–2025; road accidents and casualties 2013–2025
  const lic = (await readPdf(F.lic, [64, 65, 66])).pages;
  const off = twoYearTable(lic, OFFENCES.map(([re]) => re), F.lic);
  const yrs = findPage(lic, /((?:20\d\d ){6}20\d\d) Reati Codice penale/, F.lic);
  const years = yrs.m[1].split(" ").map(Number);
  const cp = seriesAfter(lic[yrs.p - 1], "Reati Codice penale", 7, F.lic), drugs = seriesAfter(lic[yrs.p - 1], "Reati Legge stupefacenti", 7, F.lic),
    foreign = seriesAfter(lic[yrs.p - 1], "Reati Legge stranieri", 7, F.lic);
  if (cp[6] !== off.tb || cp[5] !== off.ta) fail(`${F.lic}: offence series ends at ${cp[5]}/${cp[6]}, table says ${off.ta}/${off.tb}`);
  const drugT = twoYearTable(lic, ["Proprio consumo", "Delitti", "Crimini"], F.lic);
  const forT = twoYearTable(lic, ["Entrata/uscita/soggiorno illegale", "Attività illegale", "Inganno alle autorità", "Agevolazione illegale", "Altre infrazioni"], F.lic);
  if (drugT.tb !== drugs[6] || forT.tb !== foreign[6]) fail(`${F.lic}: drugs/foreigners totals differ from the series`);
  const accP = findPage(lic, /2013 2014 2015 2016 2 ?017 2018 2019 2020 2021 2022 2023 2024 2025 con danni materiali/, F.lic);
  const at = lic[accP.p - 1].slice(lic[accP.p - 1].indexOf("con danni materiali"));
  const mat = seriesAfter(at, "con danni materiali", 13, F.lic), pers = seriesAfter(at, "con danni alla persona", 13, F.lic),
    dead = seriesAfter(at, "con persone decedute", 13, F.lic), serious = seriesAfter(at, "con feriti gravi", 13, F.lic), light = seriesAfter(at, "con feriti leggeri", 13, F.lic),
    accTot = seriesAfter(at, "∑", 13, F.lic);
  for (let k = 0; k < 13; k++) if (mat[k] + pers[k] !== accTot[k]) fail(`${F.lic}: accidents ${2013 + k} do not add up`);
  const cas = findPage(lic, /2013 2014 2015 2016 2 ?017 2018 2019 2020 2021 2022 2023 2024 2025 Persone decedute/, F.lic);
  const ct = lic[cas.p - 1].slice(lic[cas.p - 1].indexOf("Persone decedute"));
  const cDead = seriesAfter(ct, "Persone decedute", 13, F.lic), cSer = seriesAfter(ct, "Feriti gravi", 13, F.lic), cLight = seriesAfter(ct, "Feriti leggeri", 13, F.lic), cTot = seriesAfter(ct, "∑", 13, F.lic);
  for (let k = 0; k < 13; k++) if (cDead[k] + cSer[k] + cLight[k] !== cTot[k]) fail(`${F.lic}: casualties ${2013 + k} do not add up`);
  const accYears = Array.from({ length: 13 }, (_, k) => 2013 + k);

  // ---- cantonal crime statistics 2025: Lugano and the canton, offences, residents, rate per 1,000; the commuter caveat
  const scp = (await readPdf(F.scp, [9, 11])).pages;
  const row = (label: string, offW: string, popW: string) => findPage(scp, new RegExp(`${label} (${offW}) (${popW}) (\\d+,\\d) (${offW}) (${popW}) (\\d+,\\d)`), F.scp);
  const lugR = row("Lugano", String.raw`\d{1,2} \d{3}`, String.raw`\d{2} \d{3}`), tiR = row("Totale cantone", String.raw`\d{2} \d{3}`, String.raw`\d{3} \d{3}`);
  const vals = (m: RegExpMatchArray) => ({ o24: int(m[1]), p24: int(m[2]), r24: Number(m[3].replace(",", ".")), o25: int(m[4]), p25: int(m[5]), r25: Number(m[6].replace(",", ".")) });
  const L = vals(lugR.m), T = vals(tiR.m);
  for (const [o, p, r] of [[L.o25, L.p25, L.r25], [T.o25, T.p25, T.r25], [L.o24, L.p24, L.r24]]) if (Math.abs((o / p) * 1000 - r) > 0.06) fail(`${F.scp}: ${o} / ${p} does not give ${r}‰`);
  if (L.o25 !== off.tb) fail(`${F.scp}: Lugano ${L.o25} offences, yearbook ${off.tb}`);
  const lugPop = register.find((m) => m.bfs === 5192)!.population;
  if (L.p25 !== lugPop) fail(`${F.scp}: Lugano residents ${L.p25}, register ${lugPop}`);
  const caveat = findPage(scp, /Le frequenze non possono però tener conto delle popolazioni pendolari/, F.scp);

  // ---- City police report 2025: call-outs by type (chart), events logged, police region III
  const pol = await readPdf(F.pol, [38, 43, 55]);
  const callTot = int(findPage(pol.pages, new RegExp(`Totale interventi: (${N})`), F.pol).m[1]);
  const callP = findPage(pol.pages, /Interventi richiesti Totale interventi/, F.pol).p;
  const calls = barsByLine(pol.items[callP - 1], Object.keys(CALLOUTS), F.pol).sort((a, b) => b.v - a.v);
  if (calls.reduce((s, c) => s + c.v, 0) > callTot) fail(`${F.pol}: call-out types exceed the total ${callTot}`);
  const events = findPage(pol.pages, new RegExp(`Eventi registrati CEOP Totale 2025: (${N}) = ca\\. (\\d+)/giorno`), F.pol);
  const region = findPage(pol.pages, new RegExp(`• (\\d+) comuni • ca\\. (${N}) abitanti • \\d+ valichi di frontiera • (\\d+) agenti Polcom`), F.pol);
  const polo = findPage(pol.pages, new RegExp(`La Polizia Polo è intervenuta (${N}) volte nei territori delle Polizie strutturate`), F.pol);
  const structured = findPage(pol.pages, /Ripartizione interventi per Polizia intervenuta Polizia (.+?) TOTALE INTERVENTI/, F.pol);

  // ---- the City's contribution to the civil protection consortium (2027 budget message): budget 2027, budget 2026, actual 2025
  const msg = (await readPdf(BUDGET27_MSG, [33])).pages;
  const M = String.raw`\d{1,3}(?:[’']\d{3})*\.\d\d`, D = String.raw`-?\d{1,3}(?:[’']\d{3})*\.\d\d`;
  const pc = findPage(msg, new RegExp(`36121300 Consorzio Protezione Civile Lugano Città (${M}) (${M}) (${D}) -?\\d+\\.\\d\\d ?% (${M}) (${D}) -?\\d+\\.\\d\\d ?%`), BUDGET27_MSG);
  const money = (s: string) => Number(s.replace(/[’']/g, ""));
  const [pc27, pc26, pcD1, pc25, pcD2] = [1, 2, 3, 4, 5].map((k) => money(pc.m[k]));
  if (Math.abs(pc27 - pc26 - pcD1) > 0.01 || Math.abs(pc27 - pc25 - pcD2) > 0.01) fail(`${BUDGET27_MSG}: account 36121300 differences do not match`);

  const usc = (file: string, loc: string) => src(file, loc);
  const yr = (y: number) => ({ it: String(y), en: String(y) });
  const regionText = { it: `regione di polizia III: ${region.m[1]} comuni, circa ${region.m[2]} abitanti, ${region.m[3]} agenti di polizia comunale`,
    en: `police region III: ${region.m[1]} municipalities, about ${region.m[2].replace(/[’']/g, ",")} residents, ${region.m[3]} municipal police officers` };
  const anchorDetail = [
    { title: { it: "Sicurezza pubblica nei conti della Città, 2024: spese e ricavi per voce", en: "Public safety in the City's accounts, 2024: spending and revenue by line" } as Text,
      chart: { type: "columns" as const, unit: "mio CHF", digits: 2, color: SC, series: [
        { label: { it: "Spese", en: "Spending" }, data: lineData(LINES.map(([c]) => c), ls).filter((d) => d.value >= 1).map((d) => ({ ...d, key: `a${d.key}` })) },
        { label: { it: "Ricavi", en: "Revenue" }, data: lineData(LINES.map(([c]) => c), ls).filter((d) => d.value >= 1).map((d) => ({ ...d, key: `b${d.key}`, value: lr[d.key.slice(1)] / 1000 })) }] },
      note: { it: `Voci sopra 1 milione di spesa. La voce 140 «Diritto generale» è l'etichetta dei conti, che non ne danno il dettaglio. Polizia e pompieri della Città lavorano anche per i comuni vicini (${regionText.it}).`,
        en: `Lines above CHF 1 million of spending. Line 140 'General legal affairs' is the accounts' own label; they do not detail it. The City's police and fire service also work for neighbouring municipalities (${regionText.en}).` },
      source: [src(APPENDICE, "sheets TabD and TabE, columns 111–162, row 'Lugano' (CHF thousands)"), usc(F.pol, `p. ${region.p}`)] },
  ];

  const stars: Star[] = [
    { id: "sicurezza.polizia", constellation: "sicurezza", label: { it: "Polizia della Città", en: "City police" },
      about: { it: `Spesa della Città per la polizia (voce 111) nel 2024: ${n(ls["111"] / 1000, 1)} milioni di franchi, con ${n(lr["111"] / 1000, 1)} milioni di ricavi. Nel 2025 la Polizia Città di Lugano ha avuto ${n(callTot)} interventi richiesti e la centrale ha registrato ${n(int(events.m[1]))} eventi (circa ${events.m[2]} al giorno). È la polizia capofila della ${regionText.it}.`,
        en: `The City's spending on police (line 111) in 2024: CHF ${n(ls["111"] / 1000, 1)} million, with CHF ${n(lr["111"] / 1000, 1)} million of revenue. In 2025 the Lugano City police had ${n(callTot)} call-outs and the control room logged ${n(int(events.m[1]))} events (about ${events.m[2]} a day). It is the lead force of ${regionText.en}.` },
      value: ls["111"] / 1000, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: `Voce 111 «Polizia» del conto economico 2024 della Città, come pubblicato dalla Sezione degli enti locali. La cifra non è divisa per gli abitanti né confrontata con gli altri comuni: la polizia della Città è la capofila della regione di polizia III e interviene anche nei comuni vicini (${n(int(polo.m[1]))} volte nel 2025 nei territori delle altre polizie della regione), quindi la sua spesa non serve solo gli abitanti di Lugano.`,
        en: `Line 111 'Police' in the City's 2024 accounts, as published by the cantonal Local Authorities Section. The figure is not divided by residents or compared with other municipalities: the City police lead police region III and also work in neighbouring municipalities (${n(int(polo.m[1]))} times in 2025 in the other regional forces' areas), so its spending does not serve Lugano's residents alone.` },
      source: [src(APPENDICE, "sheets TabD and TabE, column 111, row 'Lugano'"), usc(F.pol, `p. ${callP}: 'Interventi richiesti'; p. ${events.p}: 'Eventi registrati CEOP'; p. ${region.p}: region III`)],
      context: [{ label: { it: "Ricavi 111", en: "Revenue 111" }, value: lr["111"] / 1000, unit: "mio CHF" }, { label: { it: "Interventi (2025)", en: "Call-outs (2025)" }, value: callTot, unit: "interventi" },
        { label: { it: "Eventi registrati (2025)", en: "Events logged (2025)" }, value: int(events.m[1]), unit: "eventi" }],
      related: ["sicurezza.spesa", "sicurezza.reati"],
      detail: [{ title: { it: "Interventi richiesti per tipo, 2025", en: "Call-outs by type, 2025" },
        chart: { type: "hbars", unit: "interventi", color: SC, caption: { it: "interventi · 2025", en: "call-outs · 2025" },
          data: calls.map((c, k) => ({ key: `c${k}`, label: { it: c.lab, en: CALLOUTS[c.lab] }, value: c.v })) },
        note: { it: `Le voci più significative secondo il rapporto; il totale di ${n(callTot)} interventi comprende anche altri casi (soccorso a persone, controlli e rimozione di veicoli, traffico).`,
          en: `The most significant types according to the report; the total of ${n(callTot)} call-outs also includes other cases (assistance to people, vehicle checks and removals, traffic).` },
        source: [usc(F.pol, `p. ${callP}, chart 'Interventi richiesti 2025': labels and values paired by line`)] }] },
    { id: "sicurezza.reati", constellation: "sicurezza", label: { it: "Reati al Codice penale", en: "Criminal-code offences" },
      about: { it: `Reati al Codice penale registrati a Lugano nel ${years[6]}: ${n(off.tb)} (${n(off.ta)} nel ${years[5]}), ${n(L.r25, 1)} ogni 1'000 abitanti; in Ticino ${n(T.r25, 1)}. La maggior parte riguarda il patrimonio (${n(off.rows[1].b)}). Inoltre ${n(drugs[6])} reati alla legge sugli stupefacenti e ${n(foreign[6])} alla legge sugli stranieri.`,
        en: `Criminal-code offences recorded in Lugano in ${years[6]}: ${n(off.tb)} (${n(off.ta)} in ${years[5]}), ${n(L.r25, 1)} per 1,000 residents; Ticino ${n(T.r25, 1)}. Most concern property (${n(off.rows[1].b)}). In addition, ${n(drugs[6])} drugs-law and ${n(foreign[6])} foreigners-law offences.` },
      value: off.tb, unit: "reati", year: years[6], area: "Lugano", kind: "official",
      method: { it: `Conteggio della polizia secondo le regole della statistica criminale di polizia (revisione 2009), per il territorio comunale. La frequenza ogni 1'000 abitanti è quella della statistica cantonale; non è confrontata con gli altri comuni perché, come avverte la statistica stessa, «le frequenze non possono tener conto delle popolazioni pendolari che, in particolare nelle grandi città, incidono in modo non indifferente sui tassi di delinquenza».`,
        en: `Police count by the rules of the police crime statistics (2009 revision), for the municipal territory. The rate per 1,000 residents is the cantonal statistics' own; it is not compared with other municipalities because, as the statistics themselves warn, "rates cannot account for commuting populations, which in large cities weigh considerably on offence rates".` },
      source: [usc(F.lic, `PDF p. ${off.p} (book p. 116–117): 'Reati al Codice penale' by type and by law ${years[0]}–${years[6]}`), usc(F.scp, `p. ${lugR.p}, table T4: rows 'Lugano' and 'Totale cantone'; p. ${caveat.p}: caveat on commuters`)],
      context: [{ label: { it: "Ogni 1'000 abitanti", en: "Per 1,000 residents" }, value: L.r25, unit: "‰" }, { label: { it: "Ticino, ogni 1'000 abitanti", en: "Ticino, per 1,000 residents" }, value: T.r25, unit: "‰" },
        { label: { it: "Legge sugli stupefacenti", en: "Drugs law" }, value: drugs[6], unit: "reati" }, { label: { it: "Legge sugli stranieri", en: "Foreigners law" }, value: foreign[6], unit: "reati" }],
      related: ["sicurezza.polizia", "sicurezza.incidenti"],
      detail: [
        { title: { it: `Reati al Codice penale per tipo, ${years[6]}`, en: `Criminal-code offences by type, ${years[6]}` },
          chart: { type: "hbars", unit: "reati", color: SC, caption: { it: `reati · ${years[6]} (tra parentesi il ${years[5]})`, en: `offences · ${years[6]} (${years[5]} in brackets)` },
            data: OFFENCES.map(([, it, en], k) => ({ key: `t${k}`, label: { it: `${it} (${n(off.rows[k].a)})`, en: `${en} (${n(off.rows[k].a)})` }, value: off.rows[k].b }))
              .filter((_, k) => off.rows[k].a + off.rows[k].b > 0).sort((a, b) => b.value - a.value) },
          note: { it: "Titoli con almeno un reato nei due anni.", en: "Titles with at least one offence over the two years." },
          source: [usc(F.lic, `PDF p. ${off.p}, table 'Reati al Codice penale (CP)'`)] },
        { title: { it: "Reati per legge, per anno", en: "Offences by law, by year" },
          chart: { type: "columns", unit: "reati", color: SC, series: [
            { label: { it: "Codice penale", en: "Criminal code" }, data: years.map((y, k) => ({ key: `c${y}`, label: yr(y), value: cp[k] })) },
            { label: { it: "Legge sugli stupefacenti", en: "Drugs law" }, data: years.map((y, k) => ({ key: `d${y}`, label: yr(y), value: drugs[k] })) }] },
          note: { it: `Legge sugli stranieri: ${years.map((y, k) => `${y} ${n(foreign[k])}`).join(", ")}.`, en: `Foreigners law: ${years.map((y, k) => `${y} ${n(foreign[k])}`).join(", ")}.` },
          source: [usc(F.lic, `PDF p. ${yrs.p}, table 'Evoluzione dei reati per tipologia'`)] }] },
    { id: "sicurezza.incidenti", constellation: "sicurezza", label: { it: "Incidenti stradali", en: "Road accidents" },
      about: { it: `Incidenti stradali sul territorio della Città nel 2025: ${n(accTot[12])}, ${n(pers[12])} con danni alle persone. Ci sono stati ${n(cDead[12])} morti, ${n(cSer[12])} feriti gravi e ${n(cLight[12])} feriti leggeri. Nel 2013 gli incidenti erano ${n(accTot[0])}.`,
        en: `Road accidents in the City's territory in 2025: ${n(accTot[12])}, ${n(pers[12])} with injuries. There were ${n(cDead[12])} deaths, ${n(cSer[12])} people seriously and ${n(cLight[12])} lightly injured. In 2013 there were ${n(accTot[0])} accidents.` },
      value: accTot[12], unit: "incidenti", year: 2025, area: "Lugano", kind: "official",
      source: [usc(F.lic, `PDF pp. ${accP.p}–${cas.p} (book p. 118–121): 'Incidenti stradali' and 'Infortunati per conseguenze', 2013–2025`)],
      context: [{ label: { it: "Con danni alle persone", en: "With injuries" }, value: pers[12], unit: "incidenti" }, { label: { it: "Morti", en: "Deaths" }, value: cDead[12], unit: "persone" },
        { label: { it: "Feriti gravi", en: "Seriously injured" }, value: cSer[12], unit: "persone" }],
      related: ["sicurezza.reati", "trasporti.strade"],
      detail: [
        { title: { it: "Incidenti stradali per anno", en: "Road accidents by year" },
          chart: { type: "columns", unit: "incidenti", color: SC, series: [
            { label: { it: "Solo danni materiali", en: "Damage only" }, data: accYears.map((y, k) => ({ key: `m${y}`, label: yr(y), value: mat[k] })) },
            { label: { it: "Con danni alle persone", en: "With injuries" }, data: accYears.map((y, k) => ({ key: `p${y}`, label: yr(y), value: pers[k] })) }] },
          note: { it: "Il rapporto della Polizia Città conta 641 incidenti nel 2025 sulla giurisdizione del Comune, con un'altra ripartizione; qui si usa la serie dell'annuario.", en: "The City police report counts 641 accidents in 2025 on the City's jurisdiction, with a different breakdown; the yearbook series is used here." },
          source: [usc(F.lic, `PDF p. ${accP.p}, table 'Incidenti per conseguenze'`)] },
        { title: { it: "Persone morte e ferite gravemente, per anno", en: "People killed and seriously injured, by year" },
          chart: { type: "columns", unit: "persone", color: SC, series: [
            { label: { it: "Feriti gravi", en: "Seriously injured" }, data: accYears.map((y, k) => ({ key: `s${y}`, label: yr(y), value: cSer[k] })) },
            { label: { it: "Morti", en: "Deaths" }, data: accYears.map((y, k) => ({ key: `d${y}`, label: yr(y), value: cDead[k] })) }] },
          source: [usc(F.lic, `PDF p. ${cas.p}, table 'Infortunati per conseguenze'`)] }] },
    { id: "sicurezza.pompieri", constellation: "sicurezza", label: { it: "Pompieri", en: "Fire service" },
      about: { it: `Spesa della Città per i vigili del fuoco (voce 150) nel 2024: ${n(ls["150"] / 1000, 2)} milioni di franchi, con ${n(lr["150"] / 1000, 2)} milioni di ricavi. La protezione civile (voce 162) è costata ${n(ls["162"] / 1000, 2)} milioni; la gestisce il Consorzio Protezione Civile Lugano Città, a cui la Città ha versato ${n(pc25 / 1e6, 2)} milioni nel 2025.`,
        en: `The City's spending on the fire service (line 150) in 2024: CHF ${n(ls["150"] / 1000, 2)} million, with CHF ${n(lr["150"] / 1000, 2)} million of revenue. Civil protection (line 162) cost CHF ${n(ls["162"] / 1000, 2)} million; it is run by the Lugano Città civil protection consortium, to which the City paid CHF ${n(pc25 / 1e6, 2)} million in 2025.` },
      value: ls["150"] / 1000, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: "Voce 150 «Vigili del fuoco» del conto economico 2024 della Città. Non è divisa per gli abitanti né confrontata con gli altri comuni: il corpo pompieri della Città interviene anche fuori dal territorio comunale, e i ricavi della voce lo riflettono. Il numero di interventi sarà aggiunto quando un documento ufficiale sarà archiviato (finora è solo nella stampa).",
        en: "Line 150 'Fire service' in the City's 2024 accounts. It is not divided by residents or compared with other municipalities: the City's fire brigade also works outside the municipal territory, and the line's revenue reflects it. The number of call-outs will be added once an official document is archived (so far it is only in the press)." },
      source: [src(APPENDICE, "sheets TabD and TabE, columns 150 and 162, row 'Lugano'"), usc(BUDGET27_MSG, `p. ${pc.p}: account 36121300 'Consorzio Protezione Civile Lugano Città'`)],
      context: [{ label: { it: "Ricavi 150", en: "Revenue 150" }, value: lr["150"] / 1000, unit: "mio CHF" }, { label: { it: "Protezione civile (162)", en: "Civil protection (162)" }, value: ls["162"] / 1000, unit: "mio CHF" }],
      related: ["sicurezza.spesa"],
      detail: [
        { title: { it: "Pompieri e protezione civile nei conti della Città, 2024", en: "Fire service and civil protection in the City's accounts, 2024" },
          chart: { type: "columns", unit: "mio CHF", digits: 2, color: SC, series: [
            { label: { it: "Spese", en: "Spending" }, data: [{ key: "a150", label: { it: "150 Vigili del fuoco", en: "150 Fire service" }, value: ls["150"] / 1000 }, { key: "a162", label: { it: "162 Protezione civile", en: "162 Civil protection" }, value: ls["162"] / 1000 }] },
            { label: { it: "Ricavi", en: "Revenue" }, data: [{ key: "b150", label: { it: "150 Vigili del fuoco", en: "150 Fire service" }, value: lr["150"] / 1000 }, { key: "b162", label: { it: "162 Protezione civile", en: "162 Civil protection" }, value: lr["162"] / 1000 }] }] },
          source: [src(APPENDICE, "sheets TabD and TabE, columns 150 and 162, row 'Lugano' (CHF thousands)")] },
        { title: { it: "Contributo della Città al consorzio di protezione civile", en: "City contribution to the civil protection consortium" },
          chart: { type: "columns", unit: "mio CHF", digits: 2, color: SC, series: [{ label: { it: "Contributo", en: "Contribution" }, data: [
            { key: "c25", label: { it: "Consuntivo 2025", en: "Actual 2025" }, value: pc25 / 1e6, status: "actual" as const },
            { key: "c26", label: { it: "Preventivo 2026", en: "Budget 2026" }, value: pc26 / 1e6, status: "budget" as const },
            { key: "c27", label: { it: "Preventivo 2027", en: "Budget 2027" }, value: pc27 / 1e6, status: "budget" as const }] }] },
          source: [usc(BUDGET27_MSG, `p. ${pc.p}: account 36121300 (budget 2027, budget 2026, actual 2025)`)] }] },
  ];
  return { stars, anchorDetail, total1 };
}

export const SICUREZZA_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.scp]: { url: "https://www4.ti.ch/fileadmin/DI/POLIZIA/documentazione/statistica/rapportiAttivita/statistica_criminale_2025.pdf", publisher: "Polizia cantonale / Ufficio federale di statistica – Statistica criminale di polizia (SCP) 2025, Cantone Ticino" },
  [F.pol]: { url: "https://www.lugano.ch/dam/jcr:420edcd4-ec4f-4526-9d73-7888d440f6f0/Presentazione%20conferenza%20stampa%20dati%202025_11%2005%202026_V1.pdf", publisher: "Città di Lugano, Polizia Città di Lugano – Rapporto d'attività 2025 (conferenza stampa, 11 maggio 2026)" },
};
