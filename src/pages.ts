// The checks that compare the page's data with the printed pages of the archived PDFs (npm run verify, checks 8, 13, 14
// and 15). They do not use the build's readers or its position rules:
//   - pdf.js (the reader the build also uses) for checks 8, 13 and 14, with methods of their own: a value is found by the
//     row's code and the column's heading, or by the City's own arithmetic printed on the same row;
//   - pypdf, a separate implementation in Python (src/pdftext.py), for check 15, which repeats checks 8 and 13 without
//     any column positions, so that a fault in pdf.js cannot hide itself.

import { execFileSync } from "node:child_process";
import { readPdf, type Item } from "./adapters/pdf";

type Page = { text: string; items: Item[] };
export type Reader = { name: string; read: (file: string, pages?: number[]) => Promise<Record<number, Page>> };
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const CENT = 0.015;                                   // two amounts printed to the centime: equal within rounding
const FRANC = 0.006;                                  // a value in CHF million against francs printed to the centime: equal

// ---------- readers ----------
export const pdfjs: Reader = {
  name: "pdf.js",
  async read(file, pages) {
    const r = await readPdf(file, pages);
    const out: Record<number, Page> = {};
    r.pages.forEach((text, i) => { if (text != null) out[i + 1] = { text, items: r.items[i] ?? [] }; });
    return out;
  },
};
let python: string | null = null;
/** The Python that can import pypdf, or a clear failure. */
function pythonWithPypdf() {
  if (python) return python;
  for (const cmd of ["python3", "python"]) {
    try { execFileSync(cmd, ["-c", "import pypdf"], { stdio: "ignore" }); return (python = cmd); } catch { /* next */ }
  }
  throw new Error("check 15 needs Python 3 with pypdf: pip install -r requirements-verify.txt");
}
const pyCache = new Map<string, Record<number, Page>>();
export const pypdf: Reader = {
  name: "pypdf",
  async read(file, pages) {
    const key = `${file}|${pages?.join(",") ?? "all"}`;
    if (pyCache.has(key)) return pyCache.get(key)!;
    const raw = JSON.parse(execFileSync(pythonWithPypdf(), ["src/pdftext.py", `sources/${file}`, (pages ?? []).join(",")], { maxBuffer: 256 << 20 }).toString());
    const out: Record<number, Page> = {};
    for (const [p, v] of Object.entries<any>(raw)) out[+p] = { text: v.text, items: v.runs.map(([x, y, s]: [number, number, string]) => ({ s, x, y, w: 0, sp: false })) };
    pyCache.set(key, out);
    return out;
  },
};

// ---------- reading rows and amounts ----------
type Row = { y: number; x: number; text: string; items: Item[] };
/** Pieces on the same line (within 2.5 points), left to right. */
export function rows(items: Item[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y), groups: Item[][] = [];
  for (const it of sorted) { const g = groups[groups.length - 1]; if (g && Math.abs(g[0].y - it.y) < 2.5) g.push(it); else groups.push([it]); }
  return groups.map((g) => { g.sort((a, b) => a.x - b.x); return { y: g[0].y, x: g[0].x, text: g.map((i) => i.s).join(" "), items: g }; });
}
/**
 * Amounts after a row's leading code and name, in order. Every amount ends in two decimals, so the separators and the
 * spaces a PDF puts inside a number ("1 401 5 39.80", "21’232’6 98.79") are dropped and the run is cut after each ".dd".
 * A balance printed as "-" is zero (a page number may follow it).
 */
export function amounts(text: string, lead: string) {
  const rest = text.slice(lead.length);
  let s = "";
  for (const m of rest.matchAll(/(?:^|\s)(-?\s?\d)/g)) {
    const from = m.index! + m[0].length - m[1].length;
    const cand = rest.slice(from).replace(/[’']/g, "").replace(/\s+/g, "");
    if (/^-?\d+\.\d{2}/.test(cand)) { s = cand; break; }
  }
  const found = [...s.matchAll(/-?\d+\.\d{2}/g)], n = found.map((m) => Number(m[0]));
  const last = found[found.length - 1], tail = last ? s.slice(last.index! + last[0].length) : "";
  if (tail !== "" && /^-\d{0,4}$/.test(tail)) n.push(0);
  return n;
}
/** Costs in a row of COSTI | RICAVI | SALDO, from the row's own arithmetic (balance = revenue − costs). */
function costsOf(n: number[]) {
  if (n.length === 0) return 0;                       // a row printed without any amount
  if (n.length >= 3 && close(n[2], n[1] - n[0], CENT)) return n[0];
  if (n.length === 2 && close(n[1], -n[0], CENT)) return n[0];
  if (n.length === 2 && close(n[1], n[0], CENT)) return 0;
  return NaN;
}
/** Francs written in pieces ("44 172 0", "20.96" -> 44172020.96). */
const francs = (parts: string[]) => { const t = parts.join("").replace(/[\s'’]/g, ""); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };

// ---------- check 8 and the first part of check 15: figures printed on their cited pages ----------
/** A value as it may be printed: in its unit, in thousands or in francs, with any thousands separator. */
export function forms(v0: number, unit: string) {
  const out = new Set<string>();
  const scales = /^mio CHF/.test(unit) ? [1, 1e3, 1e6] : [1];
  for (const sc of scales) for (const d of [0, 1, 2]) {
    const v = v0 * sc;
    if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) > 1e-6 * sc) continue;
    const [i, f] = Math.abs(v).toFixed(d).split(".");
    for (const sep of ["'", "’", ".", " ", ""]) {
      const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      out.add(f ? `${g}.${f}` : g); if (f) out.add(`${g},${f}`);
    }
    // English documents group thousands with a comma ("CHF 5,000,000")
    const gc = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (gc !== i) out.add(f ? `${gc}.${f}` : gc);
  }
  return [...out].filter((x) => x.replace(/\D/g, "").length >= 2);
}
/** The pages a locator cites: "p. 38", "PDF pp. 65–66", "p. 5–6"; none means the whole document. */
export function pagesOf(locator = "") {
  const m = locator.match(/^(?:PDF )?pp?\.\s?(\d+)(?:\s?[–-]\s?(\d+))?/);
  if (!m) return null;
  const a = +m[1], b = m[2] ? +m[2] : a;
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
export async function figuresPrinted(reader: Reader, stars: any[]) {
  const onPage = (pg: Page, x: string[]) => {
    const text = pg.text.replace(/\s+/g, " ");
    // chart labels are sometimes laid out with spaces inside a number ("1' 7 74"): compare each piece without spaces too
    const pieces = new Set(pg.items.map((i) => i.s.replace(/\s/g, "")));
    // a whole number, not part of another: "675" is not found in "1'675" or "16'750"
    const whole = (f: string) => {
      for (let i = text.indexOf(f); i >= 0; i = text.indexOf(f, i + 1)) {
        const before = text[i - 1] ?? " ", after = text.slice(i + f.length, i + f.length + 2);
        if (!/[\d’'.,]/.test(before) && !/^\d/.test(after) && !/^[’'.,]\d/.test(after)) return true;
      }
      return false;
    };
    return x.some((f) => pieces.has(f) || whole(f));
  };
  const read = async (file: string, pages: number[] | null) => Object.values(await reader.read(file.replace(/^sources\//, ""), pages ?? undefined));
  let one = 0, range = 0, sum = 0; const missed: string[] = [];
  for (const s of stars) {
    const src = s.source[0];
    if (s.kind !== "official" || !/\.pdf$/.test(src.file)) continue;
    const pages = pagesOf(src.locator);
    if ((await read(src.file, pages)).some((pg) => onPage(pg, forms(s.value, s.unit)))) { if (pages?.length === 1) one++; else range++; continue; }
    // a total that the document does not print: the sum of a series of the record, each part printed on a cited page
    const cited = await Promise.all(s.source.filter((x: any) => /\.pdf$/.test(x.file)).map((x: any) => read(x.file, pagesOf(x.locator))));
    const all = cited.flat();
    const series = (s.detail ?? []).flatMap((d: any) => (d.chart?.series ?? (d.chart?.data ? [{ data: d.chart.data }] : [])).map((x: any) => x.data.map((p: any) => p.value)));
    const ok = series.some((vs: number[]) => close(vs.reduce((t, v) => t + v, 0), s.value, 1e-6 * Math.max(1, Math.abs(s.value)))
      && vs.every((v) => v === 0 || all.some((pg) => onPage(pg, forms(v, s.unit)))));
    if (ok) sum++; else missed.push(`${s.id} (${s.value} ${s.unit}, ${src.file} ${src.locator?.slice(0, 40) ?? ""})`);
  }
  return { one, range, sum, missed };
}

// ---------- check 13 and the second part of check 15: the table of 2025 spending by function ----------
const FUNCTIONAL = [
  { file: "city-preventivo-2025-messaggio.pdf", key: "p25", page: "pagesP", what: "budget" },
  { file: "city-consuntivo-2025-messaggio.pdf", key: "c25", page: "pagesC", what: "actual" },
] as const;
type Unit = { code: string; label: string; value: number; page?: number; total?: boolean };
function functionalUnits(D: any, key: "p25" | "c25", page: "pagesP" | "pagesC"): Unit[] {
  const lines = D.lines.map((l: any) => ({ code: l.code, label: l.label, value: l[key], page: l[page] }));
  const groups = D.groups.filter((g: any) => !D.lines.some((l: any) => l.code === g.code)).map((g: any) => ({ code: g.code, label: g.label, value: g[key] }));
  const fns = D.fns.map((f: any) => ({ code: f.code, label: f.name.it, value: f[key] }));
  const total = { code: "TOTALE", label: "Città di Lugano", value: D.fns.reduce((t: number, f: any) => t + f[key], 0), total: true };
  return [...lines, ...groups, ...fns, total];
}
/**
 * Every line, group and function of the table, and the City's total, in both messages: the value in the COSTI column,
 * found by its heading (pdf.js) or by the row's arithmetic (any reader). A unit printed more than once must read the same.
 */
export async function functionalTable(reader: Reader, D: any, byColumn: boolean) {
  const bad: string[] = [], pages: Record<string, Set<number>> = {};
  let k = 0;
  for (const d of FUNCTIONAL) {
    const tablePages = [...new Set<number>(D.lines.map((l: any) => l[d.page]))].sort((a, b) => a - b);
    const doc = await reader.read(d.file, tablePages);
    pages[d.what] = new Set();
    for (const u of functionalUnits(D, d.key, d.page)) {
      const printed: number[] = [];
      for (const p of u.page ? [u.page] : tablePages) {
        const pg = doc[p]; if (!pg) continue;
        if (byColumn) {
          const head = (s: string) => pg.items.find((i) => i.s === s) ?? null;
          const costs = head("COSTI"), revenue = head("RICAVI");
          if (!costs || !revenue) { bad.push(`${d.file} p. ${p}: no COSTI/RICAVI heading`); continue; }
          const edge = (costs.x + revenue.x) / 2;
          const starts = pg.items.filter((i) => (u.total ? /TOTALE/.test(i.s) : i.s === u.code || i.s.startsWith(`${u.code} `)) && i.x < costs.x / 2);
          for (const r of starts) {
            const cells = pg.items.filter((i) => Math.abs(i.y - r.y) < 2.5 && i.x > r.x && i.x >= costs.x - 30 && i.x < edge).sort((a, b) => a.x - b.x);
            printed.push(cells.length ? francs(cells.map((i) => i.s)) : 0);
          }
        } else {
          for (const r of rows(pg.items)) {
            if (r.x >= 160) continue;
            const lead = u.total ? (r.text.match(/^.*?TOTALE/)?.[0] ?? null) : r.text === u.code || r.text.startsWith(`${u.code} `) ? u.code : null;
            if (lead != null) printed.push(costsOf(amounts(r.text, lead)));
          }
        }
        if (printed.length) pages[d.what].add(p);
      }
      if (!printed.length) bad.push(`${u.code} ${d.what}: no row with this code`);
      else if (!printed.every((v) => close(v, u.value * 1e6, FRANC))) bad.push(`${u.code} ${d.what}: ${u.value} mio, printed ${printed.join(" / ")}`);
      else k++;
    }
  }
  const span = (s: Set<number>) => { const v = [...s].sort((a, b) => a - b); return v.length > 1 ? `${v[0]}–${v[v.length - 1]}` : `${v[0]}`; };
  return { k, bad, detail: `budget pp. ${span(pages.budget)}, actual pp. ${span(pages.actual)}` };
}

// ---------- check 14: the departments, divisions and cost centres in the 2025 accounts ----------
const ACCOUNTS = "city-consuntivo-2025-messaggio.pdf";
/**
 * A unit's row "3" (SPESE): actual 2025 | budget 2025 | difference | % | actual 2024 | difference | %, any of them may be
 * empty. The amounts come in order; the columns they belong to are the choices that satisfy the row's arithmetic. When
 * a row's two differences do not recompute, only the percentages are required, and the row is reported.
 */
function readings(n: number[]) {
  const pick = (k: number, from: number, acc: number[]): number[][] => (k === 0 ? [acc] : from > 6 ? [] : [...pick(k - 1, from + 1, [...acc, from]), ...pick(k, from + 1, acc)]);
  const pct = (d: number, base: number, pr: number) => base === 0 || Math.abs((d / base) * 100 - pr) <= 0.006;
  for (const relax of [false, true]) {
    const fits: { c: number; p: number; note?: string }[] = [];
    for (const idx of pick(Math.min(n.length, 7), 0, [])) {
      const v = [0, 0, 0, 0, 0, 0, 0]; idx.forEach((slot, i) => (v[slot] = n[i]));
      const [c, p, d1, p1, c4, d2, p2] = v;
      const none1 = !p && !d1 && !p1, none2 = !c4 && !d2 && !p2;
      const ok1 = none1 || (close(c - p, d1, CENT) && pct(d1, p, p1)), ok2 = none2 || (close(c - c4, d2, CENT) && pct(d2, c4, p2));
      if (ok1 && ok2) fits.push({ c, p });
      else if (relax && (none1 || pct(d1, p, p1)) && (none2 || pct(d2, c4, p2))) fits.push({ c, p, note: `printed differences ${d1} and ${d2} do not recompute from ${c} − ${p} and ${c} − ${c4}` });
    }
    if (fits.length) return fits;
  }
  return [];
}
/** Numbers on an overview row, with the x where each ends; a number may run over several pieces ("20" + "’394’357.58"). */
function numbersAt(items: Item[]) {
  const out: { v: number; end: number }[] = []; let cur = "", end = 0, lastEnd = -1e9;
  const flush = () => { const m = cur.replace(/[’'\s]/g, "").match(/^-?\d+\.\d{2}$/); if (m) out.push({ v: Number(m[0]), end }); cur = ""; };
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    if (cur && it.x - lastEnd > 3) flush();
    for (const m of it.s.matchAll(/-?[\d’']+(?:\.\d{0,2})?|\S+/g)) {
      const tok = m[0], x = it.x + (it.w * (m.index! + tok.length)) / Math.max(1, it.s.length);
      if (/^-?[\d’']+(\.\d{0,2})?$/.test(tok)) { cur += tok; end = x; if (/\.\d{2}$/.test(cur)) flush(); } else flush();
    }
    lastEnd = it.x + it.w;
  }
  flush();
  return out;
}
export async function departments(D: any) {
  const bad: string[] = [], notes: string[] = [], twoReadings: string[] = [];
  const all = await pdfjs.read(ACCOUNTS);
  const pagesList = Object.keys(all).map(Number);
  // (a) each department's overview table ("Organizzazione contabile del dicastero"): departments, divisions, and
  //     divisions without a table of their own; columns found by their headings, read by the right edge of each amount
  const overview = pagesList.filter((p) => all[p].items.some((i) => /Organizzazione contabile del dicastero/.test(i.s)));
  const tabled = new Set<string>();
  const pageRows: Record<number, Row[]> = Object.fromEntries(pagesList.map((p) => [p, rows(all[p].items)]));
  const captions = pagesList.flatMap((p) => pageRows[p].filter((r) => /\((CENTRO|DIVISIONE)/.test(r.text)).map((r) => r.text));
  // a caption carries its code first ("1210 Punto Città (CENTRO …)") or, in some tables, right after it ("…)2021")
  const ownTable = (code: string) => captions.some((t) => t.startsWith(`${code} `) || new RegExp(`\\)\\s*${code}$`).test(t));
  const lines = D.org.lines.filter((l: any) => /^\d+$/.test(l.code));
  for (const l of lines) if (ownTable(l.code)) tabled.add(l.code);
  const byOverview = [...D.org.slices.map((s: any) => ({ code: s.code, label: s.name.it, c25: s.c25, p25: s.p25 })), ...D.org.groups, ...lines.filter((l: any) => !tabled.has(l.code))];
  let nOverview = 0;
  for (const u of byOverview) {
    let found: { v: number; end: number }[] | null = null, cols: number[] = [];
    for (const p of overview) {
      const its = all[p].items;
      const heads = its.filter((i) => /^(Consuntivo|Preventivo) +(spese|ricavi)$/.test(i.s)).sort((a, b) => a.x - b.x);
      if (heads.length !== 6) { bad.push(`p. ${p}: overview without its six headings`); continue; }
      if (u.code.length === 1 && !its.some((i) => i.s.startsWith(`DICASTERO ${u.code} `))) continue;
      cols = heads.map((h) => h.x + h.w);
      const below = its.filter((i) => i.y < heads[0].y - 5);
      const stop = Math.max(0, ...below.filter((i) => /^\d{1,2}\s*[–-]\s*\S/.test(i.s) || /^Nel merito/.test(i.s)).map((i) => i.y));
      for (const r of rows(below.filter((i) => i.y > stop + 2))) {
        const lab = r.items.filter((i) => i.x < cols[0] - 70).map((i) => i.s).join(" ").trim();
        // a department's total is the first row of amounts under the headings (its name may wrap around it)
        const hit = u.code.length === 1 ? numbersAt(r.items).length > 0 : [lab, r.items[0]?.s ?? ""].some((s) => s === u.code || s.startsWith(`${u.code} `));
        if (hit) { found = numbersAt(r.items); break; }
      }
      if (found) break;
    }
    if (!found) { bad.push(`${u.code}: no row in the overview tables`); continue; }
    const col = (e: number) => cols.reduce((bi, c, i) => (Math.abs(c - e) < Math.abs(cols[bi] - e) ? i : bi), 0);
    const c = found.find((x) => col(x.end) === 0)?.v ?? 0, p = found.find((x) => col(x.end) === 2)?.v ?? 0;
    if (close(c, u.c25 * 1e6, FRANC) && close(p, u.p25 * 1e6, FRANC)) nOverview++;
    else bad.push(`${u.code} ${u.label}: ${u.c25}/${u.p25} mio, overview prints ${c}/${p}`);
  }
  // (b) each centre's (or division's) own table: its caption, then row 3, read through the row's arithmetic
  const isCaption = (r: Row) => /\((CENTRO|DIVISIONE)/.test(r.text) || (/^\d{2,4}(\s|$)/.test(r.text) && r.x < 62 && !/\d\.\s?\d\d/.test(r.text) && !/^\d{1,4}\s+[–-]/.test(r.text));
  let nTables = 0;
  for (const l of lines.filter((x: any) => tabled.has(x.code))) {
    // the table follows the unit's heading, on the same page or one of the next three
    const r = [l.page, l.page + 1, l.page + 2, l.page + 3].flatMap((p) => pageRows[p] ?? []);
    const tok = new RegExp(`(^|[^\\d’'.])${l.code}([^\\d’'.]|$)`);
    let cap = r.findIndex((x) => /\((CENTRO|DIVISIONE)/.test(x.text) && tok.test(x.text));
    if (cap < 0) cap = r.findIndex((x) => isCaption(x) && x.text.split(/\s/)[0] === l.code);
    if (cap < 0) { bad.push(`${l.code}: no table caption on pp. ${l.page}–${l.page + 3}`); continue; }
    let row = "";
    for (const x of r.slice(cap + 1)) { if (isCaption(x)) break; if (/^3(\s|$)/.test(x.text)) { row = x.text; break; } }
    const fits = row ? readings(amounts(row, "3")) : [{ c: 0, p: 0 }];
    const match = fits.find((f) => close(f.c, l.c25 * 1e6, FRANC) && close(f.p, l.p25 * 1e6, FRANC));
    if (!match) { bad.push(`${l.code} ${l.label}: ${l.c25}/${l.p25} mio, table reads ${fits.map((f) => `${f.c}/${f.p}`).join(" or ") || "nothing consistent"}`); continue; }
    nTables++;
    if (match.note) notes.push(`${l.code}: ${match.note}`);
    if (new Set(fits.map((f) => `${f.c}/${f.p}`)).size > 1) twoReadings.push(l.code);
  }
  const derived = D.org.lines.filter((l: any) => !/^\d+$/.test(l.code)).map((l: any) => l.code);
  const units = new Set([...byOverview.map((u: any) => u.code), ...lines.filter((x: any) => tabled.has(x.code)).map((x: any) => x.code)]).size;
  return { nOverview, nTables, units, bad, notes, twoReadings, derived };
}
