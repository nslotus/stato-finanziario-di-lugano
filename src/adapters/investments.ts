// The investment register in the 2025 accounts (Consuntivo 2025, "Situazione investimenti amministrativi 2025",
// pp. 385–413): one row per open work with its code, Council resolution date(s) and credit(s), updated credit,
// progress (Sit. Lav. %), and outgoings and income at 31.12.2024, in 2025 and at 31.12.2025. Read by position: the
// amounts are right-aligned, so each one goes to the column whose header it ends under (the header's right edge,
// found on every page, since the Municipio pages sit further right than the Council pages). The two patrimonial works
// (p. 415) are printed sideways and are left out.
// Checks that stop the build: every work's 31.12.2024 + 2025 = 31.12.2025 (outgoings and income, to the centime), and
// the works under every printed total (category, group, section) add up to it in all six columns.

import { fail } from "./common";
import type { Item } from "./pdf";

export const REGISTER_PAGES = { from: 385, to: 413 };
export type Section = "council" | "municipio";
export type Work = {
  code: string; section: Section; group: string; category: string; name: string; liquidation: boolean;
  resolutions: { date: string; credit: number }[]; credit: number; progress: number | null;
  out24: number; in24: number; out25m: number; in25m: number; out25: number; in25: number; page: number;
};
type Total = { section: Section; label: string; level: "section" | "group" | "category"; v: number[]; page: number };

const money = (s: string) => Number(s.replace(/['’]/g, ""));
const MONEY = /^-?\d{1,3}(?:['’]\d{3})*(?:\.\d\d)?$/;
const DATE = /^\d\d\.\d\d\.\d{4}$/;
const AMOUNTS = ["out24", "in24", "out25m", "in25m", "out25", "in25"] as const;

/** Lines of a page: items within 2 points of height belong to the same line. */
function lines(its: Item[]) {
  const sorted = [...its].sort((a, b) => b.y - a.y);
  const out: Item[][] = [];
  for (const it of sorted) {
    const last = out.at(-1);
    if (last && Math.abs(last[0].y - it.y) <= 2) last.push(it); else out.push([it]);
  }
  return out.map((l) => l.sort((a, b) => a.x - b.x));
}

export async function investmentRegister(read: (file: string, pages: number[]) => Promise<{ items: Item[][] }>, file: string) {
  const pages = Array.from({ length: REGISTER_PAGES.to - REGISTER_PAGES.from + 1 }, (_, i) => REGISTER_PAGES.from + i);
  const { items } = await read(file, pages);
  const works: Work[] = [], totals: Total[] = [];
  let section: Section | null = null, group = "", category = "", cur: Work | null = null;
  for (const p of pages) {
    const its = items[p - 1] ?? [];
    const head = its.find((i) => /SITUAZIONE INVESTIMENTI AMMINISTRATIVI 2025/.test(i.s))?.s;
    if (!head) continue; // blank back pages
    section = /CONSIGLIO COMUNALE/.test(head) ? "council" : /COMPETENZA DEL MUNICIPIO/.test(head) ? "municipio" : fail(`register p. ${p}: unknown section`);
    // column anchors from the header: right edges of Uscite/Entrate ×3, "Credito" (first), "Aggiornato", "%"
    const ue = its.filter((i) => i.s === "Uscite" || i.s === "Entrate").sort((a, b) => a.x - b.x);
    const credH = its.filter((i) => i.s === "Credito").sort((a, b) => a.x - b.x)[0];
    const aggH = its.find((i) => i.s === "Aggiornato"), pctH = its.find((i) => i.s === "%");
    if (ue.length !== 6 || !credH || !aggH || !pctH) fail(`register p. ${p}: header columns not found`);
    const anchors: [string, number][] = [["credit", credH.x + credH.w], ["credAgg", aggH.x + aggH.w], ["prog", pctH.x + pctH.w],
      ...ue.map((u, k): [string, number] => [AMOUNTS[k], u.x + u.w])];
    const nameFrom = credH.x + credH.w + 3, nameTo = aggH.x - 8;
    const headerBottom = Math.min(...ue.map((u) => u.y)) - 2;
    const colOf = (it: Item) => {
      const right = it.x + it.w;
      return anchors.reduce((best, a) => (Math.abs(a[1] - right) < Math.abs(best[1] - right) ? a : best))[0];
    };
    for (const l of lines(its.filter((i) => i.y < headerBottom && i.y > 30))) {
      const code = l.find((i) => /^INV\.\d{6}$/.test(i.s));
      const text = l.filter((i) => i.x >= nameFrom && i.x < nameTo && !MONEY.test(i.s) && !DATE.test(i.s)).map((i) => i.s).join(" ").trim();
      const cells: Record<string, string[]> = {};
      for (const i of l) if (MONEY.test(i.s) || /^\d+\s?%$/.test(i.s)) (cells[colOf(i)] ??= []).push(i.s);
      const one = (k: string) => { const v = cells[k] ?? []; if (v.length > 1) fail(`register p. ${p}: two values in column ${k}: ${v.join(", ")}`); return v[0]; };
      const amounts = AMOUNTS.map((k) => one(k));
      const date = l.find((i) => DATE.test(i.s))?.s;
      if (code) {
        if (amounts.some((v) => v === undefined)) fail(`register p. ${p}: ${code.s} is missing amounts ${JSON.stringify(amounts)}`);
        const prog = one("prog")?.replace(/\s/g, "");
        cur = { code: code.s, section, group, category, name: text, liquidation: l.some((i) => i.s === "*"),
          resolutions: date ? [{ date, credit: money(one("credit") ?? "0") }] : [],
          credit: money(one("credAgg") ?? fail(`register p. ${p}: ${code.s} has no updated credit`)), progress: prog ? Number(prog.replace("%", "")) : null,
          out24: money(amounts[0]!), in24: money(amounts[1]!), out25m: money(amounts[2]!), in25m: money(amounts[3]!), out25: money(amounts[4]!), in25: money(amounts[5]!), page: p };
        works.push(cur);
      } else if (amounts.every((v) => v !== undefined) && text && !date) {
        const level = /^INVESTIMENTI IN BENI/.test(text) ? "section" : text === text.toUpperCase() ? "group" : "category";
        if (level === "group") group = text;
        if (level === "category") category = text;
        totals.push({ section, label: text, level, v: amounts.map((v) => money(v!)), page: p });
        cur = null;
      } else if (cur && date && one("credit")) {
        cur.resolutions.push({ date, credit: money(one("credit")!) });
        if (text) cur.name = `${cur.name} ${text}`.trim();
      } else if (cur && text && !Object.keys(cells).length) {
        cur.name = `${cur.name} ${text}`.trim();
      } else if (l.some((i) => MONEY.test(i.s) || DATE.test(i.s))) {
        fail(`register p. ${p}: unplaced line ${l.map((i) => i.s).join(" | ")}`);
      }
    }
  }
  // each work: 31.12.2024 + 2025 = 31.12.2025, outgoings and income
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005;
  for (const w of works) {
    if (!near(w.out24 + w.out25m, w.out25) || !near(w.in24 + w.in25m, w.in25)) fail(`register ${w.code} (p. ${w.page}): 31.12.2024 + 2025 does not give 31.12.2025`);
    if (!w.name) fail(`register ${w.code} (p. ${w.page}): no name`);
  }
  // every printed total = the works under it, in all six columns. One known printing pattern: on the Municipio pages
  // every group and category total repeats its "Uscite al 31.12.2024" in "Entrate al 31.12.2024", which its own row
  // then contradicts (Entrate 2024 + 2025 ≠ Entrate 2025); the works and the Municipio's section total agree with each
  // other. Only that exact pattern is accepted, with the other five columns checked; anything else stops the build.
  const sum = (ws: Work[]) => AMOUNTS.map((k) => ws.reduce((t, w) => t + w[k], 0));
  const asPrinted: string[] = [];
  for (const t of totals) {
    const under = works.filter((w) => w.section === t.section && (t.level === "section" || (t.level === "group" ? w.group === t.label : w.category === t.label)));
    const s = sum(under);
    const bad = s.map((v, k) => !near(v, t.v[k]));
    const copied = t.section === "municipio" && t.level !== "section" && bad[1] && !bad.some((b, k) => b && k !== 1)
      && near(t.v[1], t.v[0]) && !near(t.v[1] + t.v[3], t.v[5]);
    if (copied) { asPrinted.push(`p. ${t.page} '${t.label}'`); continue; }
    if (!under.length || bad.some(Boolean)) fail(`register p. ${t.page}: works under '${t.label}' (${t.section}) add up to ${s.map((v) => v.toFixed(2)).join(" / ")}, printed ${t.v.join(" / ")}`);
  }
  if (!totals.some((t) => t.level === "section" && t.section === "council") || !totals.some((t) => t.level === "section" && t.section === "municipio")) fail("register: a section total is missing");
  return { works, totals, asPrinted };
}
