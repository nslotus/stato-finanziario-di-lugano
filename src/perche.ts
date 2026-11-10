// "Perché?": for every 2025 spending line whose actual is far from its budget, what the City says about it. The notes
// are written by hand in src/perche.json, from the City's own documents: a verbatim quote with its page, or, where the
// City gives no reason, the pages that were read. The build attaches each note to its line and stops if a line over
// the threshold has none, or a note belongs to a line under it; npm run verify (check 17) finds every quote on its page.

import { readFileSync } from "node:fs";
import type { Text } from "./catalog";

/** A gap of at least CHF 1 million, or at least 25% of the budget (a line with an actual and no budget counts). */
export const GAP = { mio: 1, pct: 25 };
export const needsWhy = (l: { p25: number; c25: number }) => {
  const d = l.c25 - l.p25;
  if (Math.abs(d) < 1e-9) return false;
  return Math.abs(d) >= GAP.mio || !l.p25 || Math.abs(d / l.p25) * 100 >= GAP.pct;
};

export type Quote = { file: string; page: number; it: string };
export type Why = { status: "quote" | "none_explained" | "not_found"; quotes: Quote[]; en: string; searched: Text; computed?: Text };

/** The notes, keyed "fn 710" or "org 2023". */
export const loadWhy = (): Record<string, Why> => JSON.parse(readFileSync("src/perche.json", "utf8")).lines;

/** Attaches each note to its line; every line over the threshold must have one, and no other line. */
export function attachWhy(view: "fn" | "org", lines: { code: string; p25: number; c25: number; why?: Why }[], notes: Record<string, Why>) {
  const used = new Set<string>(), bad: string[] = [];
  for (const l of lines) {
    const key = `${view} ${l.code}`, w = notes[key];
    if (needsWhy(l)) { if (w) { l.why = w; used.add(key); } else bad.push(`${key} has a gap of ${(l.c25 - l.p25).toFixed(3)} mio and no note`); }
    else if (w) bad.push(`${key} is under the threshold but has a note`);
  }
  for (const k of Object.keys(notes)) if (k.startsWith(`${view} `) && !used.has(k) && !bad.some((b) => b.startsWith(k))) bad.push(`${k}: no such line`);
  for (const [k, w] of Object.entries(notes)) {
    if (!k.startsWith(`${view} `)) continue;
    if (w.status === "quote" && !w.quotes.length) bad.push(`${k}: status quote without a quote`);
    if (w.quotes.length && !w.en) bad.push(`${k}: quote without an English translation`);
    if (!w.searched?.it || !w.searched?.en) bad.push(`${k}: the pages read are missing`);
  }
  if (bad.length) throw new Error(`perche.json: ${bad.join("; ")}`);
  return used.size;
}

// "cantonale": lines whose amount the Canton sets or calculates (src/cantonale.json). A group of lines is tagged only
// when its cited accounts make up at least 90% of the lines' 2025 actual (and no more than all of it)
export type Cant = { lines: string[]; accounts: { name: string; chf: number; file: string; page: number }[]; basis: Text; quotes: Quote[]; share?: number };
export function attachCant(lines: { code: string; c25: number; cant?: Cant }[]) {
  const groups: Cant[] = JSON.parse(readFileSync("src/cantonale.json", "utf8")).groups;
  for (const g of groups) {
    const ls = g.lines.map((c) => lines.find((l) => l.code === c) ?? (() => { throw new Error(`cantonale.json: no line ${c}`); })());
    const spent = ls.reduce((t, l) => t + l.c25 * 1e6, 0), cited = g.accounts.reduce((t, a) => t + a.chf, 0), share = cited / spent;
    if (share < 0.9 || share > 1.0001) throw new Error(`cantonale.json: lines ${g.lines.join("+")}: the cited accounts are ${(share * 100).toFixed(1)}% of the lines' actual`);
    for (const l of ls) l.cant = { ...g, share };
  }
  return groups.length;
}
