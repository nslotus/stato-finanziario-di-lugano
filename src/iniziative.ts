// Economic initiatives, in the economy arm (INITIATIVES-SOURCES.md): the economic development office, Lugano Living Lab,
// the work and training services (LuganoNetWork), contributions to economic and tourist promotion, the City's direct and
// invited contracts, and Plan ₿. Amounts are what the City spends or awards, shown as amounts and not ranked: no
// comparable figures exist for the other municipalities.
// Every amount is read from the 2027 budget message twice where the document allows it (division table with ' and .,
// account detail with spaces and commas) and the two must agree; the contracts list is summed row by row.

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { Datum, Source, Star, Text } from "./catalog";
import { fail, rawPath } from "./adapters/common";
import { readPdf, type Item } from "./adapters/pdf";
import { BUDGET27_MSG } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const EC = "var(--economia)";
export const F = {
  commesse: "lugano-commesse-2025.xlsx", q1503: "risposta-interrogazione-1503.pdf",
  lnw25: "lnw-rapporto-2025.pdf", lnw24: "lnw-rapporto-2024.pdf", lnw23: "lnw-rapporto-2023.pdf", lnw22: "lnw-rapporto-2022.pdf",
  mou: "planb-mou-phase2-en.pdf", planbCs: "20260303-planb-fase2-comunicato.pdf",
};
/** 2025 report p. 7: the participants figure is drawn as graphics (not in the text layer), read from the page image */
const LNW25_PARTICIPANTS = 286;

const M = String.raw`\d{1,3}(?:[’']\d{3})*\.\d\d`, D = String.raw`-?\d{1,3}(?:[’']\d{3})*\.\d\d`; // division tables: 1'019'495.86
const A = String.raw`\d{1,3}(?: \d{3})*,\d\d`; // account detail: 1 019 495,86
const money = (s: string) => Number(s.replace(/[’'\s]/g, "").replace(",", "."));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function findPage(pages: string[], re: RegExp, file: string) {
  for (let i = 0; i < pages.length; i++) { const m = pages[i]?.match(re); if (m) return { p: i + 1, m }; }
  return fail(`${file}: phrase not found ${re}`);
}
const close = (a: number, b: number, what: string) => { if (Math.abs(a - b) > 0.011) fail(`${what}: ${a} vs ${b}`); };

export async function iniziative(src: Src) {
  const msg = (await readPdf(BUDGET27_MSG)).pages;
  const at = (re: RegExp) => findPage(msg, re, BUDGET27_MSG);

  // ---- economic development office: 2025 actual (centre 1500), 2027 budget (centre 1240)
  const ofTab = at(new RegExp(`3 (${M}) -(${M}) -100\\.00% 30 (${M}) -${M} -100\\.00% 31 (${M}) -${M} -100\\.00% 15 Gruppo`));
  const [of25, of30, of31] = [1, 3, 4].map((k) => money(ofTab.m[k]));
  close(of30 + of31, of25, "economic office 2025: staff + goods");
  const ofDet = at(new RegExp(`31309000 Altre prestazioni o servizi di terzi (${A}) .*?31991000 Progetti speciali e nuove iniziative (${A}) 1500 Sviluppo economico (${A})`));
  const [of3rd, ofSpec, of25b] = [1, 2, 3].map((k) => money(ofDet.m[k]));
  close(of25b, of25, "economic office 2025: detail vs division table");
  const of27 = at(new RegExp(`31991000 Progetti speciali e nuove iniziative (${A}) (${A}) 1240 Sviluppo economico (${A}) (${A})`));
  const [ofSpec27, ofSpec26, ofTot27, ofTot26] = [1, 2, 3, 4].map((k) => money(of27.m[k]));
  const of27t = at(new RegExp(`3 (${M}) (${M}) -?${D} -?\\d+\\.\\d\\d% ${M} 30 ${M} ${M} -?${D} -?\\d+\\.\\d\\d% ${M} 31 ${M} ${M} -?${D} -?\\d+\\.\\d\\d% ${M} 1240 Gruppo`));
  close(money(of27t.m[1]), ofTot27, "economic office 2027: detail vs division table");
  close(money(of27t.m[2]), ofTot26, "economic office 2026: detail vs division table");

  // ---- Lugano Living Lab (1230)
  const llTab = at(new RegExp(`3 (${M}) (${M}) ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 30 (${M}) ${M} ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 31 ${M} ${M} ${D} -?\\d+\\.\\d\\d% (${M})(?:(?!Gruppo).)*?1230 Gruppo`));
  const [ll27, ll26, ll25, , ll30, ll31] = [1, 2, 3, 4, 5, 6].map((k) => money(llTab.m[k]));
  close(ll30 + ll31, ll25, "Living Lab 2025: staff + goods");
  const llDet = at(new RegExp(`31991100 Progetto Lugano Living Lab (${A}) (${A}) (${A}) 42600000 Rimborsi per stipendi dipendenti (${A}) 46340000 Contributi da imprese pubbliche (${A}) (${A}) (${A}) 46350000 Contributi da imprese private (${A}) 1230 Lugano Living Lab (${A}) (${A}) (${A}) (${A}) (${A}) (${A})`));
  const v = (k: number) => money(llDet.m[k]);
  const llProj = v(3), llRefund = v(4), llPub = v(7), llPriv = v(8), llRev25 = v(14);
  close(v(13), ll25, "Living Lab 2025: detail vs division table");
  close(v(9), ll27, "Living Lab 2027: detail vs division table");
  close(llRefund + llPub + llPriv, llRev25, "Living Lab 2025 revenue lines");

  // ---- work and training sits in 'Prossimità e lavoro' (5121), with youth outreach
  const wkTab = at(new RegExp(`3 (${M}) (${M}) ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 30 ${M} ${M} ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 31 ${M} ${M} ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 36 ${M} ${M} ${D} -?\\d+\\.\\d\\d% (${M}) ${D} -?\\d+\\.\\d\\d% 4 ${M} ${M} ${D} -?\\d+\\.\\d\\d% (${M})(?:(?!Gruppo).)*?5121 Gruppo`));
  const [wk27, , wk25, wk30, wk31, wk36, wkRev25] = [1, 2, 3, 4, 5, 6, 7].map((k) => money(wkTab.m[k]));
  close(wk30 + wk31 + wk36, wk25, "Prossimità e lavoro 2025: 30 + 31 + 36");
  const wkDet = at(new RegExp(`5121 Prossimità e lavoro (${A}) (${A}) (${A}) (${A}) (${A}) (${A})`));
  close(money(wkDet.m[5]), wk25, "Prossimità e lavoro 2025: detail vs division table");
  close(money(wkDet.m[6]), wkRev25, "Prossimità e lavoro 2025 revenue: detail vs division table");

  // ---- contributions to economic and tourist promotion (account 363 table, p. 34) and the LuganoCard cashback
  const acct = (code: string, label: string) => {
    const { p, m } = at(new RegExp(`${code} ${esc(label)} (${M}) (${M}) (${D}) -?\\d+\\.\\d\\d ?% (${M}) (${D}) -?\\d+\\.\\d\\d ?%`));
    const [b27, b26, d1, a25, d2] = [1, 2, 3, 4, 5].map((k) => money(m[k]));
    if (Math.abs(b27 - b26 - d1) > 0.01 || Math.abs(b27 - a25 - d2) > 0.01) fail(`${BUDGET27_MSG}: account ${code} differences do not match`);
    return { p, code, b27, a25 };
  };
  const PROMO: [string, string, Text][] = [
    ["36321200", "Contributo legale a Org.Turistica Reg. di Lugano", { it: "Organizzazione turistica regionale (contributo di legge)", en: "Regional tourism organisation (required by law)" }],
    ["36363202", "Palazzo dei Congressi e P.Conza: affitti condonati", { it: "Affitti condonati: Palazzo dei Congressi e Padiglione Conza", en: "Waived rents: Palazzo dei Congressi and Padiglione Conza" }],
    ["36363201", "Sostegno ad eventi congressuali e espositivi", { it: "Sostegno a congressi e fiere", en: "Support for congresses and fairs" }],
    ["36368000", "Ente regionale per lo sviluppo del Luganese - ERSL", { it: "Ente regionale per lo sviluppo del Luganese (ERSL)", en: "Regional development agency (ERSL)" }],
    ["36369000", "Contributi volontari a enti e organiz. turistiche", { it: "Contributi volontari al turismo", en: "Voluntary tourism contributions" }],
    ["36368001", "Enti di promozione economica", { it: "Enti di promozione economica", en: "Economic-promotion bodies" }],
  ];
  const promo = PROMO.map(([code, label, short]) => ({ ...acct(code, label), short }));
  // the promotion-bodies line is spread over two centres in the detail (pp. 234, 245); their sum must equal the table
  const pe = [...msg.join(" ").matchAll(new RegExp(`36368001 Enti di promozione economica (${A}) (${A}) (${A})`, "g"))].map((m) => money(m[3]));
  close(pe.reduce((t, x) => t + x, 0), promo.find((x) => x.code === "36368001")!.a25, "economic-promotion bodies: centres vs table");
  const cb = at(new RegExp(`31990100 LVGApoint: cashback ai detentori LuganoCard (${A}) (${A}) (${A})`));
  promo.push({ p: cb.p, code: "31990100", b27: money(cb.m[1]), a25: money(cb.m[3]), short: { it: "Cashback LVGApoint ai titolari LuganoCard", en: "LVGApoint cashback to LuganoCard holders" } });
  promo.sort((a, b) => b.a25 - a.a25);
  const promo25 = promo.reduce((t, x) => t + x.a25, 0), promo27 = promo.reduce((t, x) => t + x.b27, 0);

  // ---- the contracts list 2025 (direct and invited awards above CHF 5'000)
  const sheetRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(XLSX.read(readFileSync(rawPath(F.commesse))).Sheets["Commesse pubbliche 2025"] ?? fail(`${F.commesse}: sheet missing`), { header: 1, defval: null });
  const head = sheetRows[1].map((h) => String(h ?? "").replace(/\s+/g, " ").trim());
  const col = (re: RegExp) => { const i = head.findIndex((h) => re.test(h)); return i >= 0 ? i : fail(`${F.commesse}: column ${re}`); };
  const [cCrb, cType, cWhat, cWho, cCur, cChf] = [/^CRB/, /^Tipo commessa/, /^Tipo Prestazione/, /^Deliberatario/, /^Val/, /^Importo CHF/].map(col);
  const rows = sheetRows.slice(2).filter((r) => r[cCrb] && typeof r[cChf] === "number").map((r) => ({
    crb: String(r[cCrb]), type: String(r[cType]), what: String(r[cWhat] ?? "").replace(/\s+/g, " "), who: String(r[cWho] ?? "").replace(/\s+/g, " ").trim(), cur: String(r[cCur]), v: r[cChf] as number }));
  const chf = rows.filter((r) => r.cur === "CHF"), other = rows.filter((r) => r.cur !== "CHF");
  const sum = (l: { v: number }[]) => l.reduce((t, r) => t + r.v, 0);
  const total = sum(chf);
  // a Swiss postcode is four digits standing alone before the town ("6900 Lugano", "CH-8005 Zürich"); "22100 Como" is not one
const plz = (who: string) => { const m = who.match(/(?:^|\s)(?:CH-)?(\d{4}) [^\d]+$/); return m ? Number(m[1]) : null; };
  const AREAS: [string, Text, (p: number | null) => boolean][] = [
    ["a69", { it: "Fornitori con NPA 69xx (Luganese)", en: "Suppliers with a 69xx postcode (Lugano area)" }, (p) => p !== null && p >= 6900 && p <= 6999],
    ["ati", { it: "Resto del Ticino", en: "Rest of Ticino" }, (p) => p !== null && p >= 6500 && p < 6900],
    ["ach", { it: "Resto della Svizzera", en: "Rest of Switzerland" }, (p) => p !== null && p >= 1000 && (p < 6500 || p >= 7000)],
    ["axx", { it: "Estero o senza NPA", en: "Abroad or no postcode" }, (p) => p === null || p < 1000],
  ];
  const byArea = AREAS.map(([key, label, f]) => ({ key, label, value: sum(chf.filter((r) => f(plz(r.who)))) / 1e6 }));
  close(byArea.reduce((t, a) => t + a.value, 0), total / 1e6, "contracts: areas add up");
  const types = [...new Set(chf.map((r) => r.type))].map((t) => ({ t, v: sum(chf.filter((r) => r.type === t)) / 1e6 })).sort((a, b) => b.v - a.v);
  const TYPE_EN: Record<string, string> = { "Prestazioni di servizi": "Services", "Fornitura": "Supplies", "Edile di altro genere e artigianale": "Other building and crafts", "Edile di impresario e pavimentazione stradale": "Construction and road paving" };
  const centre = (code: string) => chf.filter((r) => r.crb.startsWith(code));
  const ofC = centre("215000"), llC = centre("212300"), wkC = centre("251210");
  const myLugano = chf.filter((r) => /my ?lugano/i.test(r.what)), planB = rows.filter((r) => /plan ?(b|₿)\b|tether/i.test(r.what) || /plan ?(b|₿)\b/i.test(r.crb));
  const q = (await readPdf(F.q1503)).pages;
  const q24 = findPage(q, /Prestazioni di servizi (\d{1,3}(?:’\d{3})+) Totale (\d{1,3}(?:’\d{3})+)/, F.q1503);
  const total24 = money(q24.m[2]);

  // ---- LuganoNetWork reports: placements and courses
  const pages = async (f: string) => (await readPdf(f)).pages;
  const [r25, r24, r23, r22] = await Promise.all([F.lnw25, F.lnw24, F.lnw23, F.lnw22].map(pages));
  const hires25 = findPage(r25, /(\d+) assunzioni di utenti presentati da LuganoNetWork/, F.lnw25);
  const sessions = findPage(r25, /(\d+) incontri di accompagnamento individuale/, F.lnw25);
  const hires24 = findPage(r24, /(\d+) assunzioni di utenti presentati da LuganoNetWork alle aziende ed enti partner in: • (\d+) Posti di lavoro • (\d+) Stage curriculari/, F.lnw24);
  if (+hires24.m[2] + +hires24.m[3] !== +hires24.m[1]) fail(`${F.lnw24}: hires do not add up`);
  const plc = (pg: string[], f: string) => { const r = findPage(pg, /(\d+) collocamenti di candidati (\d+) apprendistati (\d+) stage curriculari (\d+) posizioni di lavoro/, f); return { p: r.p, n: +r.m[1], ap: +r.m[2], st: +r.m[3], jobs: +r.m[4] }; };
  const p23 = plc(r23, F.lnw23), p22 = plc(r22, F.lnw22);
  if (p23.ap + p23.st + p23.jobs !== p23.n) fail(`${F.lnw23}: placements do not add up`);
  const gap22 = p22.n - (p22.ap + p22.st + p22.jobs); // the 2022 report prints 67 placements, its parts add up to 66
  // courses and hours: page 7 is an infographic; figures are located by their labels' positions
  const { items } = await readPdf(F.lnw25, [7]);
  const it7: Item[] = items[6] ?? fail(`${F.lnw25}: page 7 missing`);
  // the headline label "corsi di formazione offerti" is graphics (checked on the page image, 19 Oct 2026); its figure
  // is the only plain number in the top block of the page, next to the satisfaction score
  const numbers = it7.filter((i) => /^\d+$/.test(i.s));
  const top = numbers.filter((i) => i.y > 600);
  if (top.length !== 1 || !it7.some((i) => /5\.65\/6/.test(i.s) && Math.abs(i.y - top[0].y) < 10)) fail(`${F.lnw25} p. 7: course headline not where expected`);
  const courses = top[0];
  const oreLabel = it7.find((i) => /^ore di/.test(i.s)) ?? fail(`${F.lnw25} p. 7: 'ore di' not found`);
  const hours = numbers.filter((i) => Math.abs(i.x - oreLabel.x) < 80 && i.y > oreLabel.y && i.y - oreLabel.y < 60)[0] ?? fail(`${F.lnw25} p. 7: hours figure not found`);
  if (it7.some((i) => i.s === String(LNW25_PARTICIPANTS))) fail(`${F.lnw25} p. 7: ${LNW25_PARTICIPANTS} is now in the text layer; read it from there`);
  if (!it7.some((i) => /^partecipanti$/.test(i.s))) fail(`${F.lnw25} p. 7: participants label not found`);
  const funding = findPage(r25, /emendamento del 2020 “Progetto lavoro”/, F.lnw25);

  // ---- Plan ₿ Phase II
  const mou = await pages(F.mou), cs = await pages(F.planbCs);
  const contrib = findPage(mou, /overall indicative equivalent value contribution of CHF ([\d,]+) over the duration/, F.mou);
  const noObl = findPage(mou, /does not entail financial obligations for the City/, F.mou);
  const signed = findPage(mou, /Lugano, (\d{1,2} \w+ \d{4})/, F.mou);
  const csObl = findPage(cs, /non comporta obblighi automatici di investimento o di spesa per la Città/, F.planbCs);
  const tether = Number(contrib.m[1].replace(/,/g, "")) / 1e6;

  const B = (loc: string) => src(BUDGET27_MSG, loc);
  const mio = (x: number) => x / 1e6;
  const notRanked = { it: "Non è confrontato con gli altri comuni: non esistono cifre comparabili.", en: "Not compared with other municipalities: no comparable figures exist." };
  const stars: Star[] = [
    { id: "economia.sviluppo", constellation: "economia", label: { it: "Ufficio sviluppo economico", en: "Economic development office" },
      about: { it: `Quanto è costato nel 2025 l'ufficio che coordina la promozione economica della Città (attrattività, innovazione digitale, piccole e medie imprese, MyLugano): ${n(mio(of25), 2)} milioni, di cui ${n(mio(of30), 2)} per il personale e ${n(mio(ofSpec) * 1000, 0)} mila per «progetti speciali e nuove iniziative». Il preventivo 2027 prevede ${n(mio(ofTot27), 2)} milioni.`,
        en: `What the office that coordinates the City's economic promotion (attractiveness, digital innovation, small businesses, MyLugano) cost in 2025: CHF ${n(mio(of25), 2)} million, of which ${n(mio(of30), 2)} for staff and ${n(mio(ofSpec) * 1000, 0)} thousand for "special projects and new initiatives". The 2027 budget plans CHF ${n(mio(ofTot27), 2)} million.` },
      value: mio(of25), unit: "mio CHF", digits: 2, year: 2025, area: "Lugano", kind: "official",
      method: { it: `Consuntivo 2025 del centro di costo 1500 «Sviluppo economico», dal messaggio sul preventivo 2027; dal 2027 l'ufficio è nel centro 1240. La voce «progetti speciali e nuove iniziative» non è dettagliata. ${notRanked.it}`,
        en: `2025 actual of cost centre 1500 'Sviluppo economico', from the 2027 budget message; from 2027 the office is in centre 1240. The 'special projects and new initiatives' line is not broken down. ${notRanked.en}` },
      source: [B(`p. ${ofTab.p}: division table 'Sviluppo economico', column Consuntivo 2025 (groups 30 and 31)`), B(`p. ${ofDet.p}: account detail, centre 1500 (lines 31309000, 31991000)`), B(`p. ${of27.p}: account detail, centre 1240 (P2027, P2026)`), src(F.commesse, "rows with cost centre 215000 and descriptions containing 'MyLugano'")],
      context: [{ label: { it: "Progetti speciali e nuove iniziative, preventivo 2027", en: "Special projects and new initiatives, 2027 budget" }, value: mio(ofSpec27), unit: "mio CHF", digits: 2 },
        { label: { it: "Commesse dirette 2025 per MyLugano (tutti i servizi)", en: "2025 direct contracts for MyLugano (all services)" }, value: mio(sum(myLugano)), unit: "mio CHF", digits: 2 },
        { label: { it: "Preventivo 2027", en: "2027 budget" }, value: mio(ofTot27), unit: "mio CHF", digits: 2 }],
      related: ["economia.living-lab", "economia.plan-b", "economia.promozione"],
      detail: [{ title: { it: "Ufficio sviluppo economico, consuntivo 2025", en: "Economic development office, 2025 actual" },
        chart: { type: "hbars", unit: "mio CHF", digits: 2, color: EC, data: [
          { key: "s30", label: { it: "Personale", en: "Staff" }, value: mio(of30) },
          { key: "s3rd", label: { it: "Prestazioni di terzi", en: "Third-party services" }, value: mio(of3rd) },
          { key: "sspec", label: { it: "Progetti speciali e nuove iniziative", en: "Special projects and new initiatives" }, value: mio(ofSpec) },
          { key: "soth", label: { it: "Altre spese d'esercizio", en: "Other running costs" }, value: mio(of31 - of3rd - ofSpec) }] },
        source: [B(`p. ${ofDet.p}: account detail, centre 1500`)] }] },
    { id: "economia.living-lab", constellation: "economia", label: { it: "Lugano Living Lab", en: "Lugano Living Lab" },
      about: { it: `Il laboratorio di innovazione digitale della Città (MyLugano, SwissLedger, intelligenza artificiale, progetti con università) è costato ${n(mio(ll25), 2)} milioni nel 2025, di cui ${n(mio(llProj), 2)} per i progetti. Ha incassato ${n(mio(llRev25) * 1000, 0)} mila franchi, di cui ${n(mio(llPriv) * 1000, 0)} mila da imprese private.`,
        en: `The City's digital innovation lab (MyLugano, SwissLedger, artificial intelligence, projects with universities) cost CHF ${n(mio(ll25), 2)} million in 2025, of which ${n(mio(llProj), 2)} for projects. It took in CHF ${n(mio(llRev25) * 1000, 0)} thousand, of which ${n(mio(llPriv) * 1000, 0)} thousand from private companies.` },
      value: mio(ll25), unit: "mio CHF", digits: 2, year: 2025, area: "Lugano", kind: "official",
      method: { it: `Consuntivo 2025 del centro di costo 1230 «Lugano Living Lab», dal messaggio sul preventivo 2027 (tabella della divisione e dettaglio dei conti, che coincidono). ${notRanked.it}`,
        en: `2025 actual of cost centre 1230 'Lugano Living Lab', from the 2027 budget message (division table and account detail, which agree). ${notRanked.en}` },
      source: [B(`p. ${llTab.p}: division table 'Lugano Living Lab', column Consuntivo 2025`), B(`p. ${llDet.p}: account detail, centre 1230 (lines 31991100, 46340000, 46350000)`), src(F.commesse, "rows with cost centre 212300")],
      context: [{ label: { it: "Contributi da imprese private", en: "Contributions from private companies" }, value: mio(llPriv), unit: "mio CHF", digits: 2 },
        { label: { it: `Commesse dirette 2025 (${llC.length})`, en: `2025 direct contracts (${llC.length})` }, value: mio(sum(llC)), unit: "mio CHF", digits: 2 },
        { label: { it: "Preventivo 2027", en: "2027 budget" }, value: mio(ll27), unit: "mio CHF", digits: 2 }],
      related: ["economia.sviluppo", "economia.plan-b"] },
    { id: "economia.lavoro", constellation: "economia", label: { it: "Lavoro e formazione per adulti", en: "Work and adult training" },
      about: { it: `Con LuganoNetWork, Spazio lavoro e formazione, Punto digitale ed eQuiD la Città aiuta i residenti a trovare lavoro e a rafforzare le competenze di base. Nel 2025: ${hires25.m[1]} assunzioni di persone presentate alle aziende, ${sessions.m[1]} incontri individuali, ${courses.s} corsi gratuiti per adulti con ${LNW25_PARTICIPANTS} partecipanti.`,
        en: `Through LuganoNetWork, Spazio lavoro e formazione, Punto digitale and eQuiD the City helps residents find work and strengthen basic skills. In 2025: ${hires25.m[1]} hires of people put forward to companies, ${sessions.m[1]} one-to-one sessions, ${courses.s} free adult courses with ${LNW25_PARTICIPANTS} participants.` },
      value: +hires25.m[1], unit: "assunzioni", year: 2025, area: "Lugano", kind: "official",
      method: { it: `Rapporti d'attività di LuganoNetWork 2022–2025. Il costo dei servizi non è pubblicato a parte: sono nel centro di costo 5121 «Prossimità e lavoro» (${n(mio(wk25), 2)} milioni nel 2025), che comprende anche gli operatori di prossimità per i giovani. Sono finanziati dalla Città (emendamento «Progetto lavoro» del 2020) e in parte da contributi cantonali e federali per le competenze di base. Il numero di partecipanti ai corsi è stampato come grafica nel rapporto e letto dall'immagine della pagina. ${notRanked.it}`,
        en: `LuganoNetWork activity reports 2022–2025. The cost of the services is not published separately: they are in cost centre 5121 'Prossimità e lavoro' (CHF ${n(mio(wk25), 2)} million in 2025), which also covers youth outreach workers. They are funded by the City (the council's 2020 'Progetto lavoro' amendment) and partly by cantonal and federal grants for basic skills. The number of course participants is printed as graphics in the report and read from the page image. ${notRanked.en}` },
      source: [src(F.lnw25, `p. ${hires25.p}: '${hires25.m[1]} assunzioni'; p. ${sessions.p}: '${sessions.m[1]} incontri di accompagnamento individuale'; p. 7: ${courses.s} corsi, ${LNW25_PARTICIPANTS} partecipanti, ${hours.s} ore; p. ${funding.p}: financing`),
        src(F.lnw24, `p. ${hires24.p}: '${hires24.m[1]} assunzioni'`), src(F.lnw23, `p. ${p23.p}: '${p23.n} collocamenti'`), src(F.lnw22, `p. ${p22.p}: '${p22.n} collocamenti'`),
        B(`p. ${wkTab.p}: division table 'Prossimità e lavoro', column Consuntivo 2025`)],
      context: [{ label: { it: "Corsi gratuiti per adulti", en: "Free adult courses" }, value: +courses.s, unit: "corsi" },
        { label: { it: "Partecipanti ai corsi", en: "Course participants" }, value: LNW25_PARTICIPANTS, unit: "partecipanti" },
        { label: { it: "Ore di formazione", en: "Training hours" }, value: +hours.s, unit: "ore" },
        { label: { it: "Costo del centro 5121 (con la prossimità giovanile)", en: "Cost of centre 5121 (with youth outreach)" }, value: mio(wk25), unit: "mio CHF", digits: 2 }],
      related: ["sociale.casi", "economia.disoccupazione"],
      detail: [{ title: { it: "Persone collocate tramite LuganoNetWork, per anno", en: "People placed through LuganoNetWork, by year" },
        chart: { type: "columns", unit: "persone", digits: 0, color: EC, series: [{ label: { it: "Collocate", en: "Placed" }, data: [
          { key: "a2022", label: { it: "2022", en: "2022" }, value: p22.n, note: { it: `collocamenti: ${p22.jobs} lavori, ${p22.st} stage, ${p22.ap} apprendistati`, en: `placements: ${p22.jobs} jobs, ${p22.st} internships, ${p22.ap} apprenticeships` } },
          { key: "a2023", label: { it: "2023", en: "2023" }, value: p23.n, note: { it: `collocamenti: ${p23.jobs} lavori, ${p23.st} stage, ${p23.ap} apprendistati`, en: `placements: ${p23.jobs} jobs, ${p23.st} internships, ${p23.ap} apprenticeships` } },
          { key: "a2024", label: { it: "2024", en: "2024" }, value: +hires24.m[1], note: { it: `assunzioni: ${hires24.m[2]} lavori, ${hires24.m[3]} stage`, en: `hires: ${hires24.m[2]} jobs, ${hires24.m[3]} internships` } },
          { key: "a2025", label: { it: "2025", en: "2025" }, value: +hires25.m[1], note: { it: "assunzioni", en: "hires" } }] as Datum[] }] },
        note: { it: `I rapporti contano «collocamenti» nel 2022 e 2023 (lavori, stage e apprendistati) e «assunzioni» dal 2024: le definizioni cambiano, quindi le colonne non sono una serie omogenea.${gap22 ? ` Il rapporto 2022 indica ${p22.n} collocamenti, ma le sue voci sommano ${p22.n - gap22}.` : ""}`,
          en: `The reports count 'placements' in 2022 and 2023 (jobs, internships and apprenticeships) and 'hires' from 2024: the definitions change, so the columns are not one consistent series.${gap22 ? ` The 2022 report gives ${p22.n} placements, but its parts add up to ${p22.n - gap22}.` : ""}` },
        source: [src(F.lnw22, `p. ${p22.p}`), src(F.lnw23, `p. ${p23.p}`), src(F.lnw24, `p. ${hires24.p}`), src(F.lnw25, `p. ${hires25.p}`)] }] },
    { id: "economia.promozione", constellation: "economia", label: { it: "Contributi a promozione economica e turismo", en: "Contributions to economic and tourist promotion" },
      about: { it: `Quanto la Città ha versato o condonato nel 2025 per promuovere economia, turismo e congressi: ${n(mio(promo25), 2)} milioni, dall'ente regionale di sviluppo agli affitti condonati del Palazzo dei Congressi.`,
        en: `What the City paid or waived in 2025 to promote the economy, tourism and congresses: CHF ${n(mio(promo25), 2)} million, from the regional development agency to waived rents at the Palazzo dei Congressi.` },
      value: mio(promo25), unit: "mio CHF", digits: 2, year: 2025, area: "Lugano", kind: "derived",
      method: { it: `Somma delle ${promo.length} voci di contributo del consuntivo 2025 elencate nel grafico, dal messaggio sul preventivo 2027 (tabella dei contributi a enti e terzi, p. ${promo[0].p}, e dettaglio dei conti). Non comprende il contributo al LAC né quelli alla cultura e allo sport. ${notRanked.it}`,
        en: `Sum of the ${promo.length} 2025 contribution lines in the chart, from the 2027 budget message (table of contributions to bodies and third parties, p. ${promo[0].p}, and the account detail). It excludes the contribution to LAC and those to culture and sport. ${notRanked.en}` },
      source: [B(`p. ${promo[0].p}: account 363 table, lines ${promo.filter((x) => x.code !== "31990100").map((x) => x.code).join(", ")}, column Consuntivo 2025`), B(`p. ${cb.p}: account detail, line 31990100`)],
      context: [{ label: { it: "Preventivo 2027 delle stesse voci", en: "2027 budget for the same lines" }, value: mio(promo27), unit: "mio CHF", digits: 2 }],
      related: ["economia.sviluppo", "economia.pernottamenti"],
      detail: [{ title: { it: "Contributi a promozione economica e turismo, consuntivo 2025", en: "Contributions to economic and tourist promotion, 2025 actual" },
        chart: { type: "hbars", unit: "mio CHF", digits: 2, color: EC, data: promo.map((x) => ({ key: `c${x.code}`, label: x.short, value: mio(x.a25) })) },
        source: [B(`p. ${promo[0].p} and p. ${cb.p}`)] }] },
    { id: "economia.commesse", constellation: "economia", label: { it: "Commesse dirette e su invito", en: "Direct and invited contracts" },
      about: { it: `Nel 2025 la Città ha aggiudicato senza concorso pubblico (incarico diretto o su invito) ${n(rows.length)} commesse sopra i 5'000 franchi, per ${n(total / 1e6, 1)} milioni in franchi. ${n(byArea[0].value, 1)} milioni sono andati a fornitori con indirizzo nel Luganese (NPA 69xx).`,
        en: `In 2025 the City awarded ${n(rows.length)} contracts above CHF 5,000 without a public tender (direct or invited award), worth CHF ${n(total / 1e6, 1)} million in francs. CHF ${n(byArea[0].value, 1)} million went to suppliers with an address in the Lugano area (69xx postcode).` },
      value: total / 1e6, unit: "mio CHF", digits: 1, year: 2025, area: "Lugano", kind: "derived",
      method: { it: `Somma delle ${chf.length} commesse in franchi della lista pubblicata dalla Città per legge (LCPubb art. 7 cpv. 5) il 2 aprile 2026; ${other.length} commesse in euro, dollari o sterline sono escluse dalla somma. La lista non comprende i concorsi pubblici (su simap.ch) né i contributi a enti. Un NPA 69xx indica un indirizzo nel Luganese, non necessariamente nella Città. Per il 2024 la lista totalizzava ${n(total24 / 1e6, 1)} milioni (risposta del Municipio all'interrogazione 1503). ${notRanked.it}`,
        en: `Sum of the ${chf.length} contracts in francs in the list the City publishes by law (LCPubb art. 7 cpv. 5), released 2 April 2026; ${other.length} contracts in euros, dollars or pounds are left out of the sum. The list does not cover public tenders (on simap.ch) or contributions to bodies. A 69xx postcode means an address in the Lugano area, not necessarily in the City. For 2024 the list totalled CHF ${n(total24 / 1e6, 1)} million (the Municipio's answer to council question 1503). ${notRanked.en}` },
      source: [src(F.commesse, "sheet 'Commesse pubbliche 2025', columns 'Deliberatario' (postcode) and 'Importo CHF', rows in CHF"), src(F.q1503, `p. ${q24.p}: 'Totale ${q24.m[2]}'`)],
      context: [{ label: { it: "Commesse (tutte le valute)", en: "Contracts (all currencies)" }, value: rows.length, unit: "commesse" },
        { label: { it: "Lista 2024", en: "2024 list" }, value: total24 / 1e6, unit: "mio CHF", digits: 2 }],
      related: ["economia.aziende", "economia.sviluppo"],
      detail: [{ title: { it: "Commesse dirette e su invito 2025, per indirizzo del fornitore", en: "Direct and invited contracts 2025, by supplier address" },
        chart: { type: "hbars", unit: "mio CHF", digits: 1, color: EC, data: byArea.map((a) => ({ key: a.key, label: a.label, value: a.value })) },
        source: [src(F.commesse, "column 'Deliberatario', postcode on the address line")] },
        { title: { it: "Commesse dirette e su invito 2025, per tipo", en: "Direct and invited contracts 2025, by type" },
        chart: { type: "hbars", unit: "mio CHF", digits: 1, color: EC, data: types.map((x, i) => ({ key: `t${i}`, label: { it: x.t, en: TYPE_EN[x.t] ?? x.t }, value: x.v })) },
        source: [src(F.commesse, "column 'Tipo commessa'")] }] },
    { id: "economia.plan-b", constellation: "economia", label: { it: "Plan ₿: contributo di Tether", en: "Plan ₿: Tether's contribution" },
      about: { it: `Per la seconda fase del Plan ₿ (2026–2030) Tether si impegna a un contributo indicativo di ${n(tether, 0)} milioni di franchi, soprattutto in natura (personale, competenze, infrastrutture, ricerca). L'accordo non comporta obblighi di spesa per la Città. Quanto il Plan ₿ costa alla Città non è pubblicato.`,
        en: `For the second phase of Plan ₿ (2026–2030) Tether commits to an indicative contribution of CHF ${n(tether, 0)} million, mostly in kind (staff, expertise, infrastructure, research). The agreement creates no spending obligation for the City. What Plan ₿ costs the City is not published.` },
      value: tether, unit: "mio CHF", year: 2026, area: "Lugano", kind: "official",
      method: { it: `Memorandum d'intesa firmato il ${signed.m[1]} tra la Città e Tether, e comunicato stampa della Città. Il Plan ₿ non ha una voce propria nei conti della Città, e ${planB.length ? `solo ${planB.length}` : "nessuna"} delle commesse dirette 2025 lo cita. Le spese possono rientrare nei «progetti speciali e nuove iniziative» dell'ufficio sviluppo economico, che non sono dettagliati, e passare dalla Fondazione Plan ₿ (costituita nel 2024). ${notRanked.it}`,
        en: `Memorandum of understanding signed on ${signed.m[1]} between the City and Tether, and the City's press release. Plan ₿ has no line of its own in the City's accounts, and ${planB.length ? `only ${planB.length}` : "none"} of the 2025 direct contracts mention it. Costs may fall under the economic office's 'special projects and new initiatives', which are not broken down, and run through the Plan ₿ Foundation (set up in 2024). ${notRanked.en}` },
      source: [src(F.mou, `p. ${contrib.p}: 'contribution of CHF ${contrib.m[1]}'; p. ${noObl.p}: 'does not entail financial obligations for the City'; p. ${signed.p}: signature`), src(F.planbCs, `p. ${csObl.p}: 'non comporta obblighi automatici di investimento o di spesa per la Città'`),
        src(F.commesse, "descriptions and cost centres searched for 'Plan B', 'Plan ₿' and 'Tether'")],
      context: [{ label: { it: "Commesse dirette 2025 che citano il Plan ₿", en: "2025 direct contracts that mention Plan ₿" }, value: planB.length, unit: "commesse" },
        { label: { it: "Progetti speciali dell'ufficio sviluppo economico, 2025", en: "Economic office special projects, 2025" }, value: mio(ofSpec), unit: "mio CHF", digits: 2 }],
      related: ["economia.sviluppo", "economia.living-lab"] },
  ];
  console.log(`initiatives: office ${n(mio(of25), 3)} · Living Lab ${n(mio(ll25), 3)} · work centre ${n(mio(wk25), 3)} · promotion ${n(mio(promo25), 3)} (${promo.length} lines) · contracts ${chf.length}+${other.length} CHF ${n(total / 1e6, 2)}M · Plan ₿ contracts ${planB.length} · LNW ${hires25.m[1]}/${courses.s}/${hours.s}`);
  return { stars };
}

export const INIZIATIVE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [F.commesse]: { url: "https://www.lugano.ch/dam/jcr:dd115cd0-f784-4e0f-9cc2-62ee95e004ce/Lista%20commesse%20pubbliche%202025.xlsx", publisher: "Città di Lugano, lista delle commesse 2025 aggiudicate su invito o incarico diretto (LCPubb art. 7 cpv. 5), pubblicata il 2 aprile 2026" },
  [F.q1503]: { url: "https://www.lugano.ch/downloadCc?name=RispostaInterrogazione_1503.pdf&type=risposte&unid=D8ED6C70716F73D6C1258CE600426E51", publisher: "Città di Lugano, risposta del Municipio all'interrogazione 1503 (risoluzione del 14 agosto 2025)" },
  [F.lnw25]: { url: "https://www.lugano.ch/dam/jcr:f89681db-6cca-4833-8346-7c3de4735f8a/LNW%20Rapporto%20di%20attivit%C3%A0%202025.pdf", publisher: "Città di Lugano, LuganoNetWork – Rapporto di attività 2025" },
  [F.lnw24]: { url: "https://www.lugano.ch/dam/jcr:cdf5df49-9d2d-4cd3-a14a-0b485c1e111b/LNW%20Rapporto%20di%20attivit%C3%A0%202024.pdf", publisher: "Città di Lugano, LuganoNetWork – Rapporto di attività 2024" },
  [F.lnw23]: { url: "https://www.lugano.ch/dam/jcr:9af2cf7e-cb73-4e1f-b1b3-ea0ce74a988c/rapp-attivita-lnw-2023.pdf", publisher: "Città di Lugano, LuganoNetWork – Rapporto di attività 2023" },
  [F.lnw22]: { url: "https://www.lugano.ch/dam/jcr:51f2aadd-2a77-4620-9869-48d6bae41a5c/rapp-attivita-lnw-2022.pdf", publisher: "Città di Lugano, LuganoNetWork – Rapporto di attività 2022" },
  [F.mou]: { url: "https://planb.lugano.ch/wp-content/uploads/2026/06/LVGA_Tether_Mou_EN.pdf", publisher: "Città di Lugano e Tether, Memorandum of Understanding – Plan ₿ Phase II (3 marzo 2026)" },
  [F.planbCs]: { url: "https://www.lugano.ch/dam/jcr:aacbaac3-79b4-42ac-b859-4f2a269aaa85/20260303-seconda-fase-lugano-plan-b-comunicato.pdf", publisher: "Città di Lugano, comunicato stampa: Plan ₿ Fase II (3 marzo 2026)" },
};
