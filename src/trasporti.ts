// The transport constellation (TRANSPORT-SOURCES.md).
//   canton appendice 2024: 615 municipal roads, 62 public transport (622 + 629), 632 aviation (only named in the anchor text)
//   Dati di Lugano out/mobility.json: TPL passengers 2025 and PubliBike 2024, TypeSafe-extracted with arithmetic checks
// Aviation (632, the airport) is a Lugano-only star: spending, revenue and net from the City's accounts (choice made when the source was mapped, 15.10.2026).

import { readFileSync } from "node:fs";
import { compare, type Relation, type Source, type Star, type Text } from "./catalog";
import { fail, norm, num, rawPath, sheet, type Row } from "./adapters/common";
import { matcher, type Municipality } from "./adapters/municipalities";
import { ALLEGATO, APPENDICE } from "./adapters/sel";

export const MOBILITY_PIN = "969fe8d"; // dati-di-lugano commit with out/mobility.json
export const MOBILITY_FILE = MOBILITY_PIN ? `dati-di-lugano@${MOBILITY_PIN}-mobility.json` : "";

type Src = (file: string, locator: string) => Source;

// SBB open data "Ein- und Aussteigende an Bahnhöfen" (snapshot archived in sources/; the dataset is revised each summer)
export const SBB_FILE = "sbb-passagierfrequenz.csv";
const SBB_URL = "https://data.sbb.ch/api/explore/v2.1/catalog/datasets/passagierfrequenz/exports/csv?delimiter=%3B";
const LUGANO_UIC = 8505300; // Lugano station; Paradiso (8505301) lies in the municipality of Paradiso and is not counted

/** Semicolon CSV with quoted fields that may contain semicolons. */
function csv(text: string) {
  const rows: string[][] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean)) {
    const out: string[] = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ";" && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur); rows.push(out);
  }
  return rows;
}

function sbbStations() {
  const [head, ...rows] = csv(readFileSync(rawPath(SBB_FILE), "utf8"));
  const col = (k: string) => { const i = head.indexOf(k); if (i < 0) fail(`SBB file: column ${k} missing`); return i; };
  const c = { uic: col("uic"), name: col("bahnhof_gare_stazione"), kt: col("kt_ct_cantone"), y: col("jahr_annee_anno"),
    dtv: col("dtv_tjm_tgm"), dwv: col("dwv_tmjo_tfm"), dnwv: col("dnwv_tmjno_tmgnl"), note: col("note") };
  return rows.map((r) => ({ uic: Number(r[c.uic]), name: r[c.name], kt: r[c.kt], year: Number(r[c.y]),
    all: Number(r[c.dtv]), weekday: Number(r[c.dwv]), weekend: Number(r[c.dnwv]), note: r[c.note] }));
}
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const TR = "var(--trasporti)";
const isRow = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d|appendice|spese)/i.test(norm(r[0])) && r.slice(1).some((c) => num(c) !== null);

function transportSpend(register: Municipality[]) {
  const match = matcher(register);
  const tabA = sheet(APPENDICE, "TabA"), tabD = sheet(APPENDICE, "TabD");
  const colA = (c: string) => tabA[1].findIndex((h) => String(h ?? "").trim() === c);
  const colD = (c: string) => tabD[1].findIndex((h) => String(h ?? "").trim() === c);
  const a = { "61": colA("61"), "62": colA("62"), "63": colA("63") };
  const d = Object.fromEntries(["613", "615", "618", "619", "622", "629", "631", "632", "633", "634"].map((c) => [c, colD(c)]));
  if (Object.values(a).some((i) => i < 0) || Object.values(d).some((i) => i < 0)) fail("appendice: transport codes not found");
  const out = new Map<number, Record<string, number>>();
  for (const r of tabA.slice(2)) if (isRow(r)) out.set(match(r[0], "TabA").bfs, { "61": num(r[a["61"]]) ?? 0, "62": num(r[a["62"]]) ?? 0, "63": num(r[a["63"]]) ?? 0 });
  for (const r of tabD.slice(2)) {
    if (!isRow(r)) continue;
    const m = match(r[0], "TabD"), v = out.get(m.bfs)!;
    for (const [c, i] of Object.entries(d)) v[c] = num(r[i]) ?? 0;
    // three-digit lines must add up to their two-digit groups
    const s61 = v["613"] + v["615"] + v["618"] + v["619"], s62 = v["622"] + v["629"], s63 = v["631"] + v["632"] + v["633"] + v["634"];
    if (Math.abs(s61 - v["61"]) > 1 || Math.abs(s62 - v["62"]) > 1 || Math.abs(s63 - v["63"]) > 1) fail(`${m.name}: transport sub-lines do not add up`);
  }
  if (out.size !== 106) fail(`transport spending: ${out.size} municipalities`);
  // aviation revenue and net spending (Lugano is the only municipality with a material 632 line)
  for (const [tab, key] of [["TabE", "632rev"], ["TabF", "632net"]] as const) {
    const rows = sheet(APPENDICE, tab), i = rows[1].findIndex((h) => String(h ?? "").trim() === "632");
    if (i < 0) fail(`${tab}: 632 not found`);
    for (const r of rows.slice(2)) if (isRow(r)) out.get(match(r[0], tab).bfs)![key] = num(r[i]) ?? 0;
  }
  const l = out.get(5192)!;
  if (Math.abs(l["632"] - l["632rev"] - l["632net"]) > 1) fail("Lugano 632: spending − revenue != net");
  return out;
}

function mobility(file: string) {
  const j = JSON.parse(readFileSync(rawPath(file), "utf8")) as { results: { id: string; year: number; source: string;
    figures: Record<string, { value: number | null }>; checks: Record<string, boolean | null>; status: Record<string, string> }[] };
  for (const r of j.results) {
    for (const [k, ok] of Object.entries(r.checks)) if (ok !== true) fail(`mobility ${r.id}: check ${k} did not pass`);
    for (const [k, st] of Object.entries(r.status)) if (st !== "accepted") fail(`mobility ${r.id}: ${k} is "${st}"`);
  }
  return (id: string, key: string) => {
    const r = j.results.find((x) => x.id === id) ?? fail(`mobility: no ${id}`);
    return { value: r.figures[key].value ?? fail(`mobility ${id}: ${key} empty`), source: r.source, year: r.year };
  };
}

export function trasporti(register: Municipality[], population: Map<number, number>, src: Src) {
  const sp = transportSpend(register);
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;
  const method: Text = { it: "Spesa lorda del comune (conto economico 2024) divisa per la popolazione al 31.12.2024.",
    en: "The municipality's gross spending (2024 accounts) divided by its population at 31.12.2024." };
  const spendStar = (codes: string[], col: string, id: string, label: Text, about: Text, related: string[]): Star => {
    const c = compare([...sp].map(([bfs, v]) => ({ bfs, name: name(bfs), value: (codes.reduce((s, k) => s + v[k], 0) * 1000) / population.get(bfs)!,
      population: population.get(bfs)! })), "CHF / abitante", "highest-first");
    return { id, constellation: "trasporti", label, about, value: c.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived", method,
      source: [src(APPENDICE, `sheet ${col}, row of each municipality (CHF thousands, gross spending)`), src(ALLEGATO, "sheet tab8, population 31.12.2024")],
      comparison: c, related };
  };
  const lug = sp.get(5192)!;
  const stars: Star[] = [
    spendStar(["615"], "TabD, column 615 'Strade comunali'", "trasporti.strade", { it: "Strade comunali", en: "Municipal roads" },
      { it: "Spesa comunale per le strade comunali (costruzione, manutenzione, pulizia), per abitante.", en: "Municipal spending on municipal roads (building, upkeep, cleaning), per resident." },
      ["trasporti.spesa", "trasporti.pubblico"]),
    spendStar(["622", "629"], "TabD, columns 622 'Traffico regionale e d'agglomerato' and 629 'Trasporti pubblici, n. m. a.'", "trasporti.pubblico",
      { it: "Trasporto pubblico", en: "Public transport" },
      { it: "Spesa comunale per il trasporto pubblico (traffico regionale e d'agglomerato e altri servizi), per abitante.", en: "Municipal spending on public transport (regional and agglomeration services and others), per resident." },
      ["trasporti.spesa", "trasporti.strade"]),
  ];
  stars.push({ id: "trasporti.aviazione", constellation: "trasporti", label: { it: "Aeroporto (aviazione)", en: "Airport (aviation)" },
    about: { it: `Voce «aviazione» nei conti della Città, legata all'aeroporto di Lugano. Nel 2024 i ricavi (${n(lug["632rev"] / 1000, 2)} mio) hanno superato le spese (${n(lug["632"] / 1000, 2)} mio). Sono le cifre del conto comunale, non i risultati della società che gestisce l'aeroporto.`,
      en: `The "aviation" line in the City's accounts, linked to Lugano airport. In 2024 revenue (CHF ${n(lug["632rev"] / 1000, 2)}M) exceeded spending (CHF ${n(lug["632"] / 1000, 2)}M). These are the municipal accounts, not the results of the company that runs the airport.` },
    value: -lug["632net"] / 1000, unit: "mio CHF", year: 2024, area: "Lugano", kind: "derived",
    method: { it: "Ricavi meno spese della funzione 632 'Aviazione e astronautica' (conto economico 2024).", en: "Revenue minus spending of function 632 'Aviazione e astronautica' (2024 accounts)." },
    source: [src(APPENDICE, "sheets TabD (spending), TabE (revenue), TabF (net), column 632, row 'Lugano' (CHF thousands)")],
    context: [{ label: { it: "Ricavi", en: "Revenue" }, value: lug["632rev"] / 1000, unit: "mio CHF" },
      { label: { it: "Spese", en: "Spending" }, value: lug["632"] / 1000, unit: "mio CHF" }],
    related: ["trasporti.spesa"] });
  const aviationNote = { it: `Il totale comprende anche ${n(lug["632"] / 1000, 1)} milioni di spesa per l'aviazione (aeroporto), coperti dai suoi ricavi: vedi la stella dell'aeroporto.`,
    en: `The total also includes CHF ${n(lug["632"] / 1000, 1)} million of aviation (airport) spending, covered by its revenue: see the airport star.` };

  if (MOBILITY_FILE) {
    const mo = mobility(MOBILITY_FILE);
    const tplSrc = src(MOBILITY_FILE, `results[tpl] (TPL release: ${mo("tpl", "totalPassengers").source})`);
    const pbSrc = src(MOBILITY_FILE, `results[publibike] (City release: ${mo("publibike", "rentals2024").source})`);
    const extracted: Text = { it: "Cifre dei comunicati, estratte e verificate con controlli aritmetici.", en: "Figures from the releases, extracted and verified with arithmetic checks." };
    stars.push(
      { id: "trasporti.tpl", constellation: "trasporti", label: { it: "Passeggeri TPL", en: "TPL passengers" },
        about: { it: `Passeggeri trasportati nel 2025 da TPL, l'azienda di bus e funicolare del Luganese (rete di Lugano e comuni vicini), con un aumento del ${n(mo("tpl", "growthPct").value, 2)}% sul 2024. Non è una cifra della sola città.`,
          en: `Passengers carried in 2025 by TPL, the Lugano-area bus and funicular company (Lugano and neighbouring municipalities), up ${n(mo("tpl", "growthPct").value, 2)}% on 2024. Not a city-only figure.` },
        value: mo("tpl", "totalPassengers").value, unit: "passeggeri", year: 2025, area: "Lugano", kind: "official", method: extracted, source: [tplSrc],
        context: [{ label: { it: "Linee bus", en: "Bus lines" }, value: mo("tpl", "busPassengers").value, unit: "passeggeri" },
          { label: { it: "Funicolare Lugano–Stazione (oltre)", en: "Lugano–Stazione funicular (over)" }, value: mo("tpl", "funicularMillions").value, unit: "passeggeri" }],
        related: ["trasporti.pubblico", "trasporti.publibike"] },
      { id: "trasporti.publibike", constellation: "trasporti", label: { it: "Bike sharing (PubliBike)", en: "Bike sharing (PubliBike)" },
        about: { it: `Noleggi registrati nel 2024 dal bike sharing di Lugano. Con il rinnovo del 2025 la flotta passa da ${n(mo("publibike", "bikesBefore").value)} a ${n(mo("publibike", "bikesAfter").value)} bici (${n(mo("publibike", "eBikes").value)} e-bike e ${n(mo("publibike", "standardBikes").value)} muscolari). Sono noleggi, non utenti.`,
          en: `Rentals recorded in 2024 by Lugano's bike sharing. With the 2025 renewal the fleet goes from ${n(mo("publibike", "bikesBefore").value)} to ${n(mo("publibike", "bikesAfter").value)} bikes (${n(mo("publibike", "eBikes").value)} e-bikes and ${n(mo("publibike", "standardBikes").value)} standard). These are rentals, not users.` },
        value: mo("publibike", "rentals2024").value, unit: "noleggi", year: 2024, area: "Lugano", kind: "official", method: extracted, source: [pbSrc],
        context: [{ label: { it: "Costo netto per la Città, oggi", en: "Net cost to the City, now" }, value: mo("publibike", "netCostNow").value, unit: "CHF / anno" },
          { label: { it: "Costo netto dal 2027", en: "Net cost from 2027" }, value: mo("publibike", "netCost2027").value, unit: "CHF / anno" }],
        related: ["trasporti.tpl", "trasporti.strade"] },
    );
    const S = (id: string) => stars.find((x) => x.id === id)!;
    const v = (doc: string, k: string) => mo(doc, k).value;
    S("trasporti.tpl").detail = [
      { title: { it: "Passeggeri 2025: bus e funicolare", en: "Passengers 2025: buses and funicular" },
        chart: { type: "hbars", unit: "passeggeri", color: TR, caption: { it: "passeggeri · 2025; per la funicolare il comunicato dice «oltre 3,1 milioni»", en: "passengers · 2025; for the funicular the release says \"over 3.1 million\"" },
          data: [{ key: "bus", label: { it: "Linee bus", en: "Bus lines" }, value: v("tpl", "busPassengers") },
            { key: "fun", label: { it: "Funicolare Lugano–Stazione", en: "Lugano–Stazione funicular" }, value: v("tpl", "funicularMillions") }] },
        source: [tplSrc] },
    ];
    S("trasporti.publibike").detail = [
      { title: { it: "La flotta prima e dopo il rinnovo del 2025", en: "The fleet before and after the 2025 renewal" },
        chart: { type: "hbars", unit: "bici", color: TR, caption: { it: "biciclette", en: "bikes" },
          data: [{ key: "before", label: { it: "Prima del rinnovo", en: "Before the renewal" }, value: v("publibike", "bikesBefore") },
            { key: "after", label: { it: "Dopo il rinnovo", en: "After the renewal" }, value: v("publibike", "bikesAfter") },
            { key: "e", label: { it: "di cui e-bike", en: "of which e-bikes" }, value: v("publibike", "eBikes") },
            { key: "std", label: { it: "di cui biciclette tradizionali", en: "of which standard bikes" }, value: v("publibike", "standardBikes") }] },
        source: [pbSrc] },
      { title: { it: "Costo netto per la Città", en: "Net cost to the City" },
        chart: { type: "hbars", unit: "CHF / anno", color: TR, caption: { it: "CHF all'anno", en: "CHF a year" },
          data: [{ key: "now", label: { it: "Oggi", en: "Now" }, value: v("publibike", "netCostNow") },
            { key: "2027", label: { it: "Dal 2027", en: "From 2027" }, value: v("publibike", "netCost2027") }] },
        source: [pbSrc] },
    ];
  }
  stars.find((x) => x.id === "trasporti.aviazione")!.detail = [
    { title: { it: "Aviazione nei conti della Città, 2024", en: "Aviation in the City's accounts, 2024" },
      chart: { type: "hbars", unit: "mio CHF", digits: 2, color: TR, caption: { it: "mio CHF · 2024", en: "CHF million · 2024" },
        data: [{ key: "rev", label: { it: "Ricavi", en: "Revenue" }, value: lug["632rev"] / 1000 }, { key: "exp", label: { it: "Spese", en: "Spending" }, value: lug["632"] / 1000 }] },
      source: [src(APPENDICE, "sheets TabD (spending) and TabE (revenue), column 632, row 'Lugano' (CHF thousands)")] },
  ];
  const relations: Relation[] = [
    { id: "rel.strade-pubblico", x: "trasporti.strade", y: "trasporti.pubblico",
      label: { it: "Strade e trasporto pubblico", en: "Roads and public transport" },
      about: { it: "Ogni bolla è un comune del Ticino: spesa per le strade comunali e per il trasporto pubblico, per abitante. Il grafico descrive, non spiega le differenze.",
        en: "Each bubble is a Ticino municipality: spending on municipal roads against public transport, per resident. The chart describes; it does not explain the differences." } },
  ];
  // trains: SBB station counts at Lugano station
  const st = sbbStations();
  const stn = st.filter((s) => s.uic === LUGANO_UIC).sort((a, b) => a.year - b.year);
  const stnLast = stn[stn.length - 1], stnFirst = stn[0];
  if (!stnLast || stnLast.name !== "Lugano") fail("SBB file: Lugano station missing");
  if (!/Senza FLP/.test(stnLast.note)) fail("SBB file: Lugano note no longer says FLP is excluded");
  for (const s of stn) if (!(s.weekend <= s.all && s.all <= s.weekday)) fail(`SBB file: Lugano ${s.year} daily average outside weekday/weekend range`);
  const tiYear = st.filter((s) => s.kt === "TI" && s.year === stnLast.year).sort((a, b) => b.all - a.all);
  const rankTI = tiYear.findIndex((s) => s.uic === LUGANO_UIC) + 1;
  if (rankTI !== 1) fail(`SBB file: Lugano is no longer the busiest Ticino station (rank ${rankTI}); reword the star`);
  const stnSecond = tiYear[rankTI === 1 ? 1 : 0];
  stars.push({ id: "trasporti.ffs", constellation: "trasporti", label: { it: "Stazione FFS", en: "SBB station" },
    about: { it: `Persone che salgono o scendono dai treni alla stazione di Lugano in un giorno medio del ${stnLast.year}: ${n(stnLast.weekday)} nei giorni feriali, ${n(stnLast.weekend)} il sabato, la domenica e nei festivi. Chi cambia treno conta due volte; non sono compresi la FLP e gli autobus. È la stazione più frequentata delle ${tiYear.length} stazioni ticinesi nell'elenco FFS (seconda: ${stnSecond.name}, ${n(stnSecond.all)}). Nel ${stnFirst.year} erano ${n(stnFirst.all)}.`,
      en: `People getting on or off trains at Lugano station on an average day in ${stnLast.year}: ${n(stnLast.weekday)} on weekdays, ${n(stnLast.weekend)} on Saturdays, Sundays and holidays. Someone changing trains counts twice; the FLP line and buses are not included. It is the busiest of the ${tiYear.length} Ticino stations in the SBB list (second: ${stnSecond.name}, ${n(stnSecond.all)}). In ${stnFirst.year} it was ${n(stnFirst.all)}.` },
    value: stnLast.all, unit: "passeggeri al giorno", year: stnLast.year, area: "Lugano", kind: "official",
    method: { it: "Media giornaliera su tutti i giorni dell'anno (DTV) del set di dati FFS «Ein- und Aussteigende an Bahnhöfen»; la posizione confronta solo le stazioni ticinesi dello stesso anno.",
      en: "Average over all days of the year (DTV) from the SBB dataset 'Ein- und Aussteigende an Bahnhöfen'; the rank compares only Ticino stations in the same year." },
    source: [src(SBB_FILE, `rows uic ${LUGANO_UIC} 'Lugano', columns dtv_tjm_tgm, dwv_tmjo_tfm, dnwv_tmjno_tmgnl, years ${stn.map((s) => s.year).join(", ")}; rank among kt_ct_cantone = TI, ${stnLast.year}`)],
    context: [{ label: { it: "Giorni feriali", en: "Weekdays" }, value: stnLast.weekday, unit: "passeggeri al giorno" },
      { label: { it: "Sabato, domenica, festivi", en: "Weekends and holidays" }, value: stnLast.weekend, unit: "passeggeri al giorno" },
      { label: { it: `Nel ${stnFirst.year}`, en: `In ${stnFirst.year}` }, value: stnFirst.all, unit: "passeggeri al giorno" },
      { label: { it: "Posizione in Ticino", en: "Rank in Ticino" }, value: rankTI, unit: `su ${tiYear.length} stazioni` }],
    related: ["trasporti.spesa"] });
  stars.find((x) => x.id === "trasporti.ffs")!.detail = [
    { title: { it: "Stazione di Lugano: passeggeri al giorno, per anno", en: "Lugano station: passengers a day, by year" },
      chart: { type: "columns", unit: "passeggeri al giorno", color: TR, series: [{ label: { it: "Media su tutti i giorni", en: "Average over all days" },
        data: stn.map((r) => ({ key: `a${r.year}`, label: { it: String(r.year), en: String(r.year) }, value: r.all })) }] },
      note: { it: "Il set di dati FFS non ha gli anni dal 2019 al 2021.", en: "The SBB dataset has no figures for 2019 to 2021." },
      source: [src(SBB_FILE, `rows uic ${LUGANO_UIC}, column dtv_tjm_tgm, years ${stn.map((r) => r.year).join(", ")}`)] },
    { title: { it: `Le stazioni più frequentate del Ticino, ${stnLast.year}`, en: `Ticino's busiest stations, ${stnLast.year}` },
      chart: { type: "hbars", unit: "passeggeri al giorno", color: TR, caption: { it: `passeggeri al giorno · ${stnLast.year} · stazioni nell'elenco FFS`, en: `passengers a day · ${stnLast.year} · stations in the SBB list` },
        data: tiYear.slice(0, 8).map((r) => ({ key: String(r.uic), label: { it: r.name, en: r.name }, value: r.all })) },
      source: [src(SBB_FILE, `rows kt_ct_cantone = TI, year ${stnLast.year}, column dtv_tjm_tgm, top 8`)] },
  ];
  return { stars, relations, aviationNote };
}

export const TRASPORTI_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [SBB_FILE]: { url: SBB_URL, publisher: "FFS / SBB open data, Ein- und Aussteigende an Bahnhöfen" },
  ...(MOBILITY_FILE ? { [MOBILITY_FILE]: { url: `https://github.com/nslotus/dati-di-lugano/blob/${MOBILITY_PIN}/out/mobility.json`, publisher: "Dati di Lugano (TPL and PubliBike figures extracted from the releases)" } } : {}),
};
