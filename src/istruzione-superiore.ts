// Secondary and tertiary education in Lugano (EDUCATION-SOURCES.md, "Secondary and tertiary levels").
// These schools are not run by the City: middle schools, licei and vocational schools are cantonal; USI and SUPSI are
// independent. The stars count pupils and students at sites located in the City (wherever they live), and each says
// what the City itself spends on that level, read from its 2024 accounts (canton appendice TabD).
// All sources are tables, read deterministically; every table's site rows must add up to its printed total.

import { readFileSync } from "node:fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import type { Source, Star, Text } from "./catalog";
import { fail, num, rawPath, sheet, type Row } from "./adapters/common";
import { APPENDICE } from "./adapters/sel";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const YEAR = "2024-25";
const DECS = "https://www4.ti.ch/fileadmin/DECS/DS/documenti/statistica/allievi/";

export const FILES = {
  medie: "decs-B310-scuole-medie.xlsx", licei: "decs-C210.xlsx", sam: "decs-C310.xlsx", saa: "decs-C320.xlsx", sca: "decs-C330.xlsx",
  smc: "decs-C340.xlsx", mp: "decs-C370.xlsx", spai: "decs-C420.xlsx", spc: "decs-C440.xlsx", smt: "decs-C470.xlsx",
  usi: "usi-students-total.html", dti: "supsi-dti-fatti-cifre-2025.html", csi: "conservatorio-rapporto-2025.pdf",
};

/** Conservatorio della Svizzera italiana, annual report 2025: the university music school (SUM), Via Soldino 9, Lugano. */
async function conservatorio() {
  const pages: string[] = [];
  await pdf(readFileSync(rawPath(FILES.csi)), { pagerender: (p: any) => p.getTextContent().then((t: any) => {
    const s = t.items.map((i: any) => i.str).join(" ").replace(/\s+/g, " "); pages.push(s); return s; }) });
  const i = pages.findIndex((p) => /la SUM ha contato ben \d+ studenti iscritti/.test(p));
  if (i < 0) fail("Conservatorio report: SUM enrolment sentence missing");
  const p = pages[i];
  const m = p.match(/la SUM ha contato ben (\d+) studenti iscritti, di cui (\d+) nella formazione di Base \(Bachelor e Master\) e (\d+) in Formazione con\s?-?\s?tinua/);
  const ba = p.match(/Programmi Bachelor \(BA\): (\d+) studenti iscritti/), ma = p.match(/Programmi Master \(MA\): (\d+) studenti iscritti/);
  if (!m || !ba || !ma) fail("Conservatorio report: SUM figures not found");
  const [all, base, ce] = m!.slice(1).map(Number), [nBA, nMA] = [Number(ba![1]), Number(ma![1])];
  if (nBA + nMA !== base || base + ce !== all) fail("Conservatorio report: BA + MA != base, or base + continuing != total");
  if (!pages.some((q) => /Via Soldino 9 CH-6900 Lugano/.test(q))) fail("Conservatorio report: Lugano address missing");
  return { all, base, ce, ba: nBA, ma: nMA, page: i + 1 };
}
// schools located in the municipality of Lugano (addresses checked on the DECS school portal, 16.10.2026)
const MEDIE_IN_LUGANO = ["Scuola media Barbengo", "Scuola media Breganzona", "Scuola media Lugano 1", "Scuola media Lugano 2", "Scuola media Pregassona", "Scuola media Viganello"];
const LICEI_IN_LUGANO = ["Liceo di Lugano 1", "Liceo di Lugano 3"]; // Lugano 2 is in Savosa

const total = (r: Row) => num(r[r.length - 1]) ?? fail("total column empty");
const yearSheet = (file: string, y = YEAR) => sheet(file, y);

/** Tables with one row per site (B310, C210, C420): site total = last column. Checks: sites add up to the "Totale" row. */
function oneRowPerSite(file: string, y = YEAR) {
  const rows = yearSheet(file, y).slice(3);
  const end = rows.findIndex((r) => /^Totale/.test(String(r[0] ?? "")));
  if (end < 0) fail(`${file} ${y}: total row missing`);
  const sites = new Map(rows.slice(0, end).filter((r) => r[0]).map((r) => [String(r[0]).trim(), { pupils: total(r), sections: num(r[1]) ?? 0 }]));
  const sum = [...sites.values()].reduce((s, x) => s + x.pupils, 0);
  if (sum !== total(rows[end])) fail(`${file} ${y}: sites add up to ${sum}, total row says ${total(rows[end])}`);
  return { sites, all: total(rows[end]), allSections: num(rows[end][1]) ?? 0 };
}

/** Tables with a site and its programmes (C310, C340, C440, C470): the site total is its "Totale" row in column 1. */
function siteWithProgrammes(file: string) {
  const rows = yearSheet(file).slice(3);
  const sites = new Map<string, number>(); let cur = "";
  for (const r of rows) {
    if (/^Totale complessivo/.test(String(r[0] ?? ""))) { const sum = [...sites.values()].reduce((s, x) => s + x, 0);
      if (sum !== total(r)) fail(`${file}: sites add up to ${sum}, total row says ${total(r)}`); return { sites, all: total(r) }; }
    if (r[0]) cur = String(r[0]).trim();
    if (/^Totale/.test(String(r[1] ?? "").trim())) sites.set(cur, total(r));
  }
  return fail(`${file}: "Totale complessivo" missing`);
}

/** Single-school tables (C320, C330): the school's total is the "Totale" row. Check: programmes add up to it. */
function singleSchool(file: string) {
  const rows = yearSheet(file).slice(3);
  const end = rows.findIndex((r) => /^Totale/.test(String(r[0] ?? "")));
  if (end < 0) fail(`${file}: total row missing`);
  const sum = rows.slice(0, end).filter((r) => r[0]).reduce((s, r) => s + total(r), 0);
  if (sum !== total(rows[end])) fail(`${file}: programmes add up to ${sum}, total says ${total(rows[end])}`);
  return total(rows[end]);
}

/** Post-apprenticeship maturità (C370): rows are type → site; count the sites whose name contains "Lugano". */
function maturitaLugano(file: string) {
  const rows = yearSheet(file).slice(3);
  let lugano = 0, sites = 0, all = 0;
  for (const r of rows) {
    if (/^Totale complessivo/.test(String(r[0] ?? ""))) { all = total(r); break; }
    const site = String(r[1] ?? "").trim();
    if (!site || /^Totale/.test(site)) continue;
    sites += total(r); if (/Lugano/.test(site)) lugano += total(r);
  }
  if (sites !== all) fail(`${file}: sites add up to ${sites}, total says ${all}`);
  return lugano;
}

const text = (file: string) => readFileSync(rawPath(file), "utf8").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

function usi() {
  const t = text(FILES.usi);
  const m = t.match(/Total of USI students (\d+) By Faculty Arc (\d+) BioMed (\d+) Com (\d+) Eco (\d+) Inf (\d+) FtL (\d+)/);
  if (!m) fail("USI table: layout changed");
  const [all, arc, bio, com, eco, inf, ftl] = m!.slice(1).map(Number);
  if (arc + bio + com + eco + inf + ftl !== all) fail("USI table: faculties do not add up to the total");
  const sem = t.match(/Autumn semester (\d{4})\/(\d{2})/);
  if (!sem) fail("USI table: semester missing");
  return { all, arc, lugano: all - arc, faculties: { bio, com, eco, inf, ftl }, year: Number(sem![1]) };
}

function dti() {
  const m = text(FILES.dti).match(/(\d{3,5}) Studentesse e studenti Bachelor e Master/);
  if (!m) fail("SUPSI DTI page: student figure missing");
  return Number(m![1]);
}

/** DTI split: Bachelor and Master, which must add up to the department total. */
function dtiSplit(total: number) {
  const t = text(FILES.dti);
  const ba = t.match(/(\d{2,5}) Studentesse e studenti Bachelor(?! e)/), ma = t.match(/(\d{2,5}) Studentesse e studenti Master/);
  if (!ba || !ma) fail("SUPSI DTI page: Bachelor/Master split missing");
  const [b, m] = [Number(ba![1]), Number(ma![1])];
  if (b + m !== total) fail(`SUPSI DTI page: Bachelor ${b} + Master ${m} != ${total}`);
  return { ba: b, ma: m };
}

const SCHOOL_YEARS = Array.from({ length: 10 }, (_, i) => `${2015 + i}-${String(16 + i).padStart(2, "0")}`); // 2015-16 … 2024-25
const yearLabel = (y: string) => ({ it: y.replace("-", "/"), en: y.replace("-", "/") });
const ED = "var(--istruzione)";

/** What the City spends on a function in its 2024 accounts (CHF million; 0 when the column is absent or empty). */
function cityCost(codes: string[]) {
  const rows = sheet(APPENDICE, "TabD"), head = rows[1].map((h) => String(h ?? "").trim());
  const lug = rows.find((r) => String(r[0] ?? "").trim() === "Lugano") ?? fail("TabD: Lugano missing");
  return codes.reduce((s, c) => { const i = head.indexOf(c); return s + (i < 0 ? 0 : (num(lug[i]) ?? 0)); }, 0) / 1000;
}

export async function istruzioneSuperiore(src: Src) {
  const med = oneRowPerSite(FILES.medie), med15 = oneRowPerSite(FILES.medie, "2015-16");
  for (const s of MEDIE_IN_LUGANO) if (!med.sites.has(s) || !med15.sites.has(s)) fail(`B310: ${s} missing`);
  const medLug = MEDIE_IN_LUGANO.reduce((a, s) => a + med.sites.get(s)!.pupils, 0);
  const medSec = MEDIE_IN_LUGANO.reduce((a, s) => a + med.sites.get(s)!.sections, 0);
  const med15Lug = MEDIE_IN_LUGANO.reduce((a, s) => a + med15.sites.get(s)!.pupils, 0);

  const lic = oneRowPerSite(FILES.licei);
  for (const s of [...LICEI_IN_LUGANO, "Liceo di Lugano 2"]) if (!lic.sites.has(s)) fail(`C210: ${s} missing`);
  const licLug = LICEI_IN_LUGANO.reduce((a, s) => a + lic.sites.get(s)!.pupils, 0);

  const sam = siteWithProgrammes(FILES.sam), smc = siteWithProgrammes(FILES.smc), spc = siteWithProgrammes(FILES.spc), smt = siteWithProgrammes(FILES.smt);
  const spai = oneRowPerSite(FILES.spai);
  const voc: { it: string; en: string; v: number; loc: string }[] = [
    { it: "Scuola media di commercio", en: "Commercial secondary school", v: smc.sites.get("Scuola media di commercio Lugano") ?? fail("C340: Lugano missing"), loc: "C340 'Scuola media di commercio Lugano'" },
    { it: "Scuola medico-tecnica", en: "Medical-technical school", v: smt.sites.get("Scuola medico-tecnica Lugano") ?? fail("C470: Lugano missing"), loc: "C470 'Scuola medico-tecnica Lugano'" },
    { it: "Scuola d'arte applicata (CSIA)", en: "Applied arts school (CSIA)", v: singleSchool(FILES.saa), loc: "C320 (single school, CSIA, Via Brentani 18)" },
    { it: "Scuola professionale commerciale", en: "Commercial vocational school", v: spc.sites.get("Scuola professionale commerciale Lugano") ?? fail("C440: Lugano missing"), loc: "C440 'Scuola professionale commerciale Lugano'" },
    { it: "Scuola cantonale d'arte (CSIA)", en: "Cantonal art school (CSIA)", v: singleSchool(FILES.sca), loc: "C330 (single school, CSIA)" },
    { it: "Scuola d'arti e mestieri della sartoria, Viganello", en: "Tailoring school, Viganello", v: sam.sites.get("Scuola d'arti e mestieri della sartoria Viganello") ?? fail("C310: Viganello missing"), loc: "C310 'Scuola d'arti e mestieri della sartoria Viganello'" },
    { it: "Maturità professionale dopo il tirocinio (sedi di Lugano)", en: "Post-apprenticeship vocational maturity (Lugano sites)", v: maturitaLugano(FILES.mp), loc: "C370, sites containing 'Lugano'" },
    { it: "SPAI artistica (CSIA)", en: "Arts vocational school (CSIA)", v: spai.sites.get("SPAI artistica Lugano")?.pupils ?? fail("C420: SPAI artistica Lugano missing"), loc: "C420 'SPAI artistica Lugano'" },
  ];
  const vocAll = voc.reduce((a, x) => a + x.v, 0);
  const u = usi(), dtiN = dti(), csi = await conservatorio();

  // every three-digit university line (27x): anything beyond 271 (USI) would be spending on other universities such as SUPSI
  const c27all = (() => { const r = sheet(APPENDICE, "TabD"); return cityCost(r[1].map((h) => String(h ?? "").trim()).filter((h) => /^27\d$/.test(h))); })();
  if (c27all < cityCost(["271"]) - 1e-9) fail("TabD: university lines (27x) smaller than 271");
  const c213 = cityCost(["213"]), c25 = cityCost(["25", "251", "252"]), c23 = cityCost(["23", "231", "26", "261"]), c27 = cityCost(["271"]);
  const decsSrc = (file: string, what: string) => src(file, `sheet ${YEAR}, ${what}`);
  const costSrc = (code: string) => src(APPENDICE, `sheet TabD, column ${code}, row 'Lugano' (CHF thousands; no column = no spending)`);
  const cityText = (v: number, code: string): Text => v > 0
    ? { it: `La Città vi spende ${n(v, 2)} milioni (funzione ${code}, conti 2024).`, en: `The City spends CHF ${n(v, 2)} million on it (function ${code}, 2024 accounts).` }
    : { it: `I conti 2024 della Città non hanno spese per questo livello (funzione ${code}).`, en: `The City's 2024 accounts show no spending on this level (function ${code}).` };
  const join = (a: Text, b: Text): Text => ({ it: `${a.it} ${b.it}`, en: `${a.en} ${b.en}` });
  const siteYear = 2024;

  const stars: Star[] = [
    { id: "istruzione.medie", constellation: "istruzione", operator: "canton", cityCost: { value: c213, code: "213", year: 2024 },
      label: { it: "Scuole medie in città", en: "Middle schools in the city" },
      about: join({ it: `Allievi delle ${MEDIE_IN_LUGANO.length} scuole medie pubbliche con sede a Lugano nel 2024/25, in ${medSec} sezioni (${n(medLug / medSec, 1)} per sezione): ${n((medLug / med.all) * 100, 1)}% degli allievi di scuola media del Ticino. Nel 2015/16 erano ${n(med15Lug)}. Le scuole medie sono cantonali; vi vanno anche allievi dei comuni vicini.`,
        en: `Pupils at the ${MEDIE_IN_LUGANO.length} public middle schools located in Lugano in 2024/25, in ${medSec} classes (${n(medLug / medSec, 1)} per class): ${n((medLug / med.all) * 100, 1)}% of Ticino's middle-school pupils. In 2015/16 there were ${n(med15Lug)}. Middle schools are run by the canton; pupils from neighbouring municipalities attend them too.` }, cityText(c213, "213")),
      value: medLug, unit: "allievi", year: siteYear, area: "Lugano", kind: "derived",
      method: { it: `Somma delle sedi ${MEDIE_IN_LUGANO.map((s) => s.replace("Scuola media ", "")).join(", ")}; il totale delle sedi è controllato con quello del Cantone.`, en: `Sum of the sites ${MEDIE_IN_LUGANO.map((s) => s.replace("Scuola media ", "")).join(", ")}; site rows are checked against the canton's total.` },
      source: [decsSrc(FILES.medie, `rows ${MEDIE_IN_LUGANO.join(", ")}, column Totale; sheet 2015-16 for the trend`), costSrc("213")],
      context: [{ label: { it: "Sezioni", en: "Classes" }, value: medSec, unit: "sezioni" },
        { label: { it: "Ticino", en: "Ticino" }, value: med.all, unit: "allievi" },
        { label: { it: "Nel 2015/16", en: "In 2015/16" }, value: med15Lug, unit: "allievi" }],
      related: ["istruzione.allievi"] },
    { id: "istruzione.licei", constellation: "istruzione", operator: "canton", cityCost: { value: c25, code: "25", year: 2024 },
      label: { it: "Licei in città", en: "Licei in the city" },
      about: join({ it: `Studenti dei licei cantonali con sede a Lugano nel 2024/25: Lugano 1 (${n(lic.sites.get("Liceo di Lugano 1")!.pupils)}) e Lugano 3 a Viganello (${n(lic.sites.get("Liceo di Lugano 3")!.pupils)}). Il Liceo di Lugano 2 (${n(lic.sites.get("Liceo di Lugano 2")!.pupils)}) è a Savosa e non è contato.`,
        en: `Students at the cantonal licei located in Lugano in 2024/25: Lugano 1 (${n(lic.sites.get("Liceo di Lugano 1")!.pupils)}) and Lugano 3 in Viganello (${n(lic.sites.get("Liceo di Lugano 3")!.pupils)}). Liceo Lugano 2 (${n(lic.sites.get("Liceo di Lugano 2")!.pupils)}) is in Savosa and is not counted.` }, cityText(c25, "25")),
      value: licLug, unit: "studenti", year: siteYear, area: "Lugano", kind: "derived",
      method: { it: "Somma delle sedi Lugano 1 e Lugano 3; il totale delle sedi è controllato con quello del Cantone.", en: "Sum of the Lugano 1 and Lugano 3 sites; site rows are checked against the canton's total." },
      source: [decsSrc(FILES.licei, "rows 'Liceo di Lugano 1', 'Liceo di Lugano 3', column Totale"), costSrc("25")],
      context: [{ label: { it: "Ticino", en: "Ticino" }, value: lic.all, unit: "studenti" }],
      related: ["istruzione.medie"] },
    { id: "istruzione.professionali", constellation: "istruzione", operator: "canton", cityCost: { value: c23, code: "23/26", year: 2024 },
      label: { it: "Scuole professionali e specializzate", en: "Vocational and specialised schools" },
      about: join({ it: `Allievi delle scuole professionali e specializzate cantonali con sede a Lugano nel 2024/25, a tempo pieno o parziale: ${voc.map((x) => `${x.it} ${n(x.v)}`).join(", ")}. Le scuole del Centro di Trevano (Canobbio) e del settore sociosanitario (Canobbio, Giubiasco, Mendrisio) non sono a Lugano.`,
        en: `Students at the cantonal vocational and specialised schools located in Lugano in 2024/25, full or part time: ${voc.map((x) => `${x.en} ${n(x.v)}`).join(", ")}. The Trevano centre (Canobbio) and the health and social-care schools (Canobbio, Giubiasco, Mendrisio) are not in Lugano.` }, cityText(c23, "23, 26")),
      value: vocAll, unit: "allievi", year: siteYear, area: "Lugano", kind: "derived",
      method: { it: "Somma delle sedi di Lugano in otto tabelle del DECS (indirizzi controllati sul portale delle scuole); ogni tabella è controllata con il suo totale.", en: "Sum of the Lugano sites across eight DECS tables (addresses checked on the school portal); each table is checked against its own total." },
      source: voc.map((x) => src(Object.values(FILES).find((f) => f.includes(x.loc.slice(0, 4)))!, `sheet ${YEAR}, ${x.loc}, column Totale`)).concat([costSrc("23, 26")]),
      context: voc.slice(0, 4).map((x) => ({ label: { it: x.it, en: x.en }, value: x.v, unit: "allievi" })),
      related: ["istruzione.medie"] },
    { id: "istruzione.usi", constellation: "istruzione", operator: "independent", cityCost: { value: c27, code: "271", year: 2024 },
      label: { it: "USI a Lugano", en: "USI in Lugano" },
      about: join({ it: `Studenti dell'Università della Svizzera italiana nelle facoltà con sede a Lugano (semestre autunnale ${u.year}/${String(u.year + 1).slice(2)}): economia ${n(u.faculties.eco)}, comunicazione ${n(u.faculties.com)}, informatica ${n(u.faculties.inf)}, scienze biomediche ${n(u.faculties.bio)}, teologia ${n(u.faculties.ftl)}. In tutto l'USI ne conta ${n(u.all)}; architettura (${n(u.arc)}) è a Mendrisio. L'USI è finanziata da Cantone, Confederazione, altri cantoni e tasse.`,
        en: `Students of the Università della Svizzera italiana in the faculties based in Lugano (autumn semester ${u.year}/${String(u.year + 1).slice(2)}): economics ${n(u.faculties.eco)}, communication ${n(u.faculties.com)}, informatics ${n(u.faculties.inf)}, biomedical sciences ${n(u.faculties.bio)}, theology ${n(u.faculties.ftl)}. USI has ${n(u.all)} in all; architecture (${n(u.arc)}) is in Mendrisio. USI is funded by the canton, the Confederation, other cantons and fees.` },
        { it: `La Città versa ${n(c27, 2)} milioni all'anno (funzione 271, conti 2024), il contributo alla fondazione per le facoltà di Lugano.`, en: `The City pays CHF ${n(c27, 2)} million a year (function 271, 2024 accounts), its contribution to the foundation for the Lugano faculties.` }),
      value: u.lugano, unit: "studenti", year: u.year, area: "Lugano", kind: "derived",
      method: { it: "Totale USI meno la facoltà di architettura (Mendrisio); le facoltà sono controllate con il totale.", en: "USI total minus the architecture faculty (Mendrisio); faculties are checked against the total." },
      source: [src(FILES.usi, "Students – Total: total and 'By Faculty' (autumn semester)"), costSrc("271")],
      context: [{ label: { it: "USI in tutto", en: "USI in all" }, value: u.all, unit: "studenti" },
        { label: { it: "Architettura, Mendrisio", en: "Architecture, Mendrisio" }, value: u.arc, unit: "studenti" }],
      related: ["istruzione.licei"] },
    { id: "istruzione.supsi", constellation: "istruzione", operator: "independent", cityCost: { value: c27all - c27, code: "27", year: 2024 },
      label: { it: "SUPSI a Lugano", en: "SUPSI in Lugano" },
      about: { it: `Studenti Bachelor e Master del Dipartimento tecnologie innovative della SUPSI, al Campus Est di Lugano-Viganello, nel 2025. Gli altri dipartimenti SUPSI sono a Manno, Mendrisio e Locarno. Nei conti 2024 della Città la spesa per le università (funzione 27) è solo il contributo all'USI.`,
        en: `Bachelor and Master students of SUPSI's Department of Innovative Technologies, at Campus Est in Lugano-Viganello, in 2025. SUPSI's other departments are in Manno, Mendrisio and Locarno. In the City's 2024 accounts, university spending (function 27) is only the contribution to USI.` },
      value: dtiN, unit: "studenti", year: 2025, area: "Lugano", kind: "official",
      source: [src(FILES.dti, "Fatti e cifre 2025: 'Studentesse e studenti Bachelor e Master'"), costSrc("271")],
      related: ["istruzione.professionali", "istruzione.usi"] },
    { id: "istruzione.conservatorio", constellation: "istruzione", operator: "independent", cityCost: { value: c27all - c27, code: "27", year: 2024 },
      label: { it: "Conservatorio", en: "Conservatory" },
      about: { it: `Studenti Bachelor (${n(csi.ba)}) e Master (${n(csi.ma)}) della Scuola universitaria di Musica del Conservatorio della Svizzera italiana, in via Soldino a Lugano, nel 2025. Altri ${n(csi.ce)} seguivano la formazione continua (MAS/CAS), ${n(csi.all)} in tutto. Il Conservatorio è una fondazione privata di pubblica utilità affiliata alla SUPSI. Nei conti 2024 della Città la spesa per le università (funzione 27) è solo il contributo all'USI.`,
        en: `Bachelor (${n(csi.ba)}) and Master (${n(csi.ma)}) students of the University of Music of the Conservatorio della Svizzera italiana, in Via Soldino in Lugano, in 2025. Another ${n(csi.ce)} were in continuing education (MAS/CAS), ${n(csi.all)} in all. The Conservatorio is a private non-profit foundation affiliated with SUPSI. In the City's 2024 accounts, university spending (function 27) is only the contribution to USI.` },
      value: csi.base, unit: "studenti", year: 2025, area: "Lugano", kind: "official",
      source: [src(FILES.csi, `p. ${csi.page}: "la SUM ha contato ben ${csi.all} studenti iscritti, di cui ${csi.base} nella formazione di Base (Bachelor e Master)"; address p. 85`), costSrc("271")],
      context: [{ label: { it: "Formazione continua", en: "Continuing education" }, value: csi.ce, unit: "studenti" },
        { label: { it: "In tutto", en: "In all" }, value: csi.all, unit: "studenti" }],
      related: ["istruzione.supsi"] },
  ];

  // ---- detail views: the same tables, over time and by site
  const S = (id: string) => stars.find((x) => x.id === id) ?? fail(`detail: ${id} missing`);
  const medSeries = SCHOOL_YEARS.map((y) => {
    const tb = oneRowPerSite(FILES.medie, y);
    return { y, v: MEDIE_IN_LUGANO.reduce((a, site) => a + (tb.sites.get(site)?.pupils ?? fail(`B310 ${y}: ${site} missing`)), 0) };
  });
  if (medSeries[medSeries.length - 1].v !== medLug || medSeries[0].v !== med15Lug) fail("B310: series does not match the star");
  S("istruzione.medie").detail = [
    { title: { it: "Allievi nelle scuole medie in città, per anno scolastico", en: "Pupils at middle schools in the city, by school year" },
      chart: { type: "columns", unit: "allievi", color: ED, series: [{ label: { it: "Allievi (6 sedi)", en: "Pupils (6 sites)" },
        data: medSeries.map((p) => ({ key: `a${p.y}`, label: yearLabel(p.y), value: p.v })) }] },
      source: [src(FILES.medie, "sheets 2015-16 … 2024-25, the six Lugano sites, column Totale")] },
    { title: { it: "Per sede, 2024/25", en: "By site, 2024/25" },
      chart: { type: "hbars", unit: "allievi", color: ED, caption: { it: "allievi · 2024/25", en: "pupils · 2024/25" },
        data: MEDIE_IN_LUGANO.map((site) => ({ key: site, label: { it: site.replace("Scuola media ", ""), en: site.replace("Scuola media ", "") }, value: med.sites.get(site)!.pupils }))
          .sort((a, b) => b.value - a.value) },
      source: [decsSrc(FILES.medie, "the six Lugano sites, column Totale")] },
  ];
  const licSeries = SCHOOL_YEARS.map((y) => {
    const tb = oneRowPerSite(FILES.licei, y);
    if (!tb.sites.has("Liceo di Lugano 1")) fail(`C210 ${y}: Lugano 1 missing`);
    return { y, v: LICEI_IN_LUGANO.reduce((a, site) => a + (tb.sites.get(site)?.pupils ?? 0), 0), l3: tb.sites.has("Liceo di Lugano 3") };
  });
  if (licSeries[licSeries.length - 1].v !== licLug) fail("C210: series does not match the star");
  const l3From = (licSeries.find((p) => p.l3) ?? fail("C210: Lugano 3 never present")).y;
  S("istruzione.licei").detail = [
    { title: { it: "Studenti dei licei in città, per anno scolastico", en: "Students at licei in the city, by school year" },
      chart: { type: "columns", unit: "studenti", color: ED, series: [{ label: { it: "Lugano 1 e Lugano 3", en: "Lugano 1 and Lugano 3" },
        data: licSeries.map((p) => ({ key: `a${p.y}`, label: yearLabel(p.y), value: p.v })) }] },
      note: { it: `Il Liceo di Lugano 3 (Viganello) c'è dal ${l3From.replace("-", "/")}; prima tutti gli studenti dei licei in città erano al Liceo di Lugano 1.`,
        en: `Liceo Lugano 3 (Viganello) exists from ${l3From.replace("-", "/")}; before that every liceo student in the city was at Liceo Lugano 1.` },
      source: [src(FILES.licei, "sheets 2015-16 … 2024-25, rows 'Liceo di Lugano 1' and 'Liceo di Lugano 3', column Totale")] },
  ];
  S("istruzione.professionali").detail = [
    { title: { it: "Per scuola, 2024/25", en: "By school, 2024/25" },
      chart: { type: "hbars", unit: "allievi", color: ED, caption: { it: "allievi · 2024/25", en: "students · 2024/25" },
        data: voc.map((x) => ({ key: x.loc, label: { it: x.it, en: x.en }, value: x.v })) },
      source: S("istruzione.professionali").source.slice(0, -1) },
  ];
  const sem = `${u.year}/${String(u.year + 1).slice(2)}`;
  S("istruzione.usi").detail = [
    { title: { it: "Studenti per facoltà", en: "Students by faculty" },
      chart: { type: "hbars", unit: "studenti", color: ED, caption: { it: `studenti · semestre autunnale ${sem}`, en: `students · autumn semester ${sem}` },
        data: [
          { key: "eco", label: { it: "Scienze economiche", en: "Economics" }, value: u.faculties.eco },
          { key: "com", label: { it: "Comunicazione, cultura e società", en: "Communication, culture and society" }, value: u.faculties.com },
          { key: "inf", label: { it: "Scienze informatiche", en: "Informatics" }, value: u.faculties.inf },
          { key: "bio", label: { it: "Scienze biomediche", en: "Biomedical sciences" }, value: u.faculties.bio },
          { key: "ftl", label: { it: "Teologia", en: "Theology" }, value: u.faculties.ftl },
          { key: "arc", label: { it: "Architettura (Mendrisio, non contata)", en: "Architecture (Mendrisio, not counted)" }, value: u.arc },
        ] },
      source: [src(FILES.usi, "Students – Total: 'By Faculty'")] },
  ];
  const split = dtiSplit(dtiN);
  S("istruzione.supsi").detail = [
    { title: { it: "Dipartimento tecnologie innovative: Bachelor e Master, 2025", en: "Department of Innovative Technologies: Bachelor and Master, 2025" },
      chart: { type: "hbars", unit: "studenti", color: ED, caption: { it: "studenti · 2025", en: "students · 2025" },
        data: [{ key: "ba", label: { it: "Bachelor", en: "Bachelor" }, value: split.ba }, { key: "ma", label: { it: "Master", en: "Master" }, value: split.ma }] },
      source: [src(FILES.dti, "Fatti e cifre 2025: 'Studentesse e studenti Bachelor' and '… Master'")] },
  ];
  S("istruzione.conservatorio").detail = [
    { title: { it: "Scuola universitaria di Musica: studenti per formazione, 2025", en: "University of Music: students by programme, 2025" },
      chart: { type: "hbars", unit: "studenti", color: ED, caption: { it: "studenti · 2025", en: "students · 2025" },
        data: [{ key: "ma", label: { it: "Master", en: "Master" }, value: csi.ma }, { key: "ba", label: { it: "Bachelor", en: "Bachelor" }, value: csi.ba },
          { key: "ce", label: { it: "Formazione continua (MAS/CAS, non contata)", en: "Continuing education (MAS/CAS, not counted)" }, value: csi.ce }] },
      source: [src(FILES.csi, `p. ${csi.page}: Bachelor, Master and continuing-education enrolment`)] },
  ];
  return { stars };
}

export const ISTRUZIONE_SUP_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [FILES.medie]: { url: `${DECS}B310Allievi_e_sezioni_delle_scuole_medie_pubbliche_secondo_la_sede_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (B310)" },
  [FILES.licei]: { url: `${DECS}C210Allievi_e_sezioni_dei_licei_cantonali_secondo_la_sede_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C210)" },
  [FILES.sam]: { url: `${DECS}C310Allievi_e_sezioni_delle_Scuole_d_arti_e_mestieri_secondo_la_sede_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C310)" },
  [FILES.saa]: { url: `${DECS}C320Allievi_e_sezioni_della_Scuola_d_arte_applicata_secondo_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C320)" },
  [FILES.sca]: { url: `${DECS}C330Allievi_e_sezioni_della_Scuola_cantonale_d_arte_secondo_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C330)" },
  [FILES.smc]: { url: `${DECS}C340Allievi_e_sezioni_delle_Scuole_medie_di_commercio_secondo_la_sede_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C340)" },
  [FILES.mp]: { url: `${DECS}C370Allievi_e_sezioni_della_della_maturita_professionale_post-tirocinio_o_post-diploma_secondo_il_tipo_di_maturita_la_sede_l_anno_e_il_sesso_dal_2015_16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C370)" },
  [FILES.spai]: { url: `${DECS}C420Allievi_e_sezioni_delle_SPAI_secondo_la_sede_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C420)" },
  [FILES.spc]: { url: `${DECS}C440Allievi_e_sezioni_delle_Scuole_professionali_commerciali_secondo_la_sede_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C440)" },
  [FILES.smt]: { url: `${DECS}C470Allievi_e_sezioni_delle_Scuole_medico-tecniche_secondo_la_sede_la_formazione_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx`, publisher: "Cantone Ticino, DECS – Statistica allievi (C470)" },
  [FILES.usi]: { url: "https://data.usi.ch/tables/dati-cifre-universita/students-total", publisher: "USI – Università della Svizzera italiana, data.usi.ch" },
  [FILES.dti]: { url: "https://www.dti.supsi.ch/fatti-e-cifre-2025", publisher: "SUPSI – Dipartimento tecnologie innovative, Fatti e cifre 2025" },
  [FILES.csi]: { url: "https://www.conservatorio.ch/media/839740/fondazione_conservatorio_rapporto_annuale_2025_web.pdf", publisher: "Fondazione Conservatorio della Svizzera italiana, Rapporto annuale 2025" },
};
