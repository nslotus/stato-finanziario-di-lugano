// Budget against actual 2025 by the City's own organisation: departments (dicasteri), divisions and cost centres
// (centri di responsabilità), with the City's explanations of the main deviations. Read from the 2025 final-accounts
// message, where each division and centre has a table (actual 2025, budget 2025, difference, …, by account group) and
// prose. Every table row must satisfy actual − budget = printed difference, the account groups 30–39 must add up to
// spending (3), centres must add up to their division where the division has a table, and departments must match the
// City's department table and add up to the total of the functional table.

import type { Source, Text } from "./catalog";
import { fail } from "./adapters/common";
import { readPdf, type Item } from "./adapters/pdf";
import { F as BF } from "./bilancio-funzioni";

type Src = (file: string, locator: string) => Source;
const FILE = BF.c25;
const PAGES = { from: 87, to: 232, deptTable: 233 };
// the department names as the City writes them in its department table (proper case)
const DEPTS = ["Istituzioni", "Consulenza e gestione", "Immobili", "Sicurezza e spazi urbani", "Formazione, Socialità e Sostegno", "Cultura, Sport ed Eventi", "Sviluppo territoriale"];
const MONEY = /^-?\d{1,3}(?:’\d{3})*\.\d\d$/;
const num = (s: string) => Number(s.replace(/[’'\s]/g, ""));
const close = (a: number, b: number, what: string, tol = 0.015) => { if (Math.abs(a - b) > tol) fail(`${what}: ${a} vs ${b}`); };

// rows where the City's printed difference does not equal actual − budget (checked by hand against the PDF; the
// actual and budget columns add up with the other rows, so they are used). Any other mismatch stops the build.
const KNOWN: { where: string; off: number; seen?: boolean }[] = [
  { where: "p. 172, table 4101, row 31", off: 16.97 }, { where: "p. 172, table 4101, row 3", off: 16.97 },
];
const notes: string[] = [];
// divisions whose centre tables do not cover all their spending (checked against the PDF: 40 Spazi urbani has no table
// for part of its spending, likely the fee-funded waste service listed as 4031 Rifiuti in its summary)
const REMAINDER = ["40"];

type Line = { page: number; y: number; items: Item[]; text: string };
type Row = { a: number; b: number; d: number };
type Table = { code: string; name: string; kind: string; page: number; rows: Map<string, Row> };

/** Join the pieces of one printed line, adding a space only where the PDF leaves a gap. */
function joinLine(its: Item[]) {
  let out = "";
  its.forEach((it, i) => {
    if (i) { const p = its[i - 1], gap = it.x - (p.x + p.w); out += p.sp || gap > 1.2 ? " " : ""; }
    out += it.s;
  });
  return out.replace(/\s+/g, " ").trim();
}

/** The 2025 amounts of a table row (actual, budget, difference): pieces left of the 2024 column, joined into numbers. */
function amounts(its: Item[], cut: number, where: string): Row | null {
  const toks: { s: string; x: number; e: number }[] = [];
  for (const it of its) {
    if (it.x < 150) continue;
    const str = it.s.replace(/(\d)\s+(?=[’.]\d|’)/g, "$1").replace(/([’.])\s+(?=\d)/g, "$1").replace(/(\d)\s+(?=\.\d\d)/g, "$1");
    const parts = str.split(/\s+/), cw = it.w / Math.max(1, str.length);
    let off = 0;
    for (const s of parts) { const x = it.x + off * cw; off += s.length + 1; if (x < cut) toks.push({ s, x, e: x + s.length * cw }); }
  }
  // numbers are right-aligned: the column is the one a number ends in, measured from the 2024 column of the same table
  const nums: { v: number; e: number }[] = [];
  let acc = "";
  const sorted = toks.sort((a, b) => a.x - b.x);
  for (const [i, t] of sorted.entries()) {
    if (t.s.includes("%") || t.x >= cut - 38) break;   // the percentage column closes the 2025 amounts
    if (t.s === "-") {                       // a minus sign printed apart, or an empty cell
      const nx = sorted[i + 1];
      if (!acc && nx && /^\d/.test(nx.s) && nx.x - t.e < 5) acc = "-";
      continue;
    }
    acc += t.s;
    if (MONEY.test(acc)) { nums.push({ v: num(acc), e: t.e }); acc = ""; }
  }
  if (acc) fail(`${where}: unfinished number '${acc}'`);
  if (!nums.length) return null;
  const col: Record<"a" | "b" | "d", number | null> = { a: null, b: null, d: null };
  for (const x of nums) { const c = x.e < cut - 140 ? "a" : x.e < cut - 77 ? "b" : "d"; if (col[c] != null) fail(`${where}: two amounts in column ${c}`); col[c] = x.v; }
  const a = col.a ?? 0, b = col.b ?? 0, d = col.d ?? 0, off = a - b - d, known = KNOWN.find((k) => where.endsWith(k.where));
  if (known && Math.abs(Math.abs(off) - known.off) < 0.015) { notes.push(`${where}: the printed difference is off by CHF ${known.off.toFixed(2)} in the source; actual and budget are used`); known.seen = true; }
  else close(a - b, d, `${where}: actual − budget = difference`);
  return { a, b, d: a - b };
}

export async function dicasteri(src: Src) {
  const list = Array.from({ length: PAGES.to - PAGES.from + 1 }, (_, i) => PAGES.from + i);
  const { items, pages } = await readPdf(FILE, [...list, PAGES.deptTable]);
  if (!/DICASTERO 1 – ISTITUZIONI/.test(pages[PAGES.from - 1])) fail(`${FILE} p. ${PAGES.from}: department 1 does not start here`);

  // lines in reading order
  const lines: Line[] = [];
  for (const p of list) {
    const rows: Item[][] = [];
    for (const it of [...(items[p - 1] ?? [])].sort((a, b) => b.y - a.y || a.x - b.x)) { const r = rows.find((q) => Math.abs(q[0].y - it.y) <= 2.5); r ? r.push(it) : rows.push([it]); }
    for (const r of rows) { r.sort((a, b) => a.x - b.x); lines.push({ page: p, y: r[0].y, items: r, text: joinLine(r) }); }
  }

  type Unit = { code: string; name: string; kind: string; page: number; table: Table | null; text: string[] };
  const depts: { n: number; name: string; heading: string; page: number; divisions: Map<string, Unit & { centres: Map<string, Unit> }> }[] = [];
  let dept: (typeof depts)[number] | null = null, div: (Unit & { centres: Map<string, Unit> }) | null = null, table: Table | null = null, cut = 385;
  let subject: Unit | null = null, para: string[] = [], lastY = 0, lastPage = 0;
  const flush = () => { if (para.length && subject) subject.text.push(para.join(" ").replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1$2").trim()); para = []; };
  const newDiv = (code: string, name: string, kind: string, page: number) => {
    if (!dept) fail(`${FILE} p. ${page}: division ${code} before any department`);
    let d = dept!.divisions.get(code);
    if (!d) { d = { code, name, kind, page, table: null, text: [], centres: new Map() }; dept!.divisions.set(code, d); }
    return d;
  };

  for (const ln of lines) {
    const t = ln.text, x0 = ln.items[0].x;
    // headings
    let m = t.match(/^DICASTERO (\d) – (.+)$/);
    if (m) { flush(); dept = { n: +m[1], name: DEPTS[+m[1] - 1], heading: m[2], page: ln.page, divisions: new Map() }; depts.push(dept); div = null; table = null; subject = null; continue; }
    m = t.match(/^(\d{2}) ?[–-] ?([A-ZÀ-Ù][A-ZÀ-Ù ,'’.]+)$/);
    if (m && x0 < 62 && dept && m[1][0] === String(dept.n)) { flush(); div = newDiv(m[1], m[2], "heading", ln.page); subject = div; table = null; continue; }
    // a table caption: "41 Polizia (DIVISIONE)", "4100 Comando e staff (CENTRO DI RESPONSABILITA)"
    m = t.match(/^(\d{2,4}) ?(\D.+?) ?\(([A-ZÀ-Ù ]+?) ?\)$/);
    if (m && x0 < 62 && dept && m[1][0] === String(dept.n)) {
      flush();
      const [, code, name, kind] = m;
      table = { code, name: name.trim(), kind: kind.trim(), page: ln.page, rows: new Map() };
      if (code.length === 2) { div = newDiv(code, name.trim(), kind.trim(), ln.page); div.name = name.trim(); div.kind = kind.trim(); div.table = table; }
      else {
        const dc = code.slice(0, 2);
        if (!div || div.code !== dc) div = newDiv(dc, `${dc}`, "heading", ln.page);
        const had = div.centres.get(code);
        if (had && had.kind !== "pending") fail(`${FILE} p. ${ln.page}: centre ${code} twice`);
        if (had) Object.assign(had, { name: name.trim(), kind: kind.trim(), page: ln.page, table });
        else div.centres.set(code, { code, name: name.trim(), kind: kind.trim(), page: ln.page, table, text: [] });
      }
      continue;
    }
    // the column header fixes where 2025 ends
    if (/Consuntivo 2025/.test(t) && /Consuntivo 2024/.test(t)) { const c24 = ln.items.find((i) => i.s.startsWith("Consuntivo 2024")); if (c24) cut = c24.x - 2; continue; }
    // table rows: an account group code at the margin
    const codeItems = ln.items.filter((i) => i.x < 66 && /^\d+$/.test(i.s)), code = codeItems.map((i) => i.s).join("");
    if (table && codeItems.length && /^[34]\d?$/.test(code) && ln.items.some((i) => i.x >= 150 && /\d/.test(i.s))) {
      const r = amounts(ln.items, cut, `${FILE} p. ${ln.page}, table ${table.code}, row ${code}`);
      if (r) table.rows.set(code, r);
      continue;
    }
    // prose: long lines at the margin with lower-case text; skip fixed headings and page numbers
    const bullet = /^[•▪●-] ?\S/.test(t), gap0 = ln.page === lastPage ? lastY - ln.y : 99;
    const wrapsBullet = para.length > 0 && /^[•▪●-]/.test(para[0]) && gap0 <= 16 && x0 < 100;
    if ((x0 < 62 || (bullet && x0 < 100) || wrapsBullet) && /[a-zà-ù]{2}/.test(t) && !/^(Considerazioni generali|Nel merito del consuntivo 2025|Osservazioni sulle principali variazioni|Organizzazione contabile)/.test(t) && dept) {
      const gap = gap0;
      if (gap > 20 || bullet) flush();
      // a paragraph that names a centre belongs to that centre
      const cm = t.match(/(?:Centr[oi] di Responsabilit[àa]|CdR)\s*(\d{4})\b/);
      if (cm && div?.centres.has(cm[1]) && para.length === 0) subject = div.centres.get(cm[1])!;
      else if (cm && div && /^\d{4}$/.test(cm[1]) && cm[1].startsWith(div.code) && para.length === 0) {
        // the centre's table may come after its text
        if (!div.centres.has(cm[1])) div.centres.set(cm[1], { code: cm[1], name: cm[1], kind: "pending", page: ln.page, table: null, text: [] });
        subject = div.centres.get(cm[1])!;
      }
      if (!subject) subject = div ?? null;
      para.push(t); lastY = ln.y; lastPage = ln.page;
      continue;
    }
    if (table && /^[A-ZÀ-Ù' ]+$/.test(t)) continue; // row labels
  }
  flush();
  if (depts.length !== 7) fail(`${FILE}: ${depts.length} departments found, not 7`);

  // checks and output
  const spend = (tb: Table | null, where: string) => {
    if (!tb) return null;
    const s = tb.rows.get("3");
    if (!s) return { a: 0, b: 0, d: 0 };
    const parts = [...tb.rows.entries()].filter(([k]) => /^3\d$/.test(k));
    if (parts.length) { close(parts.reduce((t, [, r]) => t + r.a, 0), s.a, `${where}: groups 30–39 add up to spending (actual)`, 0.05); close(parts.reduce((t, [, r]) => t + r.b, 0), s.b, `${where}: groups 30–39 add up to spending (budget)`, 0.05); }
    return s;
  };
  const dept25 = pages[PAGES.deptTable - 1];
  const M = String.raw`\d{1,3}(?:’\d{3})*\.\d\d`;
  const deptRow = (d: string) => (dept25.match(new RegExp(`${d} (${M}) (${M}) (${M}) (${M})`)) ?? fail(`${FILE} p. ${PAGES.deptTable}: department row ${d}`)).slice(1).map(num);
  const mio = (v: number) => v / 1e6;
  const out = depts.map((d) => {
    const divisions = [...d.divisions.values()].map((v) => {
      const centres = [...v.centres.values()].map((c) => {
        if (!c.table) fail(`${FILE}: centre ${c.code} has text but no table`);
        const s = spend(c.table, `${FILE} p. ${c.page}, centre ${c.code}`)!, r = c.table!.rows.get("4");
        return { code: c.code, name: c.name, kind: c.kind, page: c.page, c25: mio(s.a), p25: mio(s.b), rc25: r ? mio(r.a) : 0, rp25: r ? mio(r.b) : 0, text: c.text };
      });
      let s = spend(v.table, `${FILE} p. ${v.page}, division ${v.code}`);
      const sumC = { a: centres.reduce((t, c) => t + c.c25 * 1e6, 0), b: centres.reduce((t, c) => t + c.p25 * 1e6, 0) };
      if (s && centres.length && REMAINDER.includes(v.code)) {
        // the message has no centre table for part of this division: show the rest as one labelled remainder
        const rest = { a: s.a - sumC.a, b: s.b - sumC.b };
        if (rest.a < 0.05 && rest.b < 0.05) fail(`${FILE}: division ${v.code} no longer has a remainder; remove it from REMAINDER`);
        centres.push({ code: `${v.code}··`, name: "Resto della divisione, senza tabella per centro nel messaggio", kind: "remainder", page: v.page, c25: mio(rest.a), p25: mio(rest.b), rc25: 0, rp25: 0, text: [] });
        notes.push(`division ${v.code}: CHF ${(rest.a / 1e6).toFixed(2)} mio actual (${(rest.b / 1e6).toFixed(2)} budget) not broken down by centre in the message`);
      } else if (s && centres.length) { close(sumC.a, s.a, `${FILE}: centres add up to division ${v.code} (actual)`, 0.05 * centres.length); close(sumC.b, s.b, `${FILE}: centres add up to division ${v.code} (budget)`, 0.05 * centres.length); }
      if (!s) { if (!centres.length) fail(`${FILE}: division ${v.code} has neither a table nor centres`); s = { a: sumC.a, b: sumC.b, d: sumC.a - sumC.b }; }
      const r = v.table?.rows.get("4");
      return { code: v.code, name: v.name, kind: v.kind, page: v.page, c25: mio(s.a), p25: mio(s.b), rc25: r ? mio(r.a) : null, rp25: r ? mio(r.b) : null, text: v.text, centres };
    });
    const row = deptRow(d.name), c25 = divisions.reduce((t, v) => t + v.c25, 0), p25 = divisions.reduce((t, v) => t + v.p25, 0);
    return { n: d.n, name: d.name, page: d.page, c25, p25, printed: { c25: mio(row[0]), p25: mio(row[2]) }, divisions };
  });
  for (const d of out) close(d.c25, d.printed.c25, `department ${d.n} ${d.name}: divisions vs department table (actual)`, 0.0001);
  const total = out.reduce((t, d) => t + d.c25, 0);
  console.log(`departments 2025: ${out.map((d) => `${d.n} ${d.c25.toFixed(2)} (${d.divisions.length} div, ${d.divisions.reduce((t, v) => t + v.centres.length, 0)} centres)`).join(" · ")} · total ${total.toFixed(2)}`);
  for (const d of out) { const diff = d.p25 - d.printed.p25; if (Math.abs(diff) > 0.0001) console.log(`  note: department ${d.n}: divisions' budget ${d.p25.toFixed(4)} vs department table ${d.printed.p25.toFixed(4)} (${(diff * 1e6).toFixed(2)} CHF)`); }
  const texts = out.flatMap((d) => d.divisions.flatMap((v) => [v.text.length, ...v.centres.map((c) => c.text.length)]));
  console.log(`  explanations: ${texts.filter((k) => k > 0).length} of ${texts.length} units have text, ${texts.reduce((t, k) => t + k, 0)} paragraphs`);
  const source = [src(FILE, `pp. ${PAGES.from}–${PAGES.to}: tables by division and centro di responsabilità (Consuntivo 2025, Preventivo 2025, Differenza; row 3 'Spese'), and the 'Osservazioni sulle principali variazioni rispetto al preventivo 2025'`),
    src(FILE, `p. ${PAGES.deptTable}: department table (totals by dicastero)`)];
  const note: Text = { it: "Tabelle e testi della Città per dicastero, divisione e centro di responsabilità. Le cifre comprendono gli addebiti interni (gruppo 39), come la tabella per funzione.", en: "The City's tables and texts by department, division and cost centre. The figures include internal charges (group 39), like the functional table." };
  for (const k of KNOWN) if (!k.seen) fail(`${FILE}: known inconsistency at ${k.where} not found; check the source`);
  for (const x of notes) console.log(`  note: ${x}`);
  return { depts: out, total, source, note };
}
