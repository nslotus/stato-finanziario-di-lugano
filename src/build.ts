// Builds catalog/stars.json from the adapters, archives the sources with SHA-256, and stops on any failed check.
//   npm run build

import pdf from "pdf-parse/lib/pdf-parse.js";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { compare, type Catalogue, type Comparison, type Relation, type Star } from "./catalog";
import { rawPath } from "./adapters/common";
import { AGE_FILE, AGE_SHEET, municipalities } from "./adapters/municipalities";
import { ALLEGATO, APPENDICE, sel } from "./adapters/sel";
import { LEDGER_ORIGINS, ledger } from "./ledger";
import { ISTRUZIONE_ORIGINS, istruzione } from "./istruzione";
import { TRASPORTI_ORIGINS, trasporti } from "./trasporti";
import { CONTRIBUENTI_ORIGINS, contribuenti } from "./contribuenti";
import { ISTRUZIONE_SUP_ORIGINS, istruzioneSuperiore } from "./istruzione-superiore";
import { IMPOSTE_AZIENDE_ORIGINS, imposteAziende } from "./imposte-aziende";
import { ECONOMIA_ORIGINS, economia } from "./economia";
import { SOCIALE_ORIGINS, sociale } from "./sociale";
import { IMPRESE_ORIGINS, imprese } from "./imprese";
import { INIZIATIVE_ORIGINS, iniziative } from "./iniziative";
import { BILANCIO_FUNZIONI_ORIGINS, bilancioFunzioni } from "./bilancio-funzioni";
import { dicasteri } from "./dicasteri";
import { PIANO_ORIGINS, pianoFinanziario } from "./piano-finanziario";
import { CULTURA_ORIGINS, cultura } from "./cultura";
import { SICUREZZA_ORIGINS, sicurezza } from "./sicurezza";
import { AMBIENTE_ORIGINS, ambiente } from "./ambiente";

const SEL = "https://www4.ti.ch/fileadmin/DI/DI_DI/SEL/Comuni/DatiFinanziari/StatisticaFinanziaria";
const ORIGIN: Record<string, { url: string; publisher: string }> = {
  [ALLEGATO]: { url: `${SEL}/2024-allegato.xlsx`, publisher: "Cantone Ticino, Sezione degli enti locali" },
  [APPENDICE]: { url: `${SEL}/2024-appendice.xlsx`, publisher: "Cantone Ticino, Sezione degli enti locali" },
  [AGE_FILE]: { url: "https://www3.ti.ch/DFE/DR/USTAT/allegati/tabella/T_010202_020.xlsx", publisher: "Ufficio di statistica del Cantone Ticino (USTAT)" },
  "ustat-14-salute.pdf": { url: "https://www3.ti.ch/DFE/DR/USTAT/allegati/prodima/5314_salute.pdf", publisher: "Ufficio di statistica del Cantone Ticino (USTAT), Annuario statistico ticinese, cap. 14 Salute" },
  "dati-di-lugano@8c1fd28-debt-profile.json": { url: "https://github.com/nslotus/dati-di-lugano/blob/8c1fd28/out/debt-profile.json", publisher: "Dati di Lugano (from City of Lugano final accounts 2025, p. 2)" },
};
const src = (file: string, locator: string) => ({ file: `sources/${file}`, url: ORIGIN[file].url, publisher: ORIGIN[file].publisher, locator });

async function main() {
  Object.assign(ORIGIN, LEDGER_ORIGINS, ISTRUZIONE_ORIGINS, TRASPORTI_ORIGINS, CONTRIBUENTI_ORIGINS, ISTRUZIONE_SUP_ORIGINS, IMPOSTE_AZIENDE_ORIGINS, ECONOMIA_ORIGINS, SOCIALE_ORIGINS, IMPRESE_ORIGINS, INIZIATIVE_ORIGINS, BILANCIO_FUNZIONI_ORIGINS, PIANO_ORIGINS, CULTURA_ORIGINS, SICUREZZA_ORIGINS, AMBIENTE_ORIGINS);
  const register = municipalities();
  const rows = sel(register);
  const lugano = rows.find((r) => r.m.bfs === 5192)!;

  // per-resident spending comparison for one functional code (gross, CHF per resident)
  const perResident = (code: string | string[]): Comparison => compare(rows.map((r) => {
    const k = ([] as string[]).concat(code).reduce((s, c) => s + r.values[c], 0);
    return { bfs: r.m.bfs, name: r.m.name, value: (k * 1000) / r.population, population: r.population };
  }), "CHF / abitante", "highest-first");
  const share = (field: "aged65plus" | "aged80plus"): Comparison => compare(register.map((m) => ({
    bfs: m.bfs, name: m.name, value: (m[field] / m.population) * 100, population: m.population })), "%", "highest-first");

  const spendSrc = (sheet: string, codes: string) => [src(sheet === "tab9e" ? ALLEGATO : APPENDICE,
    `${sheet === "tab9e" ? "allegato" : "appendice"} sheet ${sheet}, column ${codes}, row of each municipality (CHF thousands, gross spending)`),
    src(ALLEGATO, "sheet tab8, column 'Popolazione residente al 31.12.2024'")];
  const perResMethod = { it: "Spesa lorda del comune (conto economico 2024) divisa per la popolazione residente al 31.12.2024.",
    en: "The municipality's gross spending (2024 accounts) divided by its resident population at 31.12.2024." };

  const health = (id: string, code: string | string[], sheet: string, cols: string, label: Star["label"], about: Star["about"], related: string[]): Star => {
    const c = perResident(code);
    return { id, constellation: "salute", label, about, value: c.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano",
      kind: "derived", method: perResMethod, source: spendSrc(sheet, cols), comparison: c, related };
  };

  const stars: Star[] = [
    health("salute.spesa", "4", "tab9e", "4 'Sanità'",
      { it: "Spesa per la salute", en: "Health spending" },
      { it: "Quanto spende il comune per la sanità, per abitante: case per anziani, cure a domicilio, salvataggio e prevenzione.",
        en: "What the municipality spends on health per resident: care homes, home and outpatient care, rescue services and prevention." },
      ["salute.case-cura", "salute.cure-ambulatoriali", "salute.salvataggio", "salute.prevenzione", "salute.over65", "bilancio.spesa"]),
    health("salute.case-cura", "412", "TabD", "412 'Case medicalizzate, di riposo e di cura'",
      { it: "Case per anziani", en: "Care homes" },
      { it: "Spesa comunale per case medicalizzate, di riposo e di cura, per abitante.",
        en: "Municipal spending on nursing, residential and care homes, per resident." },
      ["salute.spesa", "salute.over80", "salute.letti-cpa"]),
    health("salute.cure-ambulatoriali", "421", "TabD", "421 'Cure ambulatoriali'",
      { it: "Cure a domicilio e ambulatoriali", en: "Home and outpatient care" },
      { it: "Spesa comunale per cure ambulatoriali, comprese le cure a domicilio, per abitante.",
        en: "Municipal spending on outpatient care, including care at home, per resident." },
      ["salute.spesa", "salute.over80"]),
    health("salute.salvataggio", "422", "TabD", "422 'Servizi di salvataggio'",
      { it: "Servizi di salvataggio", en: "Rescue services" },
      { it: "Spesa comunale per i servizi di salvataggio (ambulanze), per abitante.",
        en: "Municipal spending on rescue services (ambulances), per resident." },
      ["salute.spesa", "salute.ospedalizzazioni"]),
    health("salute.prevenzione", ["431", "432", "433"], "TabD", "431-433 'Prevenzione della salute'",
      { it: "Prevenzione", en: "Prevention" },
      { it: "Spesa comunale per prevenzione (alcol e droghe, lotta alle malattie, servizio medico scolastico), per abitante.",
        en: "Municipal spending on prevention (alcohol and drugs, disease control, school medical service), per resident." },
      ["salute.spesa"]),
  ];

  for (const [field, id, label, about] of [
    ["aged65plus", "salute.over65", { it: "Residenti di 65 anni e più", en: "Residents aged 65+" },
      { it: "Quota della popolazione residente permanente che ha 65 anni o più.", en: "Share of the permanent resident population aged 65 or over." }],
    ["aged80plus", "salute.over80", { it: "Residenti di 80 anni e più", en: "Residents aged 80+" },
      { it: "Quota della popolazione con 80 anni o più, il gruppo che usa di più le case per anziani.",
        en: "Share of residents aged 80 or over, the group that uses care homes most." }],
  ] as const) {
    const c = share(field);
    stars.push({ id, constellation: "salute", label, about, value: c.lugano.value, unit: "%", year: 2024, area: "Lugano", kind: "derived",
      method: { it: "Somma delle classi d'età dalla soglia in su, divisa per il totale della popolazione al 31.12.2024.",
        en: "Sum of the age classes from the threshold up, divided by total population at 31.12.2024." },
      source: [src(AGE_FILE, `sheet ${AGE_SHEET}, row '5192 Lugano' (and each municipality), columns ${field === "aged65plus" ? "'65-69' to '80 e più'" : "'80 e più'"} and 'Totale'`)],
      comparison: c, related: field === "aged65plus" ? ["salute.spesa", "salute.over80"] : ["salute.case-cura", "salute.letti-cpa", "salute.over65"] });
  }

  stars.push(
    { id: "salute.letti-cpa", constellation: "salute", label: { it: "Posti letto nelle case per anziani", en: "Care-home beds" },
      about: { it: "Posti letto in casa per anziani ogni 1.000 abitanti di 80 anni e più, in Ticino. Era 264 nel 2000.",
        en: "Care-home beds per 1,000 residents aged 80+, in Ticino. It was 264 in 2000." },
      value: 169, unit: "per 1.000 over 80", year: 2024, area: "Ticino", kind: "official",
      source: [src("ustat-14-salute.pdf", "p. 4: \"nel 2024 vi sono 169 posti letto ogni 1.000 abitanti ultraottantenni, rispetto a 193 a livello svizzero\"")],
      context: [{ label: { it: "Svizzera", en: "Switzerland" }, value: 193, unit: "per 1.000 over 80" }],
      related: ["salute.case-cura", "salute.over80"] },
    { id: "salute.ospedalizzazioni", constellation: "salute", label: { it: "Ricoveri in cure acute", en: "Acute hospital stays" },
      about: { it: "Ricoveri nei reparti di cure acute ogni 1.000 abitanti, in Ticino: circa il 5% sopra la media svizzera.",
        en: "Stays in acute-care hospital wards per 1,000 residents, in Ticino: about 5% above the Swiss average." },
      value: 148, unit: "per 1.000 abitanti", year: 2024, area: "Ticino", kind: "official",
      source: [src("ustat-14-salute.pdf", "p. 3: \"nel 2024 si registrano 148 ospedalizzazioni nei reparti per cure acute ogni 1.000 abitanti … (+5%)\"")],
      related: ["salute.salvataggio"] },
  );
  // health detail views: phrases read from the archived USTAT chapter (and checked against the values above)
  {
    const t = (await pdf(readFileSync(rawPath("ustat-14-salute.pdf")))).text.replace(/\s+/g, " ").replace(/- (?=[a-z])/g, "");
    const beds = t.match(/passando in Ticino da (\d+) nel 2000 a (\d+) nel 2024/), ch = t.match(/(\d+) posti letto ogni 1\.000 abitanti ultraottantenni, rispetto a (\d+) a livello svizzero/);
    const hosp = t.match(/rispettivamente (\d+,\d) contro (\d+,\d) ospedalizzazioni ogni 1\.000 abitanti per la psichiatria e (\d+,\d) contro (\d+,\d) per la riabilitazione/);
    if (!beds || !ch || !hosp) throw new Error("DATA CHECK FAILED: USTAT health phrases not found");
    const num2 = (x: string) => Number(x.replace(",", "."));
    const S = (id: string) => stars.find((x) => x.id === id)!;
    if (Number(beds[2]) !== S("salute.letti-cpa").value || Number(ch[1]) !== S("salute.letti-cpa").value || Number(ch[2]) !== 193)
      throw new Error("DATA CHECK FAILED: USTAT bed figures differ from the star");
    const SA = "var(--salute)";
    S("salute.letti-cpa").detail = [
      { title: { it: "Posti letto ogni 1.000 abitanti di 80 anni e più", en: "Beds per 1,000 residents aged 80+" },
        chart: { type: "hbars", unit: "per 1.000 over 80", color: SA, caption: { it: "posti letto ogni 1.000 over 80", en: "beds per 1,000 aged 80+" },
          data: [{ key: "ti2000", label: { it: "Ticino, 2000", en: "Ticino, 2000" }, value: Number(beds[1]) },
            { key: "ti2024", label: { it: "Ticino, 2024", en: "Ticino, 2024" }, value: Number(beds[2]) },
            { key: "ch2024", label: { it: "Svizzera, 2024", en: "Switzerland, 2024" }, value: Number(ch[2]) }] },
        note: { it: "I posti letto crescono più lentamente della popolazione anziana, per questo il rapporto scende.", en: "Beds grow more slowly than the older population, so the ratio falls." },
        source: [src("ustat-14-salute.pdf", `p. 4: "passando in Ticino da ${beds[1]} nel 2000 a ${beds[2]} nel 2024"; "rispetto a ${ch[2]} a livello svizzero"`)] },
    ];
    S("salute.ospedalizzazioni").detail = [
      { title: { it: "Altri ricoveri ogni 1.000 abitanti: Ticino e Svizzera, 2024", en: "Other hospital stays per 1,000 residents: Ticino and Switzerland, 2024" },
        chart: { type: "columns", unit: "per 1.000 abitanti", digits: 1, color: SA, series: [
          { label: { it: "Ticino", en: "Ticino" }, data: [{ key: "apsi", label: { it: "Psichiatria", en: "Psychiatry" }, value: num2(hosp[1]) }, { key: "aria", label: { it: "Riabilitazione", en: "Rehabilitation" }, value: num2(hosp[3]) }] },
          { label: { it: "Svizzera", en: "Switzerland" }, data: [{ key: "bpsi", label: { it: "Psichiatria", en: "Psychiatry" }, value: num2(hosp[2]) }, { key: "bria", label: { it: "Riabilitazione", en: "Rehabilitation" }, value: num2(hosp[4]) }] }] },
        note: { it: "Per le cure acute la fonte dà 148 in Ticino e «+5%» rispetto alla Svizzera, senza la cifra svizzera. Tassi standardizzati per età.", en: "For acute care the source gives 148 in Ticino and \"+5%\" against Switzerland, without the Swiss figure. Age-standardised rates." },
        source: [src("ustat-14-salute.pdf", `p. 3: "rispettivamente ${hosp[1]} contro ${hosp[2]} … per la psichiatria e ${hosp[3]} contro ${hosp[4]} per la riabilitazione"`)] },
    ];
  }

  // finance hub: links healthcare to the city's finances
  const debt = JSON.parse(readFileSync(rawPath("dati-di-lugano@8c1fd28-debt-profile.json"), "utf8"));
  const q1 = debt.snapshots.find((s: any) => s.label.startsWith("Q1"));
  if (!q1?.grossDebt) throw new Error("DATA CHECK FAILED: Q1 gross debt missing in pinned debt profile");
  const debtCmp = compare(rows.map((r) => ({ bfs: r.m.bfs, name: r.m.name, value: r.values["debtPerResident"], population: r.population }))
    .filter((v) => Number.isFinite(v.value)), "CHF / abitante", "highest-first");
  const ind = JSON.parse(readFileSync(rawPath("dati-di-lugano@8c1fd28-lugano-indicators.json"), "utf8"));
  const net24 = ind.years.find((y: any) => y.indicatori.some((i: any) => i.key === "debitoNettoProCapite" && Math.abs(i.value - debtCmp.lugano.value) < 0.01))
    ?.indicatori.find((i: any) => i.key === "debitoNetto")?.value;
  const lugReg = register.find((m) => m.bfs === 5192)!.population;
  if (!net24 || Math.abs((net24 * 1000) / debtCmp.lugano.value - lugReg) > 1)
    throw new Error(`DATA CHECK FAILED: canton net debt per resident does not use Lugano's register population ${lugReg}`);
  stars.push(
    { id: "finanze.debito-pro-capite", constellation: "finanze", label: { it: "Debito netto per abitante", en: "Net debt per resident" },
      about: { it: "Debito pubblico netto (definizione cantonale: debiti meno beni finanziari) per abitante.",
        en: "Net public debt (canton definition: debt minus financial assets) per resident." },
      value: debtCmp.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "official",
      method: { it: "Calcolato dal Cantone: debito pubblico netto I diviso per la popolazione.", en: "Computed by the canton: net public debt I divided by population." },
      source: [src(ALLEGATO, "sheet tab12, column 'DP netto I in franchi procapite', row of each municipality")],
      comparison: debtCmp, related: ["finanze.debito-lordo", "bilancio.spesa"] },
    { id: "finanze.debito-lordo", constellation: "finanze", label: { it: "Debito finanziario lordo", en: "Gross financial debt" },
      about: { it: "Prestiti obbligazionari e debiti verso banche della Città, fine primo trimestre 2026.",
        en: "The City's bonds and bank loans at the end of Q1 2026." },
      value: q1.grossDebt.M, unit: "mio CHF", year: 2026, area: "Lugano", kind: "official",
      source: [src("dati-di-lugano@8c1fd28-debt-profile.json", "snapshots[Q1 2026].grossDebt; read from City of Lugano final accounts 2025 slides, p. 2")],
      related: ["finanze.debito-pro-capite", "finanze.obbligazioni"] },
    { id: "finanze.obbligazioni", constellation: "finanze", label: { it: "Obbligazioni in circolazione", en: "Bonds outstanding" },
      about: { it: "Valore nominale delle obbligazioni della Città ancora da rimborsare.",
        en: "Face value of the City's bonds still to be repaid." },
      value: debt.today.outstandingM, unit: "mio CHF", year: 2026, area: "Lugano", kind: "derived",
      method: { it: `Somma dei volumi delle ${debt.today.bondCount} obbligazioni non ancora scadute al ${debt.today.asOf}.`,
        en: `Sum of the volumes of the ${debt.today.bondCount} bonds not yet matured on ${debt.today.asOf}.` },
      source: [src("dati-di-lugano@8c1fd28-debt-profile.json", "today.outstandingM (bond register of Dati di Lugano)")],
      related: ["finanze.debito-lordo"] },
  );

  // the budget sun, sector anchors, tax stars and the Ledger chapters
  const led = await ledger(register, new Map(rows.map((r) => [r.m.bfs, r.population])), src);
  stars.push(...led.stars);
  const edu = istruzione(register, new Map(rows.map((r) => [r.m.bfs, r.population])), src);
  stars.push(...edu.stars);
  // secondary and tertiary schools located in the City (not run by it; each says what the City spends)
  stars.push(...(await istruzioneSuperiore(src)).stars);
  const tra = trasporti(register, new Map(rows.map((r) => [r.m.bfs, r.population])), src);
  stars.push(...tra.stars);
  // per taxpayer (federal statistics), next to the per-resident tax stars
  stars.push(contribuenti(register, src));
  // the economy constellation, and the breakdown of the City's economy spending (function 8) on its anchor star
  const eco = await economia(register, src);
  stars.push(...eco.stars);
  stars.find((s) => s.id === "economia.spesa")!.detail = [eco.fn8];
  // companies by legal form (commercial register) and profit of legal persons (federal tax), in the economy arm
  stars.push(...imprese(src).stars);
  // the City's economic initiatives, work and training services, promotion contributions, contracts and Plan ₿
  stars.push(...(await iniziative(src)).stars);
  // the culture and sport constellation; its anchor (function 3) gets the breakdown by line and must equal the sum of the lines
  const cul = await cultura(register, src);
  stars.push(...cul.stars);
  const anchor3 = stars.find((s) => s.id === "cultura.spesa")!;
  if (Math.abs((anchor3.value * register.find((m) => m.bfs === 5192)!.population) / 1e6 - cul.total3) > 0.01)
    throw new Error(`DATA CHECK FAILED: function 3 total ${cul.total3} differs from the anchor star`);
  anchor3.detail = cul.anchorDetail;
  anchor3.related.push("cultura.istituzioni", "cultura.sport");
  // the public safety constellation; its anchor (function 1) gets the breakdown by line and must equal the sum of the lines
  const sic = await sicurezza(register, src);
  stars.push(...sic.stars);
  const anchor1 = stars.find((s) => s.id === "sicurezza.spesa")!;
  if (Math.abs((anchor1.value * register.find((m) => m.bfs === 5192)!.population) / 1e6 - sic.total1) > 0.01)
    throw new Error(`DATA CHECK FAILED: function 1 total ${sic.total1} differs from the anchor star`);
  anchor1.detail = sic.anchorDetail;
  anchor1.related.push("sicurezza.polizia", "sicurezza.pompieri");
  // the environment constellation; its anchor (function 7) gets the breakdown by line and must equal the sum of the lines
  const amb = await ambiente(register, src);
  stars.push(...amb.stars);
  const anchor7 = stars.find((s) => s.id === "ambiente.spesa")!;
  if (Math.abs((anchor7.value * register.find((m) => m.bfs === 5192)!.population) / 1e6 - amb.total7) > 0.01)
    throw new Error(`DATA CHECK FAILED: function 7 total ${amb.total7} differs from the anchor star`);
  anchor7.detail = amb.anchorDetail;
  // not ranked: the comparison would measure how water supply is organised (see the note)
  delete anchor7.comparison;
  anchor7.method = { it: `${anchor7.method!.it} ${amb.anchorNote.it}`, en: `${anchor7.method!.en} ${amb.anchorNote.en}` };
  anchor7.source.push(...amb.anchorSrc);
  anchor7.related.push("ambiente.rifiuti", "ambiente.acque");
  // the social constellation; its anchor (function 5) gets the breakdown by line, and must equal the sum of the lines
  const soc = await sociale(register, src);
  stars.push(...soc.stars);
  const anchor5 = stars.find((s) => s.id === "sociale.spesa")!;
  if (Math.abs((anchor5.value * register.find((m) => m.bfs === 5192)!.population) / 1e6 - soc.total5) > 0.01)
    throw new Error(`DATA CHECK FAILED: function 5 total ${soc.total5} differs from the anchor star`);
  anchor5.detail = soc.anchorDetail;
  anchor5.related.push("sociale.contributi", "sociale.nidi", "sociale.assistiti");
  // business taxes at three levels: municipal (★ 401), cantonal, and the City's share of the federal tax
  const az = await imposteAziende(src, stars.find((s) => s.id === "finanze.imposte-pg")!.value); // municipal company tax, CHF million
  stars.push(...az.stars);
  const entrate = led.chapters.find((c) => c.id === "entrate")!;
  entrate.notes = [...(entrate.notes ?? []), az.note];
  entrate.stars.push("finanze.pg-cantone", "finanze.ifd-quota");
  entrate.source.push(...az.stars.flatMap((s) => s.source.slice(0, 1)));
  // the transport anchor says what its total includes and points to the airport star
  const anchor6 = stars.find((s) => s.id === "trasporti.spesa")!;
  anchor6.about = { it: `${anchor6.about.it} ${tra.aviationNote.it}`, en: `${anchor6.about.en} ${tra.aviationNote.en}` };
  anchor6.source.push(src(APPENDICE, "sheet TabD, column 632 'Aviazione e astronautica', row 'Lugano' (named in the text only)"));

  // spending by function over time and budget against actual: on each sector's anchor star, and for the planet page
  const uscite = led.chapters.find((c) => c.id === "uscite")!;
  const fnData = (uscite.chart as { data: { key: string; value: number; star?: string }[] }).data;
  const bf = await bilancioFunzioni(src, new Map(fnData.map((d) => [d.key, d.value])));
  for (const d of fnData) {
    if (!d.star) continue;
    const a = stars.find((x) => x.id === d.star)!;
    a.detail = [...(a.detail ?? []), bf.detail(d.key, `var(--${a.constellation})`)];
  }
  writeFileSync("catalog/funzioni.json", JSON.stringify({ series: Object.fromEntries(bf.series), totals: bf.totals, amend: bf.amendText, source: bf.source, lines25: bf.lines25, groups25: bf.groups25, linesSource: bf.linesSource }, null, 1) + "\n");

  // the same 2025 budget against actual by the City's organisation, with its explanations; must add up to the same total
  const org = await dicasteri(src);
  if (Math.abs(org.total - bf.totals.c25) > 0.0001) throw new Error(`DATA CHECK FAILED: departments add up to ${org.total}, functions to ${bf.totals.c25}`);
  writeFileSync("catalog/dicasteri.json", JSON.stringify({ depts: org.depts, total: org.total, source: org.source, note: org.note }, null, 1) + "\n");

  // the financial plan 2026–2033: four stars in the finance arm, and every plan year on the debt chapter's line
  const pf = await pianoFinanziario(src);
  stars.push(...pf.stars);
  const debito = led.chapters.find((c) => c.id === "debito")!;
  const dc = debito.chart as { data: { status?: string }[] };
  dc.data = [...dc.data.filter((d) => d.status !== "plan"), ...pf.debtPlan];
  debito.source.push(...pf.source);
  debito.stars.push("finanze.piano-debito", "finanze.piano-rivalorizzazioni", "finanze.piano-misure");

  // every per-resident star says which population it divides by (see METHODOLOGY, population base)
  const lugPop = register.find((m) => m.bfs === 5192)!.population.toLocaleString("de-CH");
  const popNote = {
    it: `Base per Lugano: ${lugPop} residenti permanenti, secondo la definizione federale usata per tutti i 106 comuni. È una cifra per abitante, non per contribuente. La Città pubblica cifre proprie più alte (registro comunale, residenze secondarie, frontalieri residenti): qui non si usano perché non esistono per gli altri comuni.`,
    en: `Base for Lugano: ${lugPop} permanent residents, by the federal definition used for all 106 municipalities. It is per resident, not per taxpayer. The City publishes its own higher counts (municipal register, secondary residents, cross-border workers living in Lugano); they are not used here because they don't exist for the other municipalities.`,
  };
  for (const s of stars) if (s.unit === "CHF / abitante" && s.method) s.method = { it: `${s.method.it} ${popNote.it}`, en: `${s.method.en} ${popNote.en}` };

  const relations: Relation[] = [
    { id: "rel.case-cura-over80", x: "salute.over80", y: "salute.case-cura",
      label: { it: "Case per anziani e popolazione anziana", en: "Care homes and older residents" },
      about: { it: "Ogni bolla è un comune: quota di over 80 e spesa per case per anziani per abitante. Il grafico descrive, non spiega le differenze.",
        en: "Each bubble is a municipality: share of residents over 80 against care-home spending per resident. The chart describes; it does not explain the differences." } },
    { id: "rel.spesa-over65", x: "salute.over65", y: "salute.spesa",
      label: { it: "Spesa sanitaria e over 65", en: "Health spending and residents over 65" },
      about: { it: "Ogni bolla è un comune: quota di over 65 e spesa sanitaria per abitante.",
        en: "Each bubble is a municipality: share of residents over 65 against health spending per resident." } },
  ];

  relations.push(...edu.relations, ...tra.relations);

  // integrity: every star sourced, every relation and link resolves
  const ids = new Set(stars.map((s) => s.id));
  for (const s of stars) {
    if (!s.source.length) throw new Error(`DATA CHECK FAILED: ${s.id} has no source`);
    for (const r of s.related) if (!ids.has(r)) throw new Error(`DATA CHECK FAILED: ${s.id} links to unknown ${r}`);
  }
  for (const r of relations) if (!ids.has(r.x) || !ids.has(r.y)) throw new Error(`DATA CHECK FAILED: relation ${r.id}`);

  // archive sources with SHA-256
  mkdirSync("sources", { recursive: true });
  const previous: { file: string; retrieved: string }[] = existsSync("sources/MANIFEST.json")
    ? JSON.parse(readFileSync("sources/MANIFEST.json", "utf8")) : [];
  const manifest = Object.entries(ORIGIN).map(([file, o]) => {
    const from = rawPath(file), archived = `sources/${file}`, buf = readFileSync(from);
    if (from !== archived) copyFileSync(from, archived);
    // building from the archive keeps the original retrieval time
    const retrieved = from === archived ? previous.find((m) => m.file === archived)?.retrieved ?? statSync(from).mtime.toISOString()
      : statSync(from).mtime.toISOString();
    return { file: archived, ...o, retrieved, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
  });
  writeFileSync("sources/MANIFEST.json", JSON.stringify(manifest, null, 2) + "\n");

  const catalogue: Catalogue = {
    // dated by its newest source, not by the clock, so the same sources always give the same file
    sourcesAsOf: manifest.map((m) => m.retrieved).sort().at(-1)!, stars, relations,
    uncharted: [],
    chapters: led.chapters,
  };
  mkdirSync("catalog", { recursive: true });
  writeFileSync("catalog/stars.json", JSON.stringify(catalogue, null, 1) + "\n");

  console.log(`${stars.length} stars, ${relations.length} relations, ${manifest.length} sources archived`);
  for (const s of stars) {
    const c = s.comparison;
    console.log(`  ${s.id.padEnd(28)} ${s.value.toFixed(1).padStart(8)} ${s.unit.padEnd(18)} ${c ? `rank ${c.lugano.rank}/${c.lugano.of} (1 = highest) · median ${c.median.toFixed(1)}` : s.area}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
