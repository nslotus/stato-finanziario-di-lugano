// Per-taxpayer star: federal direct tax per taxpayer (individuals), fiscal year 2022, ranked within Ticino.
// Source: ESTV "Direkte Bundessteuer – natürliche Personen – Gemeinden", Steuerjahr 2022 (latest published),
//   Steuerpflichtige mit und ohne Belastung, Normalfälle (sheets 511 count, 513 yield) + Übrige Sonderfälle (611, 613).
// The per-resident stars divide by residents; this one divides by taxpayers. A married couple files one return
// and counts as one taxpayer. 2022 municipalities: Maroggia, Melano and Rovio are summed into Val Mara (5240).

import { compare, type Source, type Star } from "./catalog";
import { fail, num, sheet } from "./adapters/common";
import { AGE_FILE, type Municipality } from "./adapters/municipalities";

export const ESTV_NORMAL = "estv-dbst-np-gden-2022-normalfall.xlsx";
export const ESTV_SPECIAL = "estv-dbst-np-gden-2022-sonderfall.xlsx";
const TI = 21, TOTAL_COL = 14;
// merged after the 2022 tax period: old BFS number → 2024 municipality
const MERGED: Record<number, number> = { 5195: 5240, 5197: 5240, 5219: 5240 };

type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 0) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Ticino rows of one ESTV sheet: BFS number → Total column. */
function tiTotals(file: string, tab: string, register: Municipality[]) {
  const rows = sheet(file, tab);
  const head = rows.find((r) => String(r[TOTAL_COL] ?? "").startsWith("Total")) ?? fail(`${file} ${tab}: header not found`);
  if (!String(head[3]).startsWith("Gemeinde")) fail(`${file} ${tab}: unexpected header`);
  const start = rows.findIndex((r) => r[0] === TI);
  if (start < 0) fail(`${file} ${tab}: Ticino not found`);
  const known = new Set(register.map((m) => m.bfs)), out = new Map<number, number>();
  let canton = NaN;
  for (const r of rows.slice(start)) {
    if (r[0] !== TI && r[0] !== "" && r[0] !== undefined) break; // next canton
    const bfs = Number(r[2]), v = num(r[TOTAL_COL]);
    if (bfs === 10000) { canton = v ?? NaN; break; }
    if (v === null) fail(`${file} ${tab}: suppressed total for ${r[3]}`);
    const to = MERGED[bfs] ?? bfs;
    if (!known.has(to)) fail(`${file} ${tab}: ${bfs} ${r[3]} matches no 2024 municipality`);
    out.set(to, (out.get(to) ?? 0) + v!);
  }
  if (out.size !== 106) fail(`${file} ${tab}: ${out.size} municipalities after merging`);
  const sum = [...out.values()].reduce((s, x) => s + x, 0);
  // ESTV: totals can exceed the sum of rows (cases not assigned to a municipality, privacy); allow up to 2% (2022 special cases: 38 taxpayers, 1.0% of yield)
  if (sum > canton + 1 || canton - sum > canton * 0.02) fail(`${file} ${tab}: municipalities sum ${sum} vs Ticino total ${canton}`);
  if (canton - sum > 1) console.log(`  note: ${file} ${tab}: municipalities sum ${n(sum)} = Ticino total ${n(canton)} minus ${n(canton - sum)}`);
  return out;
}

function population2022(bfs: number) {
  const rows = sheet(AGE_FILE, "2022");
  const head = rows.find((r) => r.includes("Totale")) ?? fail("2022 age header not found");
  const r = rows.find((r) => String(r[0] ?? "").startsWith(`${bfs} `)) ?? fail(`2022 population: ${bfs} missing`);
  return num(r[head.indexOf("Totale")]) ?? fail("2022 population empty");
}

export function contribuenti(register: Municipality[], src: Src): Star {
  const cN = tiTotals(ESTV_NORMAL, "511", register), yN = tiTotals(ESTV_NORMAL, "513", register);
  const cS = tiTotals(ESTV_SPECIAL, "611", register), yS = tiTotals(ESTV_SPECIAL, "613", register);
  const name = new Map(register.map((m) => [m.bfs, m]));
  const cmp = compare(register.map((m) => {
    const c = cN.get(m.bfs)! + cS.get(m.bfs)!, y = yN.get(m.bfs)! + yS.get(m.bfs)!;
    return { bfs: m.bfs, name: name.get(m.bfs)!.name, value: y / c, population: m.population };
  }), "CHF / contribuente", "highest-first");
  const L = 5192, count = cN.get(L)! + cS.get(L)!, yieldL = yN.get(L)! + yS.get(L)!, pop22 = population2022(L);
  const specialShare = (yS.get(L)! / yieldL) * 100;
  if (Math.abs(yieldL / count - cmp.lugano.value) > 1e-6) fail("contribuenti: Lugano value mismatch");
  return {
    id: "finanze.contribuente", constellation: "finanze",
    label: { it: "Imposta federale per contribuente", en: "Federal tax per taxpayer" },
    about: {
      it: `Imposta federale diretta pagata in media da ogni contribuente (persona fisica) di Lugano nel 2022, l'ultimo anno pubblicato. I contribuenti sono ${n(count)}, cioè ${n((count / pop22) * 100, 0)} ogni 100 abitanti: una coppia sposata presenta una sola dichiarazione e conta come un contribuente. I casi speciali (${n(cS.get(L)!)} contribuenti) versano il ${n(specialShare, 0)}% dell'imposta. È l'imposta federale, non quella comunale: la statistica federale è quella che conta i contribuenti di ogni comune.`,
      en: `Federal direct tax paid on average by each taxpayer (individuals) in Lugano in 2022, the latest year published. There are ${n(count)} taxpayers, ${n((count / pop22) * 100, 0)} for every 100 residents: a married couple files one return and counts as one taxpayer. Special cases (${n(cS.get(L)!)} taxpayers) pay ${n(specialShare, 0)}% of the tax. This is the federal tax, not the municipal one: the federal statistics are the ones that count taxpayers in every municipality.`,
    },
    value: cmp.lugano.value, unit: "CHF / contribuente", year: 2022, area: "Lugano", kind: "derived",
    method: {
      it: "Gettito dell'imposta federale diretta delle persone fisiche diviso per il numero di contribuenti, casi normali e casi speciali insieme, con e senza imposta dovuta. Maroggia, Melano e Rovio sono sommati in Val Mara.",
      en: "Federal direct tax yield from individuals divided by the number of taxpayers, normal and special cases together, with and without tax due. Maroggia, Melano and Rovio are added together as Val Mara.",
    },
    source: [
      src(ESTV_NORMAL, "Steuerjahr 2022, Normalfälle: sheet 511 (Anzahl steuerpflichtige Personen) and 513 (Steuerertrag), column Total, Ticino rows"),
      src(ESTV_SPECIAL, "Steuerjahr 2022, Übrige Sonderfälle: sheet 611 (Anzahl) and 613 (Steuerertrag), column Total, Ticino rows"),
      src(AGE_FILE, "sheet 2022, row '5192 Lugano', column Totale (residents per 100, in the text only)"),
    ],
    context: [
      { label: { it: "Contribuenti", en: "Taxpayers" }, value: count, unit: "contribuenti" },
      { label: { it: "Abitanti (fine 2022)", en: "Residents (end of 2022)" }, value: pop22, unit: "abitanti" },
    ],
    comparison: cmp,
    related: ["finanze.imposte-pf"],
  };
}

export const CONTRIBUENTI_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [ESTV_NORMAL]: { url: "https://www.estv.admin.ch/dam/de/sd-web/wum7OKVNOOwl/statistik-dbst-np-gden-2022-normalfall.xlsx", publisher: "Amministrazione federale delle contribuzioni (ESTV)" },
  [ESTV_SPECIAL]: { url: "https://www.estv.admin.ch/dam/de/sd-web/n8d5HdPSEkzk/statistik-dbst-np-gden-2022-sonderfall.xlsx", publisher: "Amministrazione federale delle contribuzioni (ESTV)" },
};
