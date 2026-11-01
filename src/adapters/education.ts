// Education, from structured sources (no model needed):
//   canton appendice 2024: spending by three-digit function 211 kindergarten, 212 primary, 217 school buildings (all 106)
//   USTAT age table 2024: residents aged 0–14 (all 106), via the municipality register
//   DECS 2024/25: public kindergarten and primary pupils and sections, Ticino total (context for class size)
// City school figures (pupils, classes, averages) come from Dati di Lugano's TypeSafe extraction (out/schools.json).

import { readFileSync } from "node:fs";
import { fail, norm, num, rawPath, sheet, type Row } from "./common";
import type { Item } from "./pdf";
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

/**
 * The City's per-site table for the 2025/26 school year (published with the school-start release of 3 September 2025):
 * pupils and sections at each kindergarten and primary site, grouped in five school zones. Read by position: the
 * kindergarten table is the left half of the page, the primary table the right half; a few rows print their numbers
 * glued to the name ("81Pazzallo"), and rows of the two halves sit at slightly different heights, so each half is read
 * on its own. Every site row must add up to its zone's printed total, every zone to the institute's printed total.
 */
export const SCHOOL_SITES = "20250903-cs-inizio-anno-scolastico-2025-2026-tabella.pdf";
export type Site = { name: string; sections: number; pupils: number };
export type Zone = { zone: string; sections: number; pupils: number; sites: Site[] };
export type Level = { sections: number; pupils: number; zones: Zone[] };

export async function schoolSites(read: (file: string, pages: number[]) => Promise<{ items: Item[][] }>) {
  const { items } = await read(SCHOOL_SITES, [1]);
  const page = items[0] ?? fail(`${SCHOOL_SITES}: no page 1`);
  const NUM = /^\d[\d’']*$/, toN = (s: string) => Number(s.replace(/[’']/g, ""));
  // split "81Pazzallo" into its number and its name, keeping the left edge for each
  const toks = page.flatMap((it) => {
    const m = it.s.match(/^(\d[\d’']*)(\p{L}.*)$/u);
    return m ? [{ x: it.x, y: it.y, s: m[1] }, { x: it.x + 1, y: it.y, s: m[2] }] : [{ x: it.x, y: it.y, s: it.s }];
  });
  const head = page.filter((it) => it.s === "ISTITUTO:");
  if (head.length !== 2) fail(`${SCHOOL_SITES}: expected two 'ISTITUTO:' headings, found ${head.length}`);
  const split = Math.max(...head.map((h) => h.x)) - 5;
  const level = (left: boolean): Level => {
    const half = toks.filter((t) => (t.x < split) === left);
    const ys = [...new Set(half.map((t) => Math.round(t.y)))].sort((a, b) => b - a);
    let inst: { sections: number; pupils: number } | null = null, cur: Zone | null = null;
    const zones: Zone[] = [];
    for (const y of ys) {
      const row = half.filter((t) => Math.round(t.y) === y).sort((a, b) => a.x - b.x);
      const words = row.filter((t) => !NUM.test(t.s)).map((t) => t.s).join(" ").trim();
      const nums = row.filter((t) => NUM.test(t.s)).map((t) => toN(t.s));
      const hd = words.match(/^([\p{Lu} ]+):/u);
      if (hd) { cur = hd[1].trim() === "ISTITUTO" ? null : { zone: hd[1].trim(), sections: NaN, pupils: NaN, sites: [] }; if (cur) zones.push(cur); continue; }
      if (!nums.length) continue;
      if (nums.length !== 2 || !words) fail(`${SCHOOL_SITES}: row '${words}' has ${nums.length} numbers`);
      const [sections, pupils] = nums;
      if (words === "Totale") { if (cur) { cur.sections = sections; cur.pupils = pupils; } else inst = { sections, pupils }; continue; }
      if (!cur) fail(`${SCHOOL_SITES}: site row '${words}' outside a school zone`);
      cur.sites.push({ name: words, sections, pupils });
    }
    const merged = zones;
    if (!inst) fail(`${SCHOOL_SITES}: no institute total (${left ? "left" : "right"} half)`);
    for (const z of merged) {
      if (Number.isNaN(z.sections) || !z.sites.length) fail(`${SCHOOL_SITES}: zone ${z.zone} has no total or no sites`);
      const s = z.sites.reduce((t, q) => t + q.sections, 0), p = z.sites.reduce((t, q) => t + q.pupils, 0);
      if (s !== z.sections || p !== z.pupils) fail(`${SCHOOL_SITES}: ${z.zone} sites add up to ${s}/${p}, printed ${z.sections}/${z.pupils}`);
    }
    const s = merged.reduce((t, z) => t + z.sections, 0), p = merged.reduce((t, z) => t + z.pupils, 0);
    if (s !== inst.sections || p !== inst.pupils) fail(`${SCHOOL_SITES}: zones add up to ${s}/${p}, institute total ${inst.sections}/${inst.pupils}`);
    if (merged.length !== 5) fail(`${SCHOOL_SITES}: ${merged.length} school zones, expected 5`);
    return { ...inst, zones: merged };
  };
  return { kindergarten: level(true), primary: level(false) };
}
