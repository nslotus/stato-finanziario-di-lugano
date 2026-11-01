// The education constellation (EDUCATION-SOURCES.md). Spending and age stars compare within Ticino;
// school stars (pupils, class sizes) are Lugano's Istituto scolastico, set against the Ticino public-school average.

import { compare, type Relation, type Source, type Star, type Text } from "./catalog";
import type { Municipality } from "./adapters/municipalities";
import { AGE_FILE, AGE_SHEET } from "./adapters/municipalities";
import { APPENDICE, ALLEGATO } from "./adapters/sel";
import { DECS_KG, DECS_PR, DECS_YEAR, SCHOOL_SITES, education, schoolSites, schools, type Level } from "./adapters/education";
import { readPdf } from "./adapters/pdf";

export const SCHOOLS_PIN = "74c57b7"; // dati-di-lugano commit with out/schools.json
export const SCHOOLS_FILE = SCHOOLS_PIN ? `dati-di-lugano@${SCHOOLS_PIN}-schools.json` : "";

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 1) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });

export async function istruzione(register: Municipality[], population: Map<number, number>, src: Src) {
  const ed = education(register);
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;
  const method: Text = { it: "Spesa lorda del comune (conto economico 2024) divisa per la popolazione al 31.12.2024.",
    en: "The municipality's gross spending (2024 accounts) divided by its population at 31.12.2024." };
  const spendStar = (code: string, id: string, label: Text, about: Text, related: string[]): Star => {
    const c = compare([...ed.spend].map(([bfs, v]) => ({ bfs, name: name(bfs), value: (v[code] * 1000) / population.get(bfs)!, population: population.get(bfs)! })),
      "CHF / abitante", "highest-first");
    return { id, constellation: "istruzione", label, about, value: c.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived", method,
      source: [src(APPENDICE, `sheet TabD, column ${code}, row of each municipality (CHF thousands, gross spending)`), src(ALLEGATO, "sheet tab8, population 31.12.2024")],
      comparison: c, related };
  };
  const u15 = compare(register.map((m) => ({ bfs: m.bfs, name: m.name, value: (m.aged0to14 / m.population) * 100, population: m.population })), "%", "highest-first");

  const stars: Star[] = [
    spendStar("211", "istruzione.infanzia", { it: "Scuola dell'infanzia", en: "Kindergarten" },
      { it: "Spesa comunale per la scuola dell'infanzia, per abitante.", en: "Municipal spending on kindergarten, per resident." },
      ["istruzione.spesa", "istruzione.under15"]),
    spendStar("212", "istruzione.elementare", { it: "Scuola elementare", en: "Primary school" },
      { it: "Spesa comunale per la scuola elementare, per abitante.", en: "Municipal spending on primary school, per resident." },
      ["istruzione.spesa", "istruzione.under15"]),
    spendStar("217", "istruzione.edifici", { it: "Edifici scolastici", en: "School buildings" },
      { it: "Spesa comunale per gli edifici scolastici (gestione e manutenzione), per abitante.", en: "Municipal spending on school buildings (running and upkeep), per resident." },
      ["istruzione.spesa"]),
    { id: "istruzione.under15", constellation: "istruzione", label: { it: "Residenti sotto i 15 anni", en: "Residents under 15" },
      about: { it: "Quota della popolazione con meno di 15 anni: i bambini in età di scuola dell'infanzia ed elementare sono una parte di questo gruppo.",
        en: "Share of residents under 15: children of kindergarten and primary-school age are part of this group." },
      value: u15.lugano.value, unit: "%", year: 2024, area: "Lugano", kind: "derived",
      method: { it: "Somma delle classi d'età 0-4, 5-9 e 10-14, divisa per la popolazione al 31.12.2024.", en: "Sum of the age classes 0–4, 5–9 and 10–14, divided by population at 31.12.2024." },
      source: [src(AGE_FILE, `sheet ${AGE_SHEET}, row of each municipality, columns '0-4', '5-9', '10-14' and 'Totale'`)],
      comparison: u15, related: ["istruzione.spesa", "istruzione.infanzia", "istruzione.elementare"] },
  ];

  // school figures from Dati di Lugano (TypeSafe extraction with arithmetic checks), only once pinned
  if (SCHOOLS_FILE) {
    const sc = schools(SCHOOLS_FILE);
    const yrs = ["2024/25", "2025/26", "2026/27"];
    const cityMethod: Text = { it: "Cifre della Città (comunicati di inizio anno scolastico), estratte e verificate con controlli aritmetici.",
      en: "City figures (school-start press releases), extracted and verified with arithmetic checks." };
    const schoolSrc = (y: string) => src(SCHOOLS_FILE, `results[${y}] (City release: ${sc(y, "totalPupils").source})`);
    stars.push(
      { id: "istruzione.allievi", constellation: "istruzione", label: { it: "Allievi dell'Istituto scolastico", en: "Pupils in the city's schools" },
        about: { it: `Allievi delle scuole comunali di Lugano (infanzia ed elementare) nell'anno scolastico 2026/27: ${n(sc("2026/27", "kgPupils").value, 0)} alla scuola dell'infanzia e ${n(sc("2026/27", "prPupils").value, 0)} alla scuola elementare.`,
          en: `Pupils in Lugano's municipal schools (kindergarten and primary) in school year 2026/27: ${n(sc("2026/27", "kgPupils").value, 0)} in kindergarten and ${n(sc("2026/27", "prPupils").value, 0)} in primary school.` },
        value: sc("2026/27", "totalPupils").value, unit: "allievi", year: 2026, area: "Lugano", kind: "official", method: cityMethod,
        source: yrs.map(schoolSrc),
        context: yrs.slice(0, 2).map((y) => ({ label: { it: y, en: y }, value: sc(y, "totalPupils").value, unit: "allievi" })),
        related: ["istruzione.classe-elementare", "istruzione.sezione-infanzia", "istruzione.spesa"] },
      { id: "istruzione.classe-elementare", constellation: "istruzione", label: { it: "Allievi per classe (elementare)", en: "Pupils per class (primary)" },
        about: { it: "Media di allievi per classe nella scuola elementare comunale di Lugano, anno scolastico 2024/25, accanto alla media delle scuole elementari pubbliche del Ticino nello stesso anno.",
          en: "Average pupils per class in Lugano's municipal primary schools, school year 2024/25, next to the average for Ticino's public primary schools in the same year." },
        value: sc("2024/25", "prAverage").value, unit: "per classe", year: 2024, area: "Lugano", kind: "official", method: cityMethod,
        source: [schoolSrc("2024/25"), src(DECS_PR, `sheet ${DECS_YEAR}, row 'Totale': ${ed.ticinoPr.pupils} pupils / ${ed.ticinoPr.sections} sections`)],
        context: [{ label: { it: "Ticino, scuole pubbliche", en: "Ticino, public schools" }, value: ed.ticinoPr.average, unit: "per classe" }],
        related: ["istruzione.allievi", "istruzione.elementare"] },
      { id: "istruzione.sezione-infanzia", constellation: "istruzione", label: { it: "Bambini per sezione (infanzia)", en: "Children per section (kindergarten)" },
        about: { it: "Media di bambini per sezione nella scuola dell'infanzia comunale di Lugano, anno scolastico 2024/25, accanto alla media delle scuole dell'infanzia pubbliche del Ticino nello stesso anno.",
          en: "Average children per section in Lugano's municipal kindergartens, school year 2024/25, next to the average for Ticino's public kindergartens in the same year." },
        value: sc("2024/25", "kgAverage").value, unit: "per sezione", year: 2024, area: "Lugano", kind: "official", method: cityMethod,
        source: [schoolSrc("2024/25"), src(DECS_KG, `sheet ${DECS_YEAR}, row 'Totale': ${ed.ticinoKg.pupils} pupils / ${ed.ticinoKg.sections} sections`)],
        context: [{ label: { it: "Ticino, scuole pubbliche", en: "Ticino, public schools" }, value: ed.ticinoKg.average, unit: "per sezione" }],
        related: ["istruzione.allievi", "istruzione.infanzia"] },
    );
    // detail views: the three school-start releases side by side
    const ED = "var(--istruzione)", key = (y: string) => y.slice(0, 4);
    const S = (id: string) => stars.find((x) => x.id === id)!;
    S("istruzione.allievi").detail = [
      { title: { it: "Allievi per anno scolastico: infanzia ed elementare", en: "Pupils by school year: kindergarten and primary" },
        chart: { type: "columns", unit: "allievi", color: ED, series: [
          { label: { it: "Scuola dell'infanzia", en: "Kindergarten" }, data: yrs.map((y) => ({ key: `a${key(y)}`, label: { it: y, en: y }, value: sc(y, "kgPupils").value })) },
          { label: { it: "Scuola elementare", en: "Primary school" }, data: yrs.map((y) => ({ key: `b${key(y)}`, label: { it: y, en: y }, value: sc(y, "prPupils").value })) }] },
        source: yrs.map(schoolSrc) },
    ];
    S("istruzione.classe-elementare").detail = [
      { title: { it: "Allievi per classe e numero di classi, per anno scolastico", en: "Pupils per class and number of classes, by school year" },
        chart: { type: "columns", unit: "per classe", color: ED, digits: 2, series: [
          { label: { it: "Allievi per classe", en: "Pupils per class" }, data: yrs.map((y) => ({ key: `a${key(y)}`, label: { it: y, en: y }, value: sc(y, "prAverage").value,
            note: { it: `${sc(y, "prClasses").value} classi`, en: `${sc(y, "prClasses").value} classes` } })) }] },
        note: { it: `Classi: ${yrs.map((y) => `${y} ${sc(y, "prClasses").value}`).join(", ")}.`, en: `Classes: ${yrs.map((y) => `${y} ${sc(y, "prClasses").value}`).join(", ")}.` },
        source: yrs.map(schoolSrc) },
    ];
    S("istruzione.sezione-infanzia").detail = [
      { title: { it: "Bambini per sezione e numero di sezioni, per anno scolastico", en: "Children per section and number of sections, by school year" },
        chart: { type: "columns", unit: "per sezione", color: ED, digits: 2, series: [
          { label: { it: "Bambini per sezione", en: "Children per section" }, data: yrs.map((y) => ({ key: `a${key(y)}`, label: { it: y, en: y }, value: sc(y, "kgAverage").value,
            note: { it: `${sc(y, "kgSections").value} sezioni`, en: `${sc(y, "kgSections").value} sections` } })) }] },
        note: { it: `Sezioni: ${yrs.map((y) => `${y} ${sc(y, "kgSections").value}`).join(", ")}.`, en: `Sections: ${yrs.map((y) => `${y} ${sc(y, "kgSections").value}`).join(", ")}.` },
        source: yrs.map(schoolSrc) },
    ];
  }

  // pupils by site and school zone, 2025/26: the City's table published with the school-start release
  const tab = await schoolSites(readPdf);
  // the table prints the largest primary site as "NCS"; the City's release calls it Viganello
  const SITE_NAME: Record<string, string> = { NCS: "Viganello" };
  const ZONE: Record<string, string> = { "CENTRO": "Centro", "COLLINA": "Collina", "MONTE BOGLIA": "Monte Boglia", "MONTE BRÈ": "Monte Brè", "MONTE SAN SALVATORE": "Monte San Salvatore" };
  for (const lv of [tab.kindergarten, tab.primary]) for (const z of lv.zones) {
    z.zone = ZONE[z.zone] ?? (() => { throw new Error(`${SCHOOL_SITES}: unknown school zone ${z.zone}`); })();
    for (const q of z.sites) q.name = SITE_NAME[q.name] ?? q.name;
  }
  if (SCHOOLS_FILE) {
    // the table and the release must agree on the totals
    const sc = schools(SCHOOLS_FILE), y = "2025/26";
    const pairs: [string, number, number][] = [["kgPupils", tab.kindergarten.pupils, sc(y, "kgPupils").value], ["kgSections", tab.kindergarten.sections, sc(y, "kgSections").value],
      ["prPupils", tab.primary.pupils, sc(y, "prPupils").value], ["prClasses", tab.primary.sections, sc(y, "prClasses").value]];
    for (const [k, a, b] of pairs) if (a !== b) throw new Error(`${SCHOOL_SITES}: ${k} ${a} differs from the release's ${b}`);
  }
  const sitesSrc = (half: Text) => src(SCHOOL_SITES, `p. 1: table '${half.it}', one row per site, 'Totale' for each school zone and for the institute`);
  const siteStar = (id: string, lv: Level, what: { it: string; en: string; unitIt: string; unitEn: string; oneIt: string; oneEn: string; half: string; related: string[] }): Star => {
    const sites = lv.zones.flatMap((z) => z.sites.map((q) => ({ ...q, zone: z.zone })));
    const big = sites.reduce((a, b) => (b.pupils > a.pupils ? b : a)), small = sites.reduce((a, b) => (b.pupils < a.pupils ? b : a));
    const s = sitesSrc({ it: what.half, en: what.half });
    const star: Star = { id, constellation: "istruzione", label: { it: `${what.it}: allievi per sede`, en: `${what.en}: pupils by site` },
      about: { it: `Allievi nelle ${sites.length} sedi di ${what.it.toLowerCase()} della Città, anno scolastico 2025/26, in ${lv.sections} ${what.unitIt} e cinque zone: da ${small.pupils} (${small.name}) a ${big.pupils} (${big.name}) per sede.`,
        en: `Pupils at the City's ${sites.length} ${what.en.toLowerCase()} sites, school year 2025/26, in ${lv.sections} ${what.unitEn} and five school zones: from ${small.pupils} (${small.name}) to ${big.pupils} (${big.name}) per site.` },
      value: lv.pupils, unit: "allievi", year: 2025, area: "Lugano", kind: "official",
      method: { it: "Tabella della Città per sede, pubblicata con il comunicato di inizio anno scolastico del 3 settembre 2025, letta per posizione sulla pagina. Ogni sede somma al totale della sua zona, ogni zona al totale dell'Istituto, e i totali sono quelli del comunicato.",
        en: "The City's table by site, published with the school-start release of 3 September 2025, read by position on the page. Each site adds up to its zone's total, each zone to the institute's total, and the totals are those of the release." },
      source: [s], related: what.related,
      detail: [
        { title: { it: `Per zona: allievi e ${what.unitIt}`, en: `By school zone: pupils and ${what.unitEn}` },
          chart: { type: "hbars", unit: "allievi", color: "var(--istruzione)", data: lv.zones.map((z, i) => ({ key: `z${i}`, label: { it: z.zone, en: z.zone }, value: z.pupils,
            note: { it: `${z.sections} ${what.unitIt}, ${z.sites.length} sedi`, en: `${z.sections} ${what.unitEn}, ${z.sites.length} sites` } })) },
          source: [s] },
        { title: { it: "Per sede", en: "By site" },
          chart: { type: "hbars", unit: "allievi", color: "var(--istruzione)", data: [...sites].sort((a, b) => b.pupils - a.pupils || a.name.localeCompare(b.name)).map((q, i) => ({ key: `s${i}`,
            label: { it: q.name, en: q.name }, value: q.pupils, note: { it: `${q.zone}, ${q.sections} ${q.sections === 1 ? what.oneIt : what.unitIt}`, en: `${q.zone}, ${q.sections} ${q.sections === 1 ? what.oneEn : what.unitEn}` } })) },
          ...(sites.some((q) => q.name === "Viganello") ? { note: { it: "Viganello: nella tabella «NCS»; il comunicato della Città la chiama Viganello.", en: "Viganello: printed as \"NCS\" in the table; the City's release calls it Viganello." } } : {}),
          source: [s] },
      ] };
    return star;
  };
  stars.push(
    siteStar("istruzione.sedi-infanzia", tab.kindergarten, { it: "Scuola dell'infanzia", en: "Kindergarten", unitIt: "sezioni", unitEn: "sections", oneIt: "sezione", oneEn: "section", half: "SCUOLA DELL'INFANZIA", related: ["istruzione.allievi", "istruzione.sezione-infanzia"] }),
    siteStar("istruzione.sedi-elementare", tab.primary, { it: "Scuola elementare", en: "Primary school", unitIt: "classi", unitEn: "classes", oneIt: "classe", oneEn: "class", half: "SCUOLA ELEMENTARE", related: ["istruzione.allievi", "istruzione.classe-elementare"] }),
  );

  const relations: Relation[] = [
    { id: "rel.formazione-under15", x: "istruzione.under15", y: "istruzione.spesa",
      label: { it: "Spesa per la formazione e residenti giovani", en: "Education spending and young residents" },
      about: { it: "Ogni bolla è un comune del Ticino: quota di residenti sotto i 15 anni e spesa per la formazione per abitante. Il grafico descrive, non spiega le differenze.",
        en: "Each bubble is a Ticino municipality: share of residents under 15 against education spending per resident. The chart describes; it does not explain the differences." } },
  ];
  return { stars, relations };
}

export const ISTRUZIONE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [DECS_KG]: { url: "https://www4.ti.ch/fileadmin/DECS/DS/documenti/statistica/allievi/B110Allievi_e_sezioni_delle_scuole_dell_infanzia_pubbliche_secondo_il_circondario_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx",
    publisher: "Cantone Ticino, DECS – Statistica allievi (B110)" },
  [DECS_PR]: { url: "https://www4.ti.ch/fileadmin/DECS/DS/documenti/statistica/allievi/B210Allievi_e_sezioni_delle_scuole_elementari_pubbliche_secondo_il_circondario_l_anno_e_il_sesso_dal_2015-16_al_2024-25.xlsx",
    publisher: "Cantone Ticino, DECS – Statistica allievi (B210)" },
  [SCHOOL_SITES]: { url: "https://www.lugano.ch/dam/jcr:fa5a90d1-2c2a-4091-a361-4a17ab72c6c6/20250903-cs-inizio-anno-scolastico-2025-2026-tabella.pdf",
    publisher: "Città di Lugano, Istituto scolastico: pupils and sections by site, school year 2025/26 (table published with the release of 3 September 2025)" },
  ...(SCHOOLS_FILE ? { [SCHOOLS_FILE]: { url: `https://github.com/nslotus/dati-di-lugano/blob/${SCHOOLS_PIN}/out/schools.json`,
    publisher: "Dati di Lugano (school figures extracted from the City's releases)" } } : {}),
};
