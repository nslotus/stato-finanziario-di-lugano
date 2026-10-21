// The culture and sport constellation (CULTURE-SOURCES.md): function 3 by line, the City's contributions to cultural
// institutions, LAC, museums, shows and events, sport, and the sports and events hub (PSE). Tables by column, PDF
// phrases by page; every figure is checked against a total, a sum or a printed difference.

import { readFileSync } from "node:fs";
import { compare, type Datum, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, rawPath, sheet, type Row } from "./adapters/common";
import { matcher, type Municipality } from "./adapters/municipalities";
import { APPENDICE } from "./adapters/sel";
import { BUDGET27_MSG } from "./adapters/finance";
import { readPdf } from "./adapters/pdf";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const CC = "var(--cultura)";
export const F = {
  lic: "lugano-in-cifre-2026.pdf", lac: "lac-risultati-stagione-2024-25.pdf", masi: "ti-messaggio-8488-masi.pdf",
  arena: "20250117-cs-acquisto-arena-pse.pdf", lease: "20250814-cs-locazione-arena-pse.pdf", pala: "20251113-cs-acquisto-palazzetto-pse.pdf",
  maglio: "mm-12253-maglio.pdf", info: "pse-infopoint.pdf",
};
const LINES: [string, string, string][] = [
  ["311", "Musei e arti figurative", "Museums and visual arts"], ["312", "Patrimonio storico e culturale", "Heritage"],
  ["321", "Biblioteche", "Libraries"], ["322", "Concerti e teatri", "Concerts and theatres"], ["329", "Cultura, n. m. a.", "Culture, other"],
  ["331", "Film e cinema", "Film and cinema"], ["332", "Mass media", "Mass media"], ["341", "Sport", "Sport"],
  ["342", "Tempo libero", "Leisure"], ["350", "Chiese e affari religiosi", "Churches and religious affairs"],
];
const CULTURE = ["311", "322", "329"];
/** the City's contributions to cultural institutions in the 2027 budget message: account, label it/en */
const SHORT: Record<string, string> = { "36121900": "LAC fisso", "36121901": "LAC variabile", "36363001": "MASI", "36363002": "MUSEC", "36363004": "OSI", "36363006": "Filarmoniche", "36363009": "Finzi Pasca", "36363005": "Fonoteca" };
/** abbreviated chart labels spelled out in the note; English labels of the chart */
const ABBR = ["36363002", "36363004", "36363009", "36363005"];
const enShort = (acct: string) => SHORT[acct].replace("fisso", "fixed").replace("variabile", "variable").replace("Filarmoniche", "Brass bands").replace("Fonoteca", "Sound archives");
const CONTRIB: [string, string, string][] = [
  ["36121900", "LAC (contributo fisso)", "LAC (fixed contribution)"], ["36121901", "LAC (contributo variabile)", "LAC (variable contribution)"],
  ["36363001", "MASI", "MASI"], ["36363002", "Fondazione culture e musei (MUSEC)", "Culture and museums foundation (MUSEC)"],
  ["36363004", "Orchestra della Svizzera italiana", "Orchestra della Svizzera italiana"], ["36363006", "Filarmoniche", "Brass bands"],
  ["36363009", "Compagnia Finzi Pasca", "Compagnia Finzi Pasca"], ["36363005", "Fonoteca nazionale", "Swiss National Sound Archives"],
];
const FACILITIES: Record<string, string> = {
  "Piste di atletica": "Athletics tracks", "Campi da calcio": "Football pitches", "Palestre d'arrampicata": "Climbing gyms", "Skatepark": "Skateparks",
  "Campi per hockey su prato": "Field-hockey pitches", "Pista di ghiaccio per hockey e pattinaggio": "Ice rinks", "Palestre": "Gyms",
  "Palestre all'aperto": "Outdoor gyms", "Campi da Beach volley": "Beach-volleyball courts", "Centri per hockey su rotelle": "Roller-hockey centres",
  "Campi da gioco rionali": "Neighbourhood playgrounds", "Buche del Golf Club Lugano": "Holes at the Golf Club Lugano", "Percorsi vita": "Fitness trails",
  "Piste finlandesi": "Finnish running tracks", "Lidi e piscine": "Lidos and pools", "Campi da tennis (gestiti da Tennis Club)": "Tennis courts (run by tennis clubs)",
};

const N = String.raw`\d{1,3}(?:[’'] ?\d{3})*`, NS = String.raw`\d{1,3}(?:[’']\d{3})*`;
const int = (s: string) => Number(s.replace(/[\s’']/g, ""));
const dec = (s: string) => Number(s.replace(/[’'\s]/g, "").replace(",", "."));
/** Page texts of the given pages (all when omitted), as a sparse array by page number − 1. */
const pdfPages = async (file: string, wanted?: number[]) => (await readPdf(file, wanted)).pages;
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}
/** the same, on text with every space removed (press releases whose words are split across text items) */
const squeeze = (pages: string[]) => pages.map((s) => (s ?? "").replace(/\s+/g, ""));
/**
 * A two-year table printed as "name 2024 2025 change (pct)" rows ending in a total row ("∑" or "Σ").
 * Rows may show "‒" for a year without data. Fails if the rows do not add up to the printed total.
 */
function twoYearTable(pages: string[], names: string[], file: string) {
  const v = `(${N}|‒)`;
  const re = new RegExp(names.map((nm) => `${nm} ${v} ${v}(?: \\S+ \\([^)]*\\)| ‒ ‒)`).join(" ") + ` [∑Σ] (${N}) (${N})`);
  const { p, m } = findPage(pages, re, file);
  const val = (s: string) => (s === "‒" ? 0 : int(s));
  const rows = names.map((_, k) => ({ a: val(m[2 * k + 1]), b: val(m[2 * k + 2]) }));
  const ta = int(m[2 * names.length + 1]), tb = int(m[2 * names.length + 2]);
  if (rows.reduce((s, r) => s + r.a, 0) !== ta || rows.reduce((s, r) => s + r.b, 0) !== tb) fail(`${file} p. ${p}: rows do not add up to ${ta} / ${tb}`);
  return { p, rows, ta, tb };
}

export async function cultura(register: Municipality[], src: Src) {
  const pop24 = new Map(register.map((m) => [m.bfs, m.population]));
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;

  // ---- function 3 by line, every municipality
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
  const total3 = Object.values(ls).reduce((s, v) => s + v, 0) / 1000;
  const perRes = (codes: string[]) => compare([...spend].map(([bfs, v]) => ({ bfs, name: name(bfs),
    value: (codes.reduce((s, c) => s + v[c], 0) * 1000) / pop24.get(bfs)!, population: pop24.get(bfs)! })), "CHF / abitante", "highest-first");
  const cultCmp = perRes(CULTURE), sportCmp = perRes(["341"]);
  const lineData = (codes: string[], m: Record<string, number>) => LINES.filter(([c]) => codes.includes(c) && m[c] > 0)
    .map(([c, it, en]) => ({ key: `l${c}`, label: { it: `${c} ${it}`, en: `${c} ${en}` }, value: m[c] / 1000 })).sort((a, b) => b.value - a.value) as Datum[];

  // ---- the City's contributions (2027 budget message): budget 2027, budget 2026, actual 2025, checked by the printed differences
  const msg = await pdfPages(BUDGET27_MSG, [33, 34, 35]);
  const M = String.raw`\d{1,3}(?:[’']\d{3})*\.\d\d`, D = String.raw`-?\d{1,3}(?:[’']\d{3})*\.\d\d`;
  const money = (s: string) => Number(s.replace(/[’']/g, ""));
  const contrib = CONTRIB.map(([acct, it, en]) => {
    const { p, m } = findPage(msg, new RegExp(`${acct} [^0-9]+? (${M}) (${M}) (${D}) -?\\d+\\.\\d\\d ?% (${M}) (${D}) -?\\d+\\.\\d\\d ?%`), BUDGET27_MSG);
    const [b27, b26, d1, a25, d2] = [1, 2, 3, 4, 5].map((k) => money(m[k]));
    if (Math.abs(b27 - b26 - d1) > 0.01 || Math.abs(b27 - a25 - d2) > 0.01) fail(`${BUDGET27_MSG}: account ${acct} differences do not match`);
    return { acct, label: { it, en } as Text, p, a25: a25 / 1e6, b26: b26 / 1e6, b27: b27 / 1e6 };
  });
  const cut = findPage(msg, /36121900 Contributo: Ente autonomo LAC Lugano Arte Cultura \S+ \S+ \S+ \S+ Riduzione del contributo al LAC come misura di risanamento/, BUDGET27_MSG);
  const C = Object.fromEntries(contrib.map((c) => [c.acct, c]));
  const lacCity = { a25: C["36121900"].a25 + C["36121901"].a25, b26: C["36121900"].b26 + C["36121901"].b26, b27: C["36121900"].b27 + C["36121901"].b27 };
  const contribTotal = contrib.reduce((s, c) => s + c.a25, 0);

  // ---- LAC season 2024/25 (press release; words split across text items, so read without spaces)
  const lacP = squeeze(await pdfPages(F.lac));
  const att = findPage(lacP, new RegExp(`sièchiusacon(${NS})spettatoriperlastagioneartisticae(${NS})partecipantialleattivitàdimediazioneculturale,peruntotaledi(${NS})presenze`), F.lac);
  const [season, mediation, attendance] = att.m.slice(1, 4).map(int);
  const theatre = int(findPage(lacP, new RegExp(`teatroedanza.{0,120}?hatotalizzato(${NS})presenze`), F.lac).m[1]);
  const music = int(findPage(lacP, new RegExp(`programmazionemusicaleèstatasceltada(${NS})spettatori`), F.lac).m[1]);
  if (season + mediation !== attendance || theatre + music !== season) fail(`${F.lac}: attendance does not add up`);
  const ownP = findPage(lacP, new RegExp(`totalizzato(${NS})CHFdiricavipropri`), F.lac);
  const own = int(ownP.m[1]);
  const REV: [string, string, string][] = [["biglietteriaeprevendita", "Biglietteria e prevendita", "Ticketing"], ["sponsorizzazioniefundraising", "Sponsorizzazioni e fundraising", "Sponsorship and fundraising"],
    ["settoreeventiecongressi", "Eventi e congressi (affitto sale)", "Events and congresses (venue hire)"], ["coproduzioneetournée", "Coproduzioni e tournée", "Co-productions and touring"]];
  const revParts = REV.map(([k, it, en]) => ({ it, en, v: int(findPage(lacP, new RegExp(`${k}\\(CHF(${NS})\\)`), F.lac).m[1]) }));
  const rest = own - revParts.reduce((s, r) => s + r.v, 0);
  if (rest < 0) fail(`${F.lac}: revenue parts exceed own revenue`);
  findPage(lacP, /autofinanziamentosuperioreal50%/, F.lac);

  // ---- yearbook: museums, shows, events, congresses, fairs, sport
  const lic = await pdfPages(F.lic, [58, 59, 60, 62]);
  const MUSEUMS: [string, string][] = [["MASI – Sede LAC", "MASI – LAC"], ["MASI – Sede Palazzo Reali", "MASI – Palazzo Reali"], ["Collezione Olgiati", "Collezione Olgiati"], ["Museo Schmid", "Museo Schmid"], ["MUSEC", "MUSEC"]];
  const mus = twoYearTable(lic, MUSEUMS.map(([k]) => k), F.lic);
  const shows = twoYearTable(lic, ["L ?AC", "Teatro/Studio Foce"], F.lic);
  const ev = (label: string, count: string) => { const r = findPage(lic, new RegExp(`${label} ${count} (${N}) (${N}) .{0,25}?(?:Nr\\. di spettatori|Numero di partecipanti) (${N}) (${N})`), F.lic);
    return { p: r.p, n24: int(r.m[1]), n25: int(r.m[2]), s24: int(r.m[3]), s25: int(r.m[4]) }; };
  const pdc = ev("Palazzo dei congressi", "Nr\\. di eventi"), longlake = ev("LongLake Festival", "Nr\\. di eventi");
  const congr = ev("", "Numero di congressi"), fairs = ev("", "Numero di fiere");
  findPage(lic, /Le cifre relative agli spettatori del Longlake Festival sono delle stime/, F.lic);
  const SPORT: [string, string, string][] = [["Lido Lugano e piscina coperta", "Lido Lugano e piscina coperta", "Lido Lugano and indoor pool"], ["Lido San Domenico", "Lido San Domenico", "Lido San Domenico"],
    ["Lido Riva Caccia", "Lido Riva Caccia", "Lido Riva Caccia"], ["Piscina Carona", "Piscina Carona", "Carona pool"], ["Pista ghiaccio Resega", "Pista di ghiaccio Resega", "Resega ice rink"]];
  const sport = twoYearTable(lic, SPORT.map(([k]) => k), F.lic);
  const invP = findPage(lic, /Nr\. strutture (.+?) Strutture sportive della Città/, F.lic);
  const inventory = [...invP.m[1].matchAll(/(.+?) (\d+)(?= |$)/g)].map((x) => {
    const k = x[1].trim(); if (!FACILITIES[k]) fail(`${F.lic}: facility without a translation: ${k}`); return { it: k, en: FACILITIES[k], v: Number(x[2]) }; });

  // ---- MASI: the Canton's grant 2025–2028 and the board
  const masi = await pdfPages(F.masi);
  const masiGrant = findPage(masi, new RegExp(`È concesso un contributo annuale di (${N}) franchi`), F.masi);
  findPage(masi, /tre rappresentanti del Cantone, tre del Comune di Lugano/, F.masi);

  // ---- PSE: stadium and indoor arena purchase credits, leasing vs bond, lease, cost ceiling, capacity; Maglio credit
  const ar = await pdfPages(F.arena), arS = squeeze(ar);
  const arCredit = dec(findPage(ar, /credito di (\d+,\d) milioni di franchi per l’acquisto dell’Arena Sportiva/, F.arena).m[1]);
  const arCmp = findPage(arS, /leasingperl['’]ASammonterebbea(\d+,\d+)milionidifranchisu27anni,mentreilfinanziamentotramiteprestitoobbligazionariocomporterebbeuncostocomplessivodi(\d+,\d+)milioni/, F.arena);
  const [arLease, arBond] = [dec(arCmp.m[1]), dec(arCmp.m[2])];
  const pa = squeeze(await pdfPages(F.pala));
  const paCredit = dec(findPage(pa, /richiestadicreditodicirca(\d+,\d)milionifranchi/, F.pala).m[1]);
  const paCmp = findPage(pa, /canonidilocazione.{0,80}?sarebbedicirca(\d+)milionidifranchi.{0,120}?onerecomplessivonei27anniconsideratidicirca(\d+)milioni/, F.pala);
  const [paLease, paBond] = [Number(paCmp.m[1]), Number(paCmp.m[2])];
  const le = await pdfPages(F.lease);
  const rent = findPage(le, new RegExp(`La pigione annuale netta ammonta a (${N}) franchi, ridotti a (${N}) franchi`), F.lease);
  const rentStart = findPage(le, /L['’]inizio della pigione annua è stabilito al (1° gennaio \d{4})/, F.lease).m[1];
  const info = await pdfPages(F.info, [12, 13]);
  const ceiling = int(findPage(info, new RegExp(`Il tetto dei costi aggiornato ammonta a fr\\. (${N})\\.`), F.info).m[1]);
  const cap = int(findPage(info, new RegExp(`capacità di (${N}) spettatori`), F.info).m[1]);
  const mg = await pdfPages(F.maglio, [1, 13]);
  const chf = (s: string) => int(s.replace(/\.\d\d$/, "")) + Number(s.slice(-3));
  const mgU = findPage(mg, new RegExp(`Credito MMN\\. 10775 aggiornato \\(indice dei costi ottobre 2024\\) (${N}\\.\\d\\d)`), F.maglio);
  const mgP = findPage(mg, new RegExp(`Totale credito suppletorio (${N}\\.\\d\\d) Totale nuovo credito (${N}\\.\\d\\d)`), F.maglio);
  const [mgUpd, mgSup, mgNew] = [chf(mgU.m[1]), chf(mgP.m[1]), chf(mgP.m[2])];
  if (Math.abs(mgUpd + mgSup - mgNew) > 0.01) fail(`${F.maglio}: ${mgUpd} + ${mgSup} is not ${mgNew}`);
  const mgOrig = int(findPage(mg, new RegExp(`credito di costruzione di fr\\. (${N})\\.-- \\(IVA inclusa\\)`), F.maglio).m[1]);

  const usc = (file: string, loc: string) => src(file, loc);
  const yr = (y: number) => ({ it: String(y), en: String(y) });
  const anchorDetail = [
    { title: { it: "Cultura, sport e tempo libero nei conti della Città, 2024: spese per voce", en: "Culture, sport and leisure in the City's accounts, 2024: spending by line" } as Text,
      chart: { type: "hbars" as const, unit: "mio CHF", digits: 2, color: CC, caption: { it: "mio CHF · 2024 · spesa lorda", en: "CHF million · 2024 · gross spending" }, data: lineData(LINES.map(([c]) => c), ls) },
      source: [src(APPENDICE, "sheet TabD, columns 311–350, row 'Lugano' (CHF thousands)")] },
    { title: { it: "Spese e ricavi per voce, 2024", en: "Spending and revenue by line, 2024" } as Text,
      chart: { type: "columns" as const, unit: "mio CHF", digits: 2, color: CC, series: [
        { label: { it: "Spese", en: "Spending" }, data: lineData(LINES.map(([c]) => c), ls).filter((d) => d.value >= 1).map((d) => ({ ...d, key: `a${d.key}` })) },
        { label: { it: "Ricavi", en: "Revenue" }, data: lineData(LINES.map(([c]) => c), ls).filter((d) => d.value >= 1).map((d) => ({ ...d, key: `b${d.key}`, value: lr[d.key.slice(1)] / 1000 })) }] },
      note: { it: "Voci sopra 1 milione di spesa.", en: "Lines above CHF 1 million of spending." },
      source: [src(APPENDICE, "sheets TabD and TabE, columns 311–350, row 'Lugano' (CHF thousands)")] },
  ];
  const lacKeys = (k: "a25" | "b26" | "b27", acct: string) => C[acct][k];
  const contribSrc = usc(BUDGET27_MSG, `p. ${C["36121900"].p}–${Math.max(...contrib.map((c) => c.p))}: accounts ${CONTRIB.map(([a]) => a).join(", ")} (budget 2027, budget 2026, actual 2025)`);

  const stars: Star[] = [
    { id: "cultura.istituzioni", constellation: "cultura", label: { it: "Spesa culturale", en: "Culture spending" },
      about: { it: `Spesa della Città per musei, concerti e teatri e altre attività culturali (voci 311, 322 e 329), per abitante: la più alta del Ticino. Lugano finanzia istituzioni che servono tutta la regione, come il LAC e il MASI. Nel 2025 i contributi della Città alle principali istituzioni culturali sono stati ${n(contribTotal, 1)} milioni; il preventivo 2027 li riduce.`,
        en: `The City's spending on museums, concerts and theatres and other culture (lines 311, 322 and 329), per resident: the highest in Ticino. Lugano funds institutions that serve the whole region, such as LAC and MASI. In 2025 the City's contributions to the main cultural institutions were CHF ${n(contribTotal, 1)} million; the 2027 budget reduces them.` },
      value: cultCmp.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived",
      method: { it: "Somma delle voci 311, 322 e 329 (conto economico 2024) divisa per la popolazione al 31.12.2024.", en: "Sum of lines 311, 322 and 329 (2024 accounts) divided by the population at 31.12.2024." },
      source: [src(APPENDICE, "sheet TabD, columns 311, 322, 329, row of each municipality (CHF thousands)"), contribSrc],
      context: [{ label: { it: "Totale 311 + 322 + 329", en: "Total 311 + 322 + 329" }, value: CULTURE.reduce((s, c) => s + ls[c], 0) / 1000, unit: "mio CHF" },
        { label: { it: "Contributi alle istituzioni (2025)", en: "Contributions to institutions (2025)" }, value: contribTotal, unit: "mio CHF" }],
      comparison: cultCmp, related: ["cultura.spesa", "cultura.lac", "cultura.musei"],
      detail: [{ title: { it: "Contributi della Città alle istituzioni culturali", en: "The City's contributions to cultural institutions" },
        chart: { type: "columns", unit: "mio CHF", digits: 2, color: CC, series: [
          { label: { it: "Consuntivo 2025", en: "Actual 2025" }, data: contrib.map((c) => ({ key: `a${c.acct}`, label: { it: SHORT[c.acct], en: enShort(c.acct) }, value: c.a25, status: "actual" as const })) },
          { label: { it: "Preventivo 2027", en: "Budget 2027" }, data: contrib.map((c) => ({ key: `b${c.acct}`, label: { it: SHORT[c.acct], en: enShort(c.acct) }, value: c.b27, status: "budget" as const })) }] },
        note: { it: `${contrib.filter((c) => ABBR.includes(c.acct)).map((c) => `${SHORT[c.acct]}: ${c.label.it}`).join("; ")}. ` + "Il preventivo 2027 riduce il contributo fisso al LAC e del 5% quelli al MASI, alla Fondazione culture e musei, alle filarmoniche e alla Compagnia Finzi Pasca, come misure di contenimento del disavanzo.",
          en: `${contrib.filter((c) => ABBR.includes(c.acct)).map((c) => `${enShort(c.acct)}: ${c.label.en}`).join("; ")}. ` + "The 2027 budget reduces the fixed contribution to LAC, and those to MASI, the culture and museums foundation, the brass bands and Compagnia Finzi Pasca by 5%, as deficit-reduction measures." },
        source: [contribSrc, usc(BUDGET27_MSG, `p. ${cut.p}: 'Riduzione del contributo al LAC come misura di risanamento'`)] }] },
    { id: "cultura.lac", constellation: "cultura", label: { it: "LAC Lugano Arte e Cultura", en: "LAC Lugano Arte e Cultura" },
      about: { it: `Presenze al LAC nella stagione 2024/25: ${n(season)} spettatori (teatro e danza ${n(theatre)}, musica ${n(music)}) e ${n(mediation)} partecipanti alla mediazione culturale. Il LAC, ente autonomo della Città, ha incassato ${n(own / 1e6, 2)} milioni di ricavi propri e copre oltre metà dei costi; la Città ha versato ${n(lacCity.a25, 2)} milioni nel 2025, ${n(lacCity.b27, 2)} a preventivo 2027.`,
        en: `Attendance at LAC in the 2024/25 season: ${n(season)} spectators (theatre and dance ${n(theatre)}, music ${n(music)}) and ${n(mediation)} participants in cultural mediation. LAC, an autonomous body of the City, earned CHF ${n(own / 1e6, 2)} million of its own revenue and covers more than half its costs; the City paid CHF ${n(lacCity.a25, 2)} million in 2025, ${n(lacCity.b27, 2)} in the 2027 budget.` },
      value: attendance, unit: "presenze", year: 2025, area: "Lugano", kind: "official",
      source: [usc(F.lac, `p. ${att.p}: '… per un totale di ${n(attendance)} presenze'`), contribSrc],
      context: [{ label: { it: "Ricavi propri", en: "Own revenue" }, value: own / 1e6, unit: "mio CHF" }, { label: { it: "Contributo della Città (2025)", en: "City contribution (2025)" }, value: lacCity.a25, unit: "mio CHF" }],
      related: ["cultura.istituzioni", "cultura.spettacoli"],
      detail: [
        { title: { it: "Presenze, stagione 2024/25", en: "Attendance, 2024/25 season" },
          chart: { type: "hbars", unit: "presenze", color: CC, caption: { it: "presenze · stagione 2024/25", en: "attendance · 2024/25 season" },
            data: [{ key: "med", label: { it: "Mediazione culturale", en: "Cultural mediation" }, value: mediation }, { key: "th", label: { it: "Teatro e danza", en: "Theatre and dance" }, value: theatre },
              { key: "mu", label: { it: "Musica", en: "Music" }, value: music }] },
          source: [usc(F.lac, `p. ${att.p}`)] },
        { title: { it: "Contributo della Città al LAC", en: "City contribution to LAC" },
          chart: { type: "columns", unit: "mio CHF", digits: 2, color: CC, series: [
            { label: { it: "Fisso", en: "Fixed" }, data: ([["a25", "Consuntivo 2025", "Actual 2025", "actual"], ["b26", "Preventivo 2026", "Budget 2026", "budget"], ["b27", "Preventivo 2027", "Budget 2027", "budget"]] as const)
              .map(([k, it, en, st]) => ({ key: `f${k}`, label: { it, en }, value: lacKeys(k, "36121900"), status: st })) },
            { label: { it: "Variabile", en: "Variable" }, data: ([["a25", "Consuntivo 2025", "Actual 2025", "actual"], ["b26", "Preventivo 2026", "Budget 2026", "budget"], ["b27", "Preventivo 2027", "Budget 2027", "budget"]] as const)
              .map(([k, it, en, st]) => ({ key: `v${k}`, label: { it, en }, value: lacKeys(k, "36121901"), status: st })) }] },
          note: { it: "Il taglio del contributo fisso è una misura di risanamento delle finanze della Città.", en: "The cut in the fixed contribution is a measure to restore the City's finances." },
          source: [contribSrc] },
        { title: { it: "Ricavi propri del LAC, stagione 2024/25", en: "LAC's own revenue, 2024/25 season" },
          chart: { type: "hbars", unit: "mio CHF", digits: 2, color: CC, caption: { it: "mio CHF · stagione 2024/25", en: "CHF million · 2024/25 season" },
            data: [...revParts.map((r, k) => ({ key: `r${k}`, label: { it: r.it, en: r.en }, value: r.v / 1e6 })), { key: "rest", label: { it: "Altri ricavi (non dettagliati)", en: "Other revenue (not itemised)" }, value: rest / 1e6 }] },
          source: [usc(F.lac, `p. ${ownP.p}: own revenue and its main items`)] }] },
    { id: "cultura.musei", constellation: "cultura", label: { it: "Visitatori dei musei", en: "Museum visitors" },
      about: { it: `Visitatori dei principali musei di Lugano nel 2025: ${n(mus.tb)}, contro ${n(mus.ta)} nel 2024. Il MASI, fondazione di Cantone e Città, ne conta ${n(mus.rows[0].b + mus.rows[1].b)} nelle sue due sedi. La Città gli versa ${n(C["36363001"].a25, 2)} milioni (2025), il Cantone ${n(int(masiGrant.m[1]) / 1e6, 2)} milioni all'anno.`,
        en: `Visitors to Lugano's main museums in 2025: ${n(mus.tb)}, against ${n(mus.ta)} in 2024. MASI, a foundation of the Canton and the City, counts ${n(mus.rows[0].b + mus.rows[1].b)} at its two venues. The City pays it CHF ${n(C["36363001"].a25, 2)} million (2025), the Canton CHF ${n(int(masiGrant.m[1]) / 1e6, 2)} million a year.` },
      value: mus.tb, unit: "visitatori", year: 2025, area: "Lugano", kind: "official",
      source: [usc(F.lic, `PDF p. ${mus.p} (book p. 106–107), table 'Musei'`), usc(F.masi, `p. ${masiGrant.p}: 'È concesso un contributo annuale di ${masiGrant.m[1]} franchi'`), contribSrc],
      context: [{ label: { it: "Contributo della Città al MASI (2025)", en: "City contribution to MASI (2025)" }, value: C["36363001"].a25, unit: "mio CHF" },
        { label: { it: "Contributo del Cantone al MASI", en: "Canton contribution to MASI" }, value: int(masiGrant.m[1]) / 1e6, unit: "mio CHF" },
        { label: { it: "Fondazione culture e musei (2025)", en: "Culture and museums foundation (2025)" }, value: C["36363002"].a25, unit: "mio CHF" }],
      related: ["cultura.istituzioni"],
      detail: [{ title: { it: "Visitatori per museo", en: "Visitors by museum" },
        chart: { type: "columns", unit: "visitatori", color: CC, series: [
          { label: { it: "2024", en: "2024" }, data: MUSEUMS.map(([, lab], k) => ({ key: `a${k}`, label: { it: lab, en: lab }, value: mus.rows[k].a })) },
          { label: { it: "2025", en: "2025" }, data: MUSEUMS.map(([, lab], k) => ({ key: `b${k}`, label: { it: lab, en: lab }, value: mus.rows[k].b })) }] },
        note: { it: "L'annuario dà le cifre senza spiegarne le variazioni.", en: "The yearbook gives the figures without explaining the changes." },
        source: [usc(F.lic, `PDF p. ${mus.p}, table 'Musei'`)] }] },
    { id: "cultura.spettacoli", constellation: "cultura", label: { it: "Spettatori di teatro e musica", en: "Theatre and music audiences" },
      about: { it: `Spettatori al LAC e al Teatro/Studio Foce nel 2025: ${n(shows.tb)} (${n(shows.ta)} nel 2024). Il Palazzo dei congressi ha ospitato ${n(pdc.n25)} spettacoli con ${n(pdc.s25)} spettatori; il LongLake Festival ${n(longlake.n25)} eventi con circa ${n(longlake.s25)} spettatori (stima). Ci sono stati anche ${n(congr.n25)} congressi.`,
        en: `Spectators at LAC and Teatro/Studio Foce in 2025: ${n(shows.tb)} (${n(shows.ta)} in 2024). The Palazzo dei congressi hosted ${n(pdc.n25)} shows with ${n(pdc.s25)} spectators; the LongLake Festival ${n(longlake.n25)} events with about ${n(longlake.s25)} spectators (estimate). There were also ${n(congr.n25)} congresses.` },
      value: shows.tb, unit: "spettatori", year: 2025, area: "Lugano", kind: "official",
      source: [usc(F.lic, `PDF p. ${shows.p} (book p. 106–107), table 'Teatro e musica'`), usc(F.lic, `PDF p. ${pdc.p}: 'Eventi'`), usc(F.lic, `PDF p. ${congr.p}: 'Congressi' and 'Fiere'`)],
      context: [{ label: { it: "LongLake Festival (stima)", en: "LongLake Festival (estimate)" }, value: longlake.s25, unit: "spettatori" },
        { label: { it: "Partecipanti ai congressi", en: "Congress participants" }, value: congr.s25, unit: "persone" }, { label: { it: "Partecipanti alle fiere", en: "Fair participants" }, value: fairs.s25, unit: "persone" }],
      related: ["cultura.lac"],
      detail: [{ title: { it: "Spettatori per sala", en: "Spectators by venue" },
        chart: { type: "columns", unit: "spettatori", color: CC, series: [
          { label: { it: "2024", en: "2024" }, data: [{ key: "a0", label: { it: "LAC", en: "LAC" }, value: shows.rows[0].a }, { key: "a1", label: { it: "Teatro/Studio Foce", en: "Teatro/Studio Foce" }, value: shows.rows[1].a }] },
          { label: { it: "2025", en: "2025" }, data: [{ key: "b0", label: { it: "LAC", en: "LAC" }, value: shows.rows[0].b }, { key: "b1", label: { it: "Teatro/Studio Foce", en: "Teatro/Studio Foce" }, value: shows.rows[1].b }] }] },
        note: { it: `Anno civile secondo l'annuario; il LAC conta ${n(season)} spettatori per la stagione 2024/25 (settembre–agosto). Le cifre del LongLake Festival sono stime (eventi per capienza dei luoghi).`,
          en: `Calendar year as in the yearbook; LAC counts ${n(season)} spectators for the 2024/25 season (September–August). The LongLake Festival figures are estimates (events times venue capacity).` },
        source: [usc(F.lic, `PDF p. ${shows.p}, table 'Teatro e musica'`)] }] },
    { id: "cultura.sport", constellation: "cultura", label: { it: "Spesa per lo sport", en: "Sport spending" },
      about: { it: `Spesa della Città per lo sport (voce 341): ${n(ls["341"] / 1000, 1)} milioni nel 2024, con ${n(lr["341"] / 1000, 1)} milioni di ricavi; per abitante è la ${sportCmp.lugano.rank}ª del Ticino. Gli impianti sportivi della Città hanno avuto ${n(sport.tb)} entrate nel 2025 (${n(sport.ta)} nel 2024); il calo viene soprattutto dalla chiusura della piscina di Carona.`,
        en: `The City's spending on sport (line 341): CHF ${n(ls["341"] / 1000, 1)} million in 2024, with CHF ${n(lr["341"] / 1000, 1)} million of revenue; per resident it ranks ${sportCmp.lugano.rank} in Ticino. The City's sports facilities had ${n(sport.tb)} visits in 2025 (${n(sport.ta)} in 2024); the fall comes mainly from the closure of the Carona pool.` },
      value: sportCmp.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived",
      method: { it: "Voce 341 «Sport» (conto economico 2024) divisa per la popolazione al 31.12.2024.", en: "Line 341 'Sport' (2024 accounts) divided by the population at 31.12.2024." },
      source: [src(APPENDICE, "sheet TabD, column 341, row of each municipality (CHF thousands)"), usc(F.lic, `PDF p. ${sport.p} (book p. 112–113): 'Utenza' and 'Offerta'`)],
      context: [{ label: { it: "Entrate agli impianti (2025)", en: "Facility visits (2025)" }, value: sport.tb, unit: "persone" }, { label: { it: "Spesa 341", en: "Spending 341" }, value: ls["341"] / 1000, unit: "mio CHF" }],
      comparison: sportCmp, related: ["cultura.spesa", "cultura.pse"],
      detail: [
        { title: { it: "Entrate agli impianti sportivi della Città", en: "Visits to the City's sports facilities" },
          chart: { type: "columns", unit: "persone", color: CC, series: [
            { label: { it: "2024", en: "2024" }, data: SPORT.map(([, it, en], k) => ({ key: `a${k}`, label: { it, en }, value: sport.rows[k].a })).filter((_, k) => sport.rows[k].b > 0) },
            { label: { it: "2025", en: "2025" }, data: SPORT.map(([, it, en], k) => ({ key: `b${k}`, label: { it, en }, value: sport.rows[k].b })).filter((_, k) => sport.rows[k].b > 0) }] },
          note: { it: `Piscina di Carona: ${n(sport.rows[3].a)} entrate nel 2024, chiusa nel 2025 (nessun dato).`, en: `Carona pool: ${n(sport.rows[3].a)} visits in 2024, closed in 2025 (no figure).` },
          source: [usc(F.lic, `PDF p. ${sport.p}, table 'Utenza'`)] },
        { title: { it: "Impianti sportivi della Città", en: "The City's sports facilities" },
          chart: { type: "hbars", unit: "impianti", color: CC, caption: { it: "numero di strutture", en: "number of facilities" },
            data: inventory.map((x, k) => ({ key: `i${k}`, label: { it: x.it, en: x.en }, value: x.v })).sort((a, b) => b.value - a.value) },
          source: [usc(F.lic, `PDF p. ${invP.p}, table 'Offerta'`)] }] },
    { id: "cultura.pse", constellation: "cultura", label: { it: "Polo sportivo e degli eventi", en: "Sports and events hub" },
      about: { it: `La Città compra lo stadio (AIL Arena) e il palazzetto dello sport del Polo sportivo e degli eventi con prestiti obbligazionari invece del leasing: crediti di ${n(arCredit, 1)} e circa ${n(paCredit, 1)} milioni. Sull'arco di 27 anni il costo stimato scende da ${n(arLease, 1)} a ${n(arBond, 1)} milioni per lo stadio e da circa ${paLease} a circa ${paBond} milioni per il palazzetto. Dal ${rentStart} l'FC Lugano paga ${n(int(rent.m[1]))} franchi d'affitto all'anno.`,
        en: `The City is buying the stadium (AIL Arena) and the indoor arena of the sports and events hub with bonds rather than leasing: credits of CHF ${n(arCredit, 1)} and about ${n(paCredit, 1)} million. Over 27 years the estimated cost falls from CHF ${n(arLease, 1)} to ${n(arBond, 1)} million for the stadium and from about ${paLease} to about ${paBond} million for the indoor arena. From ${rentStart.replace("1° gennaio", "1 January")}, FC Lugano pays CHF ${n(int(rent.m[1]))} a year in rent.` },
      value: arCredit + paCredit, unit: "mio CHF", year: 2025, area: "Lugano", kind: "derived",
      method: { it: `Somma dei due crediti d'acquisto (stadio ${n(arCredit, 1)} milioni, approvato nel 2025; palazzetto circa ${n(paCredit, 1)} milioni, chiesto il 13 novembre 2025). Il confronto leasing / prestito è la stima della Città su 27 anni, con i tassi del momento.`,
        en: `Sum of the two purchase credits (stadium CHF ${n(arCredit, 1)} million, approved in 2025; indoor arena about ${n(paCredit, 1)} million, requested on 13 November 2025). The leasing / bond comparison is the City's estimate over 27 years, at the rates of the time.` },
      source: [usc(F.arena, `p. ${arCmp.p}: credit and 27-year comparison`), usc(F.pala, `p. ${paCmp.p}: credit and 27-year comparison`), usc(F.lease, `p. ${rent.p}: rent`), usc(F.info, "pp. 12–13: capacity and cost ceiling")],
      context: [{ label: { it: "Tetto dei costi (stadio e palazzetto)", en: "Cost ceiling (stadium and indoor arena)" }, value: ceiling / 1e6, unit: "mio CHF" },
        { label: { it: "Capienza dello stadio", en: "Stadium capacity" }, value: cap, unit: "persone" },
        { label: { it: `Affitto dell'FC Lugano, dal ${rentStart.slice(-4)}`, en: `FC Lugano rent, from ${rentStart.slice(-4)}` }, value: int(rent.m[1]) / 1e6, unit: "mio CHF" }],
      related: ["cultura.sport", "finanze.obbligazioni"],
      detail: [
        { title: { it: "Costo stimato su 27 anni: leasing o prestito obbligazionario", en: "Estimated cost over 27 years: leasing or bond" },
          chart: { type: "columns", unit: "mio CHF", digits: 1, color: CC, series: [
            { label: { it: "Leasing / locazione", en: "Leasing / rental" }, data: [{ key: "la", label: { it: "Stadio", en: "Stadium" }, value: arLease, status: "estimate" as const }, { key: "lp", label: { it: "Palazzetto", en: "Indoor arena" }, value: paLease, status: "estimate" as const }] },
            { label: { it: "Prestito obbligazionario", en: "Bond" }, data: [{ key: "ba", label: { it: "Stadio", en: "Stadium" }, value: arBond, status: "estimate" as const }, { key: "bp", label: { it: "Palazzetto", en: "Indoor arena" }, value: paBond, status: "estimate" as const }] }] },
          note: { it: "Stime della Città al momento della richiesta di credito (stadio: tassi del 4.12.2024; palazzetto: tasso stimato 1,2%). Le cifre del palazzetto sono arrotondate al milione nel comunicato.",
            en: "The City's estimates when the credit was requested (stadium: rates of 4.12.2024; indoor arena: estimated rate 1.2%). The indoor-arena figures are rounded to the million in the press release." },
          source: [usc(F.arena, `p. ${arCmp.p}`), usc(F.pala, `p. ${paCmp.p}`)] },
        { title: { it: "Crediti per gli impianti sportivi", en: "Credits for the sports facilities" },
          chart: { type: "hbars", unit: "mio CHF", digits: 1, color: CC, caption: { it: "mio CHF · crediti", en: "CHF million · credits" },
            data: [{ key: "ar", label: { it: "Stadio (acquisto, approvato 2025)", en: "Stadium (purchase, approved 2025)" }, value: arCredit },
              { key: "pa", label: { it: "Palazzetto (acquisto, chiesto 11.2025)", en: "Indoor arena (purchase, requested 11.2025)" }, value: paCredit },
              { key: "mg", label: { it: "Centro sportivo al Maglio (credito aggiornato, 3.2025)", en: "Maglio sports centre (updated credit, 3.2025)" }, value: mgNew / 1e6 }] },
          note: { it: `Il Centro sportivo al Maglio (Canobbio) accoglie le squadre che lasciano Cornaredo: credito iniziale ${n(mgOrig / 1e6, 2)} milioni, aggiornato a ${n(mgUpd / 1e6, 2)} con l'indice dei costi, più un credito suppletorio di ${n(mgSup / 1e6, 2)} milioni.`,
            en: `The Maglio sports centre (Canobbio) takes the teams leaving Cornaredo: initial credit CHF ${n(mgOrig / 1e6, 2)} million, indexed to ${n(mgUpd / 1e6, 2)}, plus a supplementary credit of CHF ${n(mgSup / 1e6, 2)} million.` },
          source: [usc(F.arena, "p. 1"), usc(F.pala, "p. 1"), usc(F.maglio, `p. ${mgP.p}: 'Ricapitolazione costi'`)] }] },
  ];
  return { stars, anchorDetail, total3 };
}

export const CULTURA_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.lac]: { url: "https://www.luganolac.ch/dam/jcr:997824ea-e678-4784-9887-c2b8b0974f20/LAC_Risultati%20stagione%202024-25_comunicato%20stampa.pdf", publisher: "LAC Lugano Arte e Cultura, comunicato: risultati della stagione 2024/25 (17 dicembre 2025)" },
  [F.masi]: { url: "https://m4.ti.ch/user_librerie/php/GC/allegato.php?allid=171683", publisher: "Cantone Ticino, Messaggio n. 8488 sulla convenzione con la Fondazione MASI 2025–2028 (25 settembre 2024)" },
  [F.arena]: { url: "https://www.lugano.ch/dam/jcr:08157107-aac6-46c8-982e-266ec47a0120/20250117-cs-acquisto-arena-sportiva-pse.pdf", publisher: "Città di Lugano, comunicato: credito per l'acquisto dell'Arena sportiva (17 gennaio 2025)" },
  [F.lease]: { url: "https://www.lugano.ch/dam/jcr:1ca2d4b7-a914-4d0c-99d6-7278c32a3f89/20250814-cs-contratto-locazione-arena-sportiva-pse.pdf", publisher: "Città di Lugano, comunicato: contratto di locazione dell'Arena sportiva (14 agosto 2025)" },
  [F.pala]: { url: "https://www.lugano.ch/dam/jcr:7db7b5f7-c9b7-41f0-8122-a64d8a23ea8a/20251113-cs-acquisto-palazzetto-sport-pse.pdf", publisher: "Città di Lugano, comunicato: acquisto del Palazzetto dello Sport (13 novembre 2025)" },
  [F.maglio]: { url: "https://www.lugano.ch/dam/jcr:73f6676d-6727-46fa-937c-089385325744/Messaggio%20Municipale_12253.pdf", publisher: "Città di Lugano, Messaggio municipale n. 12253, credito suppletorio per il Centro sportivo al Maglio (20 marzo 2025)" },
  [F.info]: { url: "https://www.lugano.ch/dam/jcr:4f929b4f-4f61-4bbd-821c-f62911887ee6", publisher: "Città di Lugano, Infopoint Polo sportivo e degli eventi (presentazione)" },
};
