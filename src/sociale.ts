// The social security constellation (SOCIAL-SOURCES.md): what function 5 of the accounts is made of, the City's legal
// share of cantonal schemes, social assistance (BFS persons and City cases), supplementary benefits, the City's own
// benefits and its nurseries. Tables are read by column; PDF phrases by page; the yearbook's charts by pairing each
// label with its year by position on the page. Every figure is checked against a total, a sum or the text around it.

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { compare, type Datum, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, rawPath, sheet, type Row } from "./adapters/common";
import { matcher, type Municipality } from "./adapters/municipalities";
import { APPENDICE } from "./adapters/sel";
import { readPdf } from "./adapters/pdf";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const SC = "var(--sociale)";
export const F = {
  lic: "lugano-in-cifre-2026.pdf", bfs: "bfs-ssv-social-2026.csv", nidi: "mm-interrogazione-1426-nidi.pdf", lalpc: "ti-lalpc-851200.pdf",
};
/** the City's legal share of cantonal schemes (LaLPC art. 33): premium subsidies and supplementary benefits to AI and AVS */
const CANTONAL = ["512", "522", "532"];
const LINES: [string, string, string][] = [
  ["512", "Riduzioni dei premi", "Health-insurance premium subsidies"], ["522", "Prestazioni complementari all'AI", "Supplementary benefits to disability pensions"],
  ["532", "Prestazioni complementari AVS", "Supplementary benefits to old-age pensions"], ["531", "Assicurazione vecchiaia e superstiti (AVS)", "Old-age and survivors' insurance (AVS)"],
  ["533", "Prestazioni per pensionati", "Benefits for pensioners"], ["535", "Prestazioni di vecchiaia", "Old-age benefits"],
  ["544", "Protezione dei giovani", "Youth protection"], ["545", "Prestazioni a famiglie", "Family benefits"],
  ["572", "Aiuto economico", "Economic aid"], ["579", "Assistenza, n. m. a.", "Assistance, other"],
  ["592", "Azioni d'aiuto in Svizzera", "Aid in Switzerland"], ["593", "Azioni d'aiuto all'estero", "Aid abroad"],
];

const int = (s: string) => Number(s.replace(/[\s’']/g, ""));
const N = String.raw`\d{1,3}(?:[’'] ?\d{3})*`;
type Item = { s: string; x: number; y: number };
/** Page texts and positioned items of the given pages (all when omitted). */
const pdfRead = (file: string, wanted?: number[]) => readPdf(file, wanted);
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}
/**
 * A column chart printed as loose labels: year labels on one baseline, value labels above their columns.
 * Pairs each year with the one value label centred over it (within 6 points); fails on a missing or double match.
 */
function chartSeries(items: Item[], yearRow: number, valueRe: RegExp, band: [number, number], file: string) {
  const years = items.filter((i) => /^20\d\d$/.test(i.s) && Math.abs(i.y - yearRow) < 1).sort((a, b) => a.x - b.x);
  const vals = items.filter((i) => valueRe.test(i.s.replace(/\s/g, "")) && i.y > band[0] && i.y < band[1]);
  if (years.length < 5) fail(`${file}: chart at y=${yearRow} has ${years.length} year labels`);
  return years.map((yr) => {
    const hit = vals.filter((v) => Math.abs(v.x - yr.x) < 6);
    if (hit.length !== 1) fail(`${file}: year ${yr.s} has ${hit.length} value labels`);
    return { y: Number(yr.s), v: int(hit[0].s.replace(/\s/g, "")) };
  });
}

export async function sociale(register: Municipality[], src: Src) {
  const pop24 = new Map(register.map((m) => [m.bfs, m.population]));
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;
  const lugPop = pop24.get(5192)!;

  // ---- function 5 by line (appendice TabD spending, TabE revenue), every municipality
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
  const total5 = Object.values(ls).reduce((s, v) => s + v, 0) / 1000;
  const cantonal = CANTONAL.reduce((s, c) => s + ls[c], 0) / 1000;

  // ---- LaLPC art. 33: the rule for the municipal share (cited, not recomputed: the 2024 percentages are not in this text)
  const law = await pdfRead(F.lalpc);
  const a33 = findPage(law.pages, /Il contributo annuo del singolo Comune corrisponde: a\) al (\d+,\d)% del gettito d’imposta cantonale per i Comuni finanziariamente forti/, F.lalpc);
  const lawState = findPage(law.pages, /\(stato (\d{1,2}°? \w+ \d{4})\)/, F.lalpc).m[1];

  // ---- BFS city statistics: persons on social assistance and their share of residents, 2015–2024
  const csv = XLSX.read(readFileSync(rawPath(F.bfs), "utf8"), { type: "string", raw: true });
  const bfsRows = XLSX.utils.sheet_to_json<Record<string, string>>(csv.Sheets[csv.SheetNames[0]], { defval: "", raw: true });
  const obs = (city: number, k: string) => new Map(bfsRows.filter((r) => Number(r.SSV_SWISS_CITY) === city && r.SSV_SOCIAL === k)
    .map((r) => [Number(r.TIME_PERIOD), Number(r.OBS_VALUE)]));
  const rate = obs(5192, "tx_soc"), persons = obs(5192, "t_soc");
  const bYear = Math.max(...rate.keys());
  const bRate = rate.get(bYear)!, bPersons = persons.get(bYear) ?? fail(`${F.bfs}: persons ${bYear} missing`);
  // the BFS divides by its own population; ours (31.12.2024) must give the same rate to one decimal
  if (Math.abs((bPersons / lugPop) * 100 - bRate) > 0.15) fail(`${F.bfs}: ${bPersons} / ${lugPop} does not give ${bRate}%`);
  const tiCities = [...new Set(bfsRows.map((r) => Number(r.SSV_SWISS_CITY)).filter((b) => b >= 5001 && b <= 5399))]
    .map((b) => ({ bfs: b, name: bfsRows.find((r) => Number(r.SSV_SWISS_CITY) === b)!["Schweizer Städte"], v: obs(b, "tx_soc").get(bYear)! }))
    .filter((c) => Number.isFinite(c.v)).sort((a, b) => b.v - a.v);
  const rateSeries = [...rate].sort((a, b) => a[0] - b[0]);

  // ---- City yearbook (Lugano in cifre 2026), chapter Socialità
  const lic = await pdfRead(F.lic, [54, 55, 56]);
  const pg = findPage(lic.pages, /Evoluzione dei casi di assistenza Evoluzione delle partecipazioni comunali alle spese di assistenza/, F.lic);
  const items = lic.items[pg.p - 1];
  // an axis is a row of at least five year labels (a lone year elsewhere on the page is text)
  const yearYs = items.filter((i) => /^20\d\d$/.test(i.s)).map((i) => Math.round(i.y * 10) / 10);
  const yearRows = [...new Set(yearYs)].filter((y) => yearYs.filter((v) => v === y).length >= 5).sort((a, b) => b - a);
  if (yearRows.length !== 2) fail(`${F.lic} p. ${pg.p}: expected 2 charts, found ${yearRows.length} year rows`);
  // cases: thousands with an apostrophe; City share: one decimal (CHF million); the axis labels sit left of the first year
  const firstX = Math.min(...items.filter((i) => /^20\d\d$/.test(i.s) && yearRows.includes(Math.round(i.y * 10) / 10)).map((i) => i.x)) - 6;
  const right = items.filter((i) => i.x > firstX);
  const cases = chartSeries(right, yearRows[0], /^\d['’]\d{3}$/, [yearRows[0], yearRows[0] + 200], F.lic);
  const share = chartSeries(right, yearRows[1], /^\d\.\d$/, [yearRows[1], yearRows[0]], F.lic);
  const cNow = cases[cases.length - 1], cPrev = cases[cases.length - 2], shNow = share[share.length - 1], shPrev = share[share.length - 2];
  // the chapter's text says cases rose in the last year and the City's share stayed the same
  // (the layout breaks words with "as - sistenza"; rejoin them before reading the sentence)
  const text54 = lic.pages[pg.p - 1].replace(/(\p{Ll}) ?[-‐] (?=\p{Ll})/gu, "$1");
  const said = text54.match(/A Lugano nel (\d{4}) è aumentato il numero di casi di assistenza sociale, mentre sono rimaste invariate le partecipazioni comunali/);
  if (!said || Number(said[1]) !== cNow.y || !(cNow.v > cPrev.v) || shNow.v !== shPrev.v) fail(`${F.lic}: chart values disagree with the text (cases ${cPrev.v}→${cNow.v}, share ${shPrev.v}→${shNow.v})`);

  const pcP = findPage(lic.pages, new RegExp(`Beneficiari di rendita (\\d{4}) AVS (${N}) AI (${N}) ∑ (${N}) di cui beneficiari PC (${N}) di cui beneficiari AGI (${N})`), F.lic);
  const [pcYear, avs, ai, pens, pc, agi] = pcP.m.slice(1, 7).map(int);
  if (avs + ai !== pens) fail(`${F.lic}: AVS ${avs} + AI ${ai} is not ${pens}`);

  const rp = findPage(lic.pages, new RegExp(`(\\d{4}) (\\d{4}) Variazione Domande (${N}) (${N}) ‒(${N}) .{0,12}?Importo preavvisato \\(CHF\\) (${N}) (${N}) ‒(${N})`), F.lic);
  const [rY0, rY1, dPrev, dNow, dDiff, aPrev, aNow, aDiff] = rp.m.slice(1, 9).map(int);
  if (dPrev - dNow !== dDiff || aPrev - aNow !== aDiff) fail(`${F.lic}: municipal benefits ${dPrev}→${dNow}, ${aPrev}→${aNow} do not match the printed changes`);
  const okP = findPage(lic.pages, /Domande con esito favorevole ed evase (\d+) (\d+) (\d+) \(/, F.lic);
  const [gPrev, gNow, gDiff] = okP.m.slice(1, 4).map(Number);
  if (gNow - gPrev !== gDiff) fail(`${F.lic}: granted requests ${gPrev}→${gNow} are not +${gDiff}`);
  const CATS: [string, string, string][] = [["Eventi straordinari e altri bisogni puntuali", "Eventi straordinari e altri bisogni", "Emergencies and other one-off needs"],
    ["Alloggio e garanzia per la locazione di alloggi", "Alloggio e garanzia d'affitto", "Housing and rent deposits"], ["Salute e cure odontoiatriche", "Salute e cure dentarie", "Health and dental care"],
    ["Servizi funebri e di sepoltura", "Servizi funebri", "Funerals"], ["Partecipazione bambini/adolescenti a colonie diurne e colonie riconosciute \\(TI\\)", "Colonie per bambini e ragazzi", "Children's holiday camps"],
    ["Attività a pagamento in ambito scolastico", "Attività scolastiche a pagamento", "Paid school activities"], ["Altro", "Altro", "Other"]];
  const catP = findPage(lic.pages, new RegExp(CATS.map(([re]) => `${re} (\\d+) \\d+\\.\\d%`).join(" ") + ` ∑ (\\d+)`), F.lic);
  const cats = CATS.map(([, it, en], k) => ({ it, en, v: int(catP.m[k + 1]) }));
  if (cats.reduce((s, c) => s + c.v, 0) !== int(catP.m[CATS.length + 1]) || int(catP.m[CATS.length + 1]) !== dNow) fail(`${F.lic}: benefit categories do not add up to ${dNow}`);
  const mor = findPage(lic.pages, /(\d{4}) Casi segnalati (\d+) Casi convocati (\d+) Casi richiamati (\d+)/, F.lic);

  // ---- the City's nurseries (Municipio's answer no. 1426): the table by nursery and the stated total
  const nd = await pdfRead(F.nidi);
  const NIDI = ["Polis", "Molino Nuovo", "Baroffio", "Ronchetto"];
  const nidiP = findPage(nd.pages, /gestiti dal LIS: Denominazione Indirizzo Ospiti (.+?) Nidi d’infanzia privati/, F.nidi);
  const nidi = NIDI.map((nm) => {
    const m = nidiP.m[1].match(new RegExp(`N ?i ?d ?o ${nm} Via .+? (\\d+)(?= \\d N ?i ?d ?o|$)`));
    return { nm, v: m ? Number(m[1]) : fail(`${F.nidi}: nursery ${nm} not found`) };
  });
  const listed = nidi.reduce((s, x) => s + x.v, 0);
  const nt = findPage(nd.pages, /Gli asili nido di proprietà della Città di Lugano offrono (\d+) posti, di cui (\d+) in regime di protezione\. Nel (\d{4}) sono stati accolti circa (\d+) bambini/, F.nidi);
  const [places, protect, nYear, children] = nt.m.slice(1, 5).map(Number);
  const occ = findPage(nd.pages, /L’occupazione è pari al (\d+)%/, F.nidi);
  const priv = findPage(nd.pages, /Su un totale di (\d+) strutture riconosciute presenti nel Luganese .{0,60}?, (\d+) sono ubicate a Lugano/, F.nidi);

  const usc = (file: string, what: string) => src(file, what);
  const lineData = (codes: string[], m: Record<string, number>) => LINES.filter(([c]) => codes.includes(c) && m[c] > 0)
    .map(([c, it, en]) => ({ key: `l${c}`, label: { it: `${c} ${it}`, en: `${c} ${en}` }, value: m[c] / 1000 }))
    .sort((a, b) => b.value - a.value) as Datum[];
  const own = LINES.map(([c]) => c).filter((c) => !CANTONAL.includes(c));
  const anchorDetail = [
    { title: { it: "Sicurezza sociale nei conti della Città, 2024: spese per voce", en: "Social security in the City's accounts, 2024: spending by line" } as Text,
      chart: { type: "hbars" as const, unit: "mio CHF", digits: 2, color: SC, caption: { it: "mio CHF · 2024 · spesa lorda", en: "CHF million · 2024 · gross spending" }, data: lineData(LINES.map(([c]) => c), ls) },
      note: { it: `Le voci 512, 522 e 532 (${n(cantonal, 1)} milioni, ${n((cantonal / total5) * 100, 0)}%) sono la quota di legge della Città ai regimi cantonali; vedi la stella «Contributi ai regimi cantonali».`,
        en: `Lines 512, 522 and 532 (CHF ${n(cantonal, 1)} million, ${n((cantonal / total5) * 100, 0)}%) are the City's legal share of cantonal schemes; see the star "Contributions to cantonal schemes".` },
      source: [src(APPENDICE, "sheet TabD, columns 512–593, row 'Lugano' (CHF thousands)")] },
    { title: { it: "Servizi della Città: spese e ricavi per voce, 2024", en: "The City's own services: spending and revenue by line, 2024" } as Text,
      chart: { type: "columns" as const, unit: "mio CHF", digits: 2, color: SC, series: [
        { label: { it: "Spese", en: "Spending" }, data: lineData(own, ls).filter((d) => d.value >= 0.4).map((d) => ({ ...d, key: `a${d.key}` })) },
        { label: { it: "Ricavi", en: "Revenue" }, data: lineData(own, ls).filter((d) => d.value >= 0.4).map((d) => ({ ...d, key: `b${d.key}`, value: lr[d.key.slice(1)] / 1000 })) }] },
      note: { it: "Voci sopra 0,4 milioni di spesa.", en: "Lines above CHF 0.4 million of spending." },
      source: [src(APPENDICE, "sheets TabD (spending) and TabE (revenue), columns 531–593, row 'Lugano' (CHF thousands)")] },
  ];

  const stars: Star[] = [
    { id: "sociale.contributi", constellation: "sociale", label: { it: "Contributi ai regimi cantonali", en: "Contributions to cantonal schemes" },
      about: { it: `Quota di legge della Città per la riduzione dei premi di cassa malati e per le prestazioni complementari all'AVS e all'AI: ${n(cantonal, 1)} milioni nel 2024, ${n((cantonal / total5) * 100, 0)}% della spesa per la sicurezza sociale. Le prestazioni le versa il Cantone; ogni comune contribuisce in base al suo gettito d'imposta cantonale.`,
        en: `The City's legal share of health-insurance premium subsidies and of supplementary benefits to AVS and AI pensions: CHF ${n(cantonal, 1)} million in 2024, ${n((cantonal / total5) * 100, 0)}% of its social security spending. The Canton pays the benefits; each municipality contributes according to its cantonal tax yield.` },
      value: cantonal, unit: "mio CHF", year: 2024, area: "Lugano", kind: "derived", operator: "canton",
      method: { it: `Somma dei conti 512, 522 e 532 del conto economico 2024 della Città. È ciò che il Cantone riscuote dalla Città, non dagli abitanti: per questo la cifra non è divisa per la popolazione. Non è confrontata con gli altri comuni, perché per legge dipende dal gettito d'imposta cantonale di ciascun comune: il confronto mostrerebbe la forza fiscale dei comuni, non un costo per i loro abitanti. La regola è nella LaLPC, art. 33: il contributo di ogni comune è una percentuale del suo gettito d'imposta cantonale, graduata secondo la forza finanziaria (nel testo in vigore dal ${lawState}: ${a33.m[1]}% per i comuni finanziariamente forti). Le percentuali applicate nel 2024 non sono in questo testo, quindi il contributo non è ricalcolato.`,
        en: `Sum of accounts 512, 522 and 532 in the City's 2024 accounts. It is what the Canton collects from the City, not from residents, so the figure is not divided by the population. It is not compared with other municipalities, because by law it depends on each municipality's cantonal tax yield: the comparison would show the municipalities' tax strength, not a cost for their residents. The rule is in LaLPC art. 33: each municipality pays a percentage of its cantonal tax yield, graded by financial strength (in the text in force since ${lawState}: ${a33.m[1].replace(",", ".")}% for financially strong municipalities). The percentages applied in 2024 are not in this text, so the contribution is not recomputed.` },
      source: [src(APPENDICE, "sheet TabD, columns 512, 522, 532, row 'Lugano' (CHF thousands)"), usc(F.lalpc, `p. ${a33.p}, art. 33 cpv. 2`)],
      context: [{ label: { it: "Quota della spesa sociale", en: "Share of social spending" }, value: (cantonal / total5) * 100, unit: "%" },
        { label: { it: "Riduzione dei premi (512)", en: "Premium subsidies (512)" }, value: ls["512"] / 1000, unit: "mio CHF" },
        { label: { it: "Prestazioni complementari (522 + 532)", en: "Supplementary benefits (522 + 532)" }, value: (ls["522"] + ls["532"]) / 1000, unit: "mio CHF" }],
      related: ["sociale.spesa", "sociale.pc", "finanze.imposte-pf"],
      detail: [{ title: { it: "Le tre voci, 2024", en: "The three lines, 2024" },
        chart: { type: "hbars", unit: "mio CHF", digits: 2, color: SC, caption: { it: "mio CHF · 2024", en: "CHF million · 2024" }, data: lineData(CANTONAL, ls) },
        source: [src(APPENDICE, "sheet TabD, columns 512, 522, 532, row 'Lugano'")] }] },
    { id: "sociale.assistiti", constellation: "sociale", label: { it: "Persone in assistenza", en: "People on social assistance" },
      about: { it: `Persone sostenute dall'aiuto sociale a Lugano nel ${bYear}, secondo l'Ufficio federale di statistica: ${n(bPersons)}, il ${n(bRate, 1)}% dei residenti. Contano tutte le persone delle economie domestiche sostenute durante l'anno. Nel ${bYear} i dati ticinesi risentono di un cambio di rilevazione: l'aumento rispetto al ${bYear - 1} va letto con cautela.`,
        en: `People supported by social assistance in Lugano in ${bYear}, according to the Federal Statistical Office: ${n(bPersons)}, ${n(bRate, 1)}% of residents. Every member of a supported household during the year counts. In ${bYear} the Ticino figures are affected by a change in data collection: the rise from ${bYear - 1} should be read with care.` },
      value: bRate, unit: "%", digits: 1, year: bYear, area: "Lugano", kind: "official",
      source: [usc(F.bfs, `rows SSV_SWISS_CITY 5192, SSV_SOCIAL tx_soc and t_soc, ${rateSeries[0][0]}–${bYear}`)],
      context: [{ label: { it: "Persone", en: "People" }, value: bPersons, unit: "persone" }, { label: { it: `Persone nel ${bYear - 1}`, en: `People in ${bYear - 1}` }, value: persons.get(bYear - 1)!, unit: "persone" }],
      related: ["sociale.casi", "sociale.spesa"],
      detail: [
        { title: { it: "Quota di persone in assistenza a Lugano, per anno", en: "Share of residents on social assistance in Lugano, by year" },
          chart: { type: "columns", unit: "%", digits: 1, color: SC, series: [{ label: { it: "Quota dei residenti", en: "Share of residents" },
            data: rateSeries.map(([y, v]) => ({ key: `a${y}`, label: { it: String(y), en: String(y) }, value: v, note: { it: `${n(persons.get(y)!)} persone`, en: `${n(persons.get(y)!)} people` } })) }] },
          note: { it: `L'UST avverte che in Ticino i dati ${bYear} contano circa 200 dossier in più per la prima fornitura con la statistica modernizzata. Nello stesso anno i casi seguiti dalla Città sono passati da ${n(cases.find((c) => c.y === bYear - 1)!.v)} a ${n(cases.find((c) => c.y === bYear)!.v)}.`,
            en: `The FSO warns that Ticino's ${bYear} figures include about 200 more dossiers because of the first delivery under the modernised statistics. In the same year the cases handled by the City went from ${n(cases.find((c) => c.y === bYear - 1)!.v)} to ${n(cases.find((c) => c.y === bYear)!.v)}.` },
          source: [usc(F.bfs, "rows SSV_SWISS_CITY 5192, tx_soc and t_soc")] },
        { title: { it: `Le città ticinesi, ${bYear}`, en: `Ticino's cities, ${bYear}` },
          chart: { type: "hbars", unit: "%", digits: 1, color: SC, caption: { it: `% dei residenti · ${bYear}`, en: `% of residents · ${bYear}` },
            data: tiCities.map((c) => ({ key: `c${c.bfs}`, label: { it: c.name, en: c.name }, value: c.v })) },
          note: { it: `Solo queste ${tiCities.length} città ticinesi sono nella statistica delle città svizzere; per gli altri comuni la quota non è pubblicata.`,
            en: `Only these ${tiCities.length} Ticino cities are in the Swiss city statistics; the rate is not published for the other municipalities.` },
          source: [usc(F.bfs, `rows SSV_SWISS_CITY ${tiCities.map((c) => c.bfs).join(", ")}, tx_soc, ${bYear}`)] }] },
    { id: "sociale.casi", constellation: "sociale", label: { it: "Casi di assistenza", en: "Social assistance cases" },
      about: { it: `Casi di assistenza seguiti dallo sportello LAPS della Città nel ${cNow.y}: ${n(cNow.v)}, contro ${n(cPrev.v)} nel ${cPrev.y}. La Città raccoglie le domande e le inoltra al Cantone, che decide e paga; la Città partecipa alla spesa con ${n(shNow.v, 1)} milioni (${shNow.y}). È un conteggio di casi, non di persone.`,
        en: `Social assistance cases handled by the City's LAPS desk in ${cNow.y}: ${n(cNow.v)}, against ${n(cPrev.v)} in ${cPrev.y}. The City takes the applications and forwards them to the Canton, which decides and pays; the City contributes CHF ${n(shNow.v, 1)} million (${shNow.y}). It counts cases, not people.` },
      value: cNow.v, unit: "casi", year: cNow.y, area: "Lugano", kind: "official",
      source: [usc(F.lic, `PDF p. ${pg.p} (book p. 96–97), charts 'Evoluzione dei casi di assistenza' and 'Evoluzione delle partecipazioni comunali': value labels paired with year labels by position`)],
      context: [{ label: { it: `Partecipazione della Città, ${shNow.y}`, en: `City contribution, ${shNow.y}` }, value: shNow.v, unit: "mio CHF" }],
      related: ["sociale.assistiti", "sociale.prestazioni"],
      detail: [
        { title: { it: "Casi di assistenza, per anno", en: "Social assistance cases, by year" },
          chart: { type: "columns", unit: "casi", color: SC, series: [{ label: { it: "Casi", en: "Cases" }, data: cases.map((p) => ({ key: `a${p.y}`, label: { it: String(p.y), en: String(p.y) }, value: p.v })) }] },
          source: [usc(F.lic, `PDF p. ${pg.p}, chart 'Evoluzione dei casi di assistenza'`)] },
        { title: { it: "Partecipazione della Città alle spese di assistenza, per anno", en: "City contribution to social assistance costs, by year" },
          chart: { type: "columns", unit: "mio CHF", digits: 1, color: SC, series: [{ label: { it: "Partecipazione", en: "Contribution" }, data: share.map((p) => ({ key: `a${p.y}`, label: { it: String(p.y), en: String(p.y) }, value: p.v })) }] },
          note: { it: `Cifre arrotondate a 0,1 milioni nell'annuario. Non è la stessa misura della voce 572 dei conti («aiuto economico», ${n(ls["572"] / 1000, 2)} milioni nel 2024): le due cifre non vanno confrontate.`,
            en: `Figures rounded to CHF 0.1 million in the yearbook. It is not the same measure as account line 572 ("economic aid", CHF ${n(ls["572"] / 1000, 2)} million in 2024): the two figures should not be compared.` },
          source: [usc(F.lic, `PDF p. ${pg.p}, chart 'Evoluzione delle partecipazioni comunali alle spese di assistenza (in mio CHF)'`)] }] },
    { id: "sociale.pc", constellation: "sociale", label: { it: "Prestazioni complementari", en: "Supplementary benefits" },
      about: { it: `Nel ${pcYear} a Lugano ${n(pens)} persone ricevevano una rendita AVS o AI; ${n(pc)} (${n((pc / pens) * 100, 1)}%) ricevevano anche le prestazioni complementari, che completano le rendite troppo basse. Le versa la Cassa cantonale di compensazione; l'agenzia AVS della Città consiglia e inoltra le domande.`,
        en: `In ${pcYear}, ${n(pens)} people in Lugano received an AVS or AI pension; ${n(pc)} (${n((pc / pens) * 100, 1)}%) also received supplementary benefits, which top up pensions that are too low. The cantonal compensation fund pays them; the City's AVS agency advises and forwards applications.` },
      value: pc, unit: "beneficiari", year: pcYear, area: "Lugano", kind: "official", operator: "canton",
      source: [usc(F.lic, `PDF p. ${pcP.p} (book p. 98–99): 'Beneficiari di rendita ${pcYear} AVS … AI … ∑ … di cui beneficiari PC …'`)],
      context: [{ label: { it: "Rendite AVS", en: "AVS pensions" }, value: avs, unit: "persone" }, { label: { it: "Rendite AI", en: "AI pensions" }, value: ai, unit: "persone" },
        { label: { it: "Assegno per grandi invalidi", en: "Helplessness allowance" }, value: agi, unit: "persone" }],
      cityCost: { value: (ls["522"] + ls["532"]) / 1000, code: "522+532", year: 2024 },
      related: ["sociale.contributi"],
      detail: [{ title: { it: `Beneficiari di rendita a Lugano, ${pcYear}`, en: `Pension recipients in Lugano, ${pcYear}` },
        chart: { type: "hbars", unit: "persone", color: SC, caption: { it: `persone · ${pcYear}`, en: `people · ${pcYear}` },
          data: [{ key: "avs", label: { it: "Rendita AVS", en: "AVS pension" }, value: avs }, { key: "ai", label: { it: "Rendita AI", en: "AI pension" }, value: ai },
            { key: "pc", label: { it: "di cui con prestazioni complementari", en: "of whom with supplementary benefits" }, value: pc },
            { key: "agi", label: { it: "di cui con assegno per grandi invalidi", en: "of whom with a helplessness allowance" }, value: agi }] },
        source: [usc(F.lic, `PDF p. ${pcP.p}`)] }] },
    { id: "sociale.prestazioni", constellation: "sociale", label: { it: "Prestazioni comunali", en: "Municipal benefits" },
      about: { it: `Aiuti temporanei della Città secondo il suo Regolamento sociale (alloggio, salute, emergenze, servizi funebri, attività scolastiche): ${n(dNow)} domande nel ${rY1}, ${n(gNow)} accolte, per ${n(aNow)} franchi; nel ${rY0} erano ${n(dPrev)} domande, ${n(gPrev)} accolte, per ${n(aPrev)} franchi. Secondo l'annuario il calo delle domande segue le consulenze di educazione finanziaria introdotte dalla Città.`,
        en: `The City's temporary aid under its social regulation (housing, health, emergencies, funerals, school activities): ${n(dNow)} requests in ${rY1}, ${n(gNow)} granted, for CHF ${n(aNow)}; in ${rY0} there were ${n(dPrev)} requests, ${n(gPrev)} granted, for CHF ${n(aPrev)}. According to the yearbook, the fall in requests follows the financial-education advice the City introduced.` },
      value: dNow, unit: "domande", year: rY1, area: "Lugano", kind: "official",
      source: [usc(F.lic, `PDF p. ${rp.p} (book p. 98–99): table 'Regolamento sulle prestazioni comunali in ambito sociale'`), usc(F.lic, `PDF p. ${catP.p}: 'Ripartizione per categorie'`)],
      context: [{ label: { it: "Importo", en: "Amount" }, value: aNow, unit: "CHF" }, { label: { it: `Domande accolte`, en: `Requests granted` }, value: gNow, unit: "domande" }, { label: { it: `Domande nel ${rY0}`, en: `Requests in ${rY0}` }, value: dPrev, unit: "domande" },
        { label: { it: `Morosi cassa malati segnalati (${mor.m[1]})`, en: `Health-insurance arrears reported (${mor.m[1]})` }, value: Number(mor.m[2]), unit: "casi" }],
      related: ["sociale.casi"],
      detail: [{ title: { it: `Domande per categoria, ${rY1}`, en: `Requests by category, ${rY1}` },
        chart: { type: "hbars", unit: "domande", color: SC, caption: { it: `domande · ${rY1}`, en: `requests · ${rY1}` },
          data: cats.map((c, k) => ({ key: `k${k}`, label: { it: c.it, en: c.en }, value: c.v })).sort((a, b) => b.value - a.value) },
        note: { it: `Morosi delle casse malati: ${mor.m[2]} casi segnalati dal Cantone, ${mor.m[3]} convocati, ${mor.m[4]} richiamati (${mor.m[1]}).`,
          en: `Health-insurance arrears: ${mor.m[2]} cases reported by the Canton, ${mor.m[3]} convened, ${mor.m[4]} recalled (${mor.m[1]}).` },
        source: [usc(F.lic, `PDF p. ${catP.p}: 'Ripartizione per categorie' and 'Morosi casse malati'`)] }] },
    { id: "sociale.nidi", constellation: "sociale", label: { it: "Asili nido della Città", en: "City nurseries" },
      about: { it: `La Città possiede ${NIDI.length} asili nido, gestiti dal suo ente autonomo LIS: ${places} posti, di cui ${protect} per la protezione dei minori, occupati al ${occ.m[1]}%. Nel ${nYear} hanno accolto circa ${children} bambini. Gli asili nido non sono un compito obbligatorio del Comune; a Lugano ci sono anche ${Number(priv.m[2]) - NIDI.length} nidi privati riconosciuti.`,
        en: `The City owns ${NIDI.length} nurseries, run by its autonomous body LIS: ${places} places, ${protect} of them for child protection, ${occ.m[1]}% occupied. In ${nYear} they took in about ${children} children. Nurseries are not a compulsory municipal task; Lugano also has ${Number(priv.m[2]) - NIDI.length} recognised private nurseries.` },
      value: places, unit: "posti", year: 2024, area: "Lugano", kind: "official",
      source: [usc(F.nidi, `p. ${nt.p}: "offrono ${places} posti, di cui ${protect} in regime di protezione"`), usc(F.nidi, `p. ${nidiP.p}: table 'Nidi d’infanzia pubblici'`)],
      context: [{ label: { it: `Bambini accolti (${nYear})`, en: `Children (${nYear})` }, value: children, unit: "persone" },
        { label: { it: "Prestazioni a famiglie (545), spesa 2024", en: "Family benefits (545), 2024 spending" }, value: ls["545"] / 1000, unit: "mio CHF" }],
      related: ["sociale.spesa", "istruzione.infanzia"],
      detail: [{ title: { it: "Posti per asilo nido", en: "Places by nursery" },
        chart: { type: "hbars", unit: "posti", color: SC, caption: { it: "ospiti per struttura", en: "places per nursery" },
          data: nidi.map((x) => ({ key: x.nm, label: { it: `Nido ${x.nm}`, en: `${x.nm} nursery` }, value: x.v })).sort((a, b) => b.value - a.value) },
        note: { it: `La tabella somma ${listed} posti, il testo ne indica ${places}, di cui ${protect} per la protezione dei minori. La differenza è uguale a questi ${protect} posti, ma la risposta non dice che sono fuori dalla tabella.`,
          en: `The table adds up to ${listed} places, the text states ${places}, ${protect} of them for child protection. The gap equals those ${protect} places, but the answer does not say they are outside the table.` },
        source: [usc(F.nidi, `p. ${nidiP.p}: table 'Nidi d’infanzia pubblici, di proprietà della Città di Lugano e gestiti dal LIS'`)] }] },
  ];
  if (listed > places) fail(`${F.nidi}: table ${listed} exceeds stated ${places}`);
  return { stars, anchorDetail, total5 };
}

export const SOCIALE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.lic]: { url: "https://statistica.lugano.ch/site/wp-content/uploads/2026/06/A5_LiC_2026_Web_def.pdf", publisher: "Città di Lugano, Lugano in cifre 2026 (giugno 2026)" },
  [F.bfs]: { url: "https://disseminate.stats.swiss/rest/data/CH1.SSV,DF_SSV_SOCIAL,/all?format=csvfilewithlabels", publisher: "Ufficio federale di statistica / Unione delle città svizzere – Statistica delle città svizzere 2026, beneficiari dell'aiuto sociale (DF_SSV_SOCIAL)" },
  [F.nidi]: { url: "https://www.lugano.ch/downloadCc?name=RispostaInterrogazione_1426.pdf&type=risposte&unid=6AE9B8E9477E45FFC1258B6A0030C1D3", publisher: "Città di Lugano, risposta del Municipio all'interrogazione n. 1426 sugli asili nido (30 luglio 2024)" },
  [F.lalpc]: { url: "https://www3.ti.ch/CAN/RLeggi/public/index.php/raccolta-leggi/pdfatto/atto/12083", publisher: "Cantone Ticino, Legge di applicazione della LPC (LaLPC, RL 851.200), stato 1° gennaio 2026" },
};
