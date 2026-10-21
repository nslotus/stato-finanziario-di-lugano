// Education, from structured sources (no model needed):
//   canton appendice 2024: spending by three-digit function 211 kindergarten, 212 primary, 217 school buildings (all 106)
//   USTAT age table 2024: residents aged 0–14 (all 106), via the municipality register
//   DECS 2024/25: public kindergarten and primary pupils and sections, Ticino total (context for class size)
// City school figures (pupils, classes, averages) come from Dati di Lugano's TypeSafe extraction (out/schools.json).

import { readFileSync } from "node:fs";
import { fail, norm, num, rawPath, sheet, type Row } from "./common";
import { matcher, type Municipality } from "./municipalities";
import { APPENDICE } from "./sel";

export const DECS_KG = "decs-B110-infanzia.xlsx";
export const DECS_PR = "decs-B210-elementari.xlsx";
export const DECS_YEAR = "2024-25";

const isRow = (r: Row) => typeof r[0] === "string" && !/^(totale|media|mediana|\[|\d|appendice|spese)/i.test(norm(r[0])) && r.slice(1).some((c) => num(c) !== null);

export function education(register: Municipality[]) {
  const match = matcher(register);
  const codes = ["211", "212", "213", "217", "218", "219"];
  const tabD = sheet(APPENDICE, "TabD"), tabA = sheet(APPENDICE, "TabA");
  const colD = Object.fromEntries(codes.map((c) => [c, tabD[1].findIndex((h) => String(h ?? "").trim() === c)]));
  const col21 = tabA[1].findIndex((h) => String(h ?? "").trim() === "21");
  if (Object.values(colD).some((i) => i < 0) || col21 < 0) fail("appendice: education codes not found");
  const total21 = new Map<number, number>();
  for (const r of tabA.slice(2)) if (isRow(r)) total21.set(match(r[0], "TabA").bfs, num(r[col21]) ?? 0);
  const spend = new Map<number, Record<string, number>>();
  for (const r of tabD.slice(2)) {
    if (!isRow(r)) continue;
    const m = match(r[0], "TabD"), v = Object.fromEntries(codes.map((c) => [c, num(r[colD[c]]) ?? 0]));
    // the three-digit lines must add up to 21 'Scuola dell'obbligo'
    const sum = codes.reduce((s, c) => s + v[c], 0);
    if (Math.abs(sum - (total21.get(m.bfs) ?? NaN)) > 1) fail(`${m.name}: 211–219 sum ${sum.toFixed(1)} != 21 ${total21.get(m.bfs)}`);
    spend.set(m.bfs, v);
  }
  if (spend.size !== 106) fail(`TabD education: ${spend.size} municipalities`);

  // Ticino public school averages, same school year as the city's 2024/25 figures
  const decsTotal = (file: string) => {
    const rows = sheet(file, DECS_YEAR);
    const hdr = rows.find((r) => r[0] === "Circondario") ?? fail(`${file}: header`);
    const iSez = hdr.indexOf("Sez."), tot = rows.find((r) => r[0] === "Totale") ?? fail(`${file}: Totale row`);
    const pupils = num(tot[tot.length - 1]) ?? fail(`${file}: total pupils`), sections = num(tot[iSez]) ?? fail(`${file}: sections`);
    // the districts must add up to the total
    const districts = rows.filter((r) => typeof r[0] === "string" && r[0] !== "Totale" && r[0] !== "Circondario" && num(r[iSez]) !== null);
    if (districts.reduce((s, r) => s + (num(r[r.length - 1]) ?? 0), 0) !== pupils) fail(`${file}: districts do not add up to the total`);
    return { pupils, sections, average: pupils / sections };
  };
  return { spend, ticinoKg: decsTotal(DECS_KG), ticinoPr: decsTotal(DECS_PR) };
}

/** City school figures, pinned from Dati di Lugano; every year must have passed its arithmetic checks. */
export function schools(file: string) {
  const j = JSON.parse(readFileSync(rawPath(file), "utf8")) as { results: { schoolYear: string; source: string;
    figures: Record<string, { value: number | null }>; checks: Record<string, boolean | null>; status: Record<string, string> }[] };
  for (const r of j.results) {
    for (const [k, ok] of Object.entries(r.checks)) if (ok !== true) fail(`schools ${r.schoolYear}: check ${k} did not pass`);
    for (const [k, st] of Object.entries(r.status)) if (st !== "accepted") fail(`schools ${r.schoolYear}: ${k} is "${st}"`);
  }
  return (year: string, key: string) => {
    const r = j.results.find((x) => x.schoolYear === year) ?? fail(`schools: no ${year}`);
    return { value: r.figures[key].value ?? fail(`schools ${year}: ${key} empty`), source: r.source };
  };
}
