// Canton of Ticino, Sezione degli enti locali: municipal accounts 2024 for all 106 municipalities.
//   allegato  tab8  population at 31.12.2024 (the divisor for every "per resident" value)
//             tab9e functional split, one digit: function 4 "Sanità" (gross spending)
//             tab12 financial indicators (finance hub stars)
//   appendice TabA  gross spending by two-digit function (41, 42, 43, 49)
//             TabD  gross spending by three-digit function (412, 421, 422, 431-433)
// All spending stars use GROSS spending ("Spese"), in CHF thousands in the source.

import { fail, norm, num, sheet, type Row } from "./common";
import { matcher, type Municipality } from "./municipalities";

export const ALLEGATO = "sel-2024-allegato.xlsx";
export const APPENDICE = "sel-2024-appendice.xlsx";

export interface SelRow { m: Municipality; population: number; values: Record<string, number> }

/** Columns keyed by the functional code at the start of the header cell. */
function byCode(rows: Row[], headerRow: number, codes: string[]) {
  const hdr = rows[headerRow].map((h) => String(h ?? "").split("\n")[0].trim());
  return Object.fromEntries(codes.map((c) => {
    const i = hdr.indexOf(c);
    if (i < 0) fail(`code ${c} not in header`);
    return [c, i];
  }));
}

export function sel(register: Municipality[]) {
  const match = matcher(register);
  const out = new Map<number, SelRow>();
  const isMunicipality = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d|appendice|spese)/i.test(norm(r[0])) &&
    r.slice(1).some((c) => num(c) !== null);

  // population (tab8): data rows have name in col 0 and population in col 1
  for (const r of sheet(ALLEGATO, "tab8").slice(3)) {
    if (!isMunicipality(r)) continue;
    const m = match(r[0], "tab8");
    out.set(m.bfs, { m, population: num(r[1]) ?? fail(`tab8 population for ${m.name}`), values: {} });
  }
  if (out.size !== 106) fail(`tab8: ${out.size} municipalities`);

  // function 4 total (tab9e): three rows per municipality (Spese / Ricavi / Spesa netta), name on the first
  const t9e = sheet(ALLEGATO, "tab9e");
  const f4 = t9e[1].findIndex((h) => /^4\b/.test(String(h ?? "")));
  if (f4 < 0) fail("tab9e: function 4 column not found");
  for (const r of t9e) if (r[0] === "Spese" && typeof r[1] === "string" && !/^totale/i.test(norm(r[1]))) {
    out.get(match(r[1], "tab9e").bfs)!.values["4"] = num(r[f4]) ?? fail(`tab9e f4 ${r[1]}`);
  }

  // two- and three-digit splits (appendice)
  const addCodes = (sheetName: string, codes: string[]) => {
    const rows = sheet(APPENDICE, sheetName);
    const cols = byCode(rows, 1, codes);
    for (const r of rows.slice(2)) {
      if (!isMunicipality(r)) continue;
      const row = out.get(match(r[0], `${APPENDICE}/${sheetName}`).bfs)!;
      for (const c of codes) row.values[c] = num(r[cols[c]]) ?? 0;
    }
  };
  addCodes("TabA", ["41", "42", "43", "49"]);
  addCodes("TabD", ["412", "421", "422", "431", "432", "433"]);

  // finance hub (tab12): net public debt I per resident
  const t12 = sheet(ALLEGATO, "tab12");
  const iDebt = t12[1].findIndex((h) => /procapite/i.test(String(h ?? "")));
  for (const r of t12.slice(2)) if (isMunicipality(r)) out.get(match(r[0], "tab12").bfs)!.values["debtPerResident"] = num(r[iDebt]) ?? NaN;

  // checks: every municipality complete; two-digit split adds up to the one-digit total
  for (const { m, values: v } of out.values()) {
    for (const k of ["4", "41", "42", "43", "49", "412", "421", "422"]) if (v[k] === undefined) fail(`${m.name}: missing ${k}`);
    const sum = v["41"] + v["42"] + v["43"] + v["49"];
    if (Math.abs(sum - v["4"]) > 1) fail(`${m.name}: 41+42+43+49 = ${sum.toFixed(1)} but function 4 = ${v["4"].toFixed(1)}`);
    if (Math.abs(v["421"] + v["422"] - v["42"]) > 1) fail(`${m.name}: 421+422 != 42`);
  }
  return [...out.values()];
}
