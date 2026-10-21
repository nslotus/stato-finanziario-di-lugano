// City staff: who the personnel spending pays, by department (dicastero), service and cost centre.
// Source: the 2027 budget message (MM preventivo 2027), "Commento generale risorse umane":
//   p.28  account 30 'Spese per il personale' by nature (300–309), columns P2027 · P2026 · diff · % · C2025 · diff · %
//   pp.58–59 Tabella 1  permanent staff (personale di ruolo), units (full-time equivalents) and gross salaries per cost centre
//   pp.61–62 Tabella 1a non-permanent staff (personale non di ruolo), same layout
// Each table row is read by position: three column pairs (units, salaries) for P2027, P2026 and C2025, some of them empty
// (a centre that is new in 2027, or moved away after 2025). Every department total and the City total are checked.
//   npm run staff → catalog/personale.json (run before npm run site)

import { writeFileSync } from "node:fs";
import { readPdf, type Item } from "./adapters/pdf";

const FILE = "city-preventivo-2027-messaggio.pdf";
const PAGES = { nature: 28, perm: [58, 59], temp: [61, 62] };
type Cols = { u27?: number; s27?: number; u26?: number; s26?: number; u25?: number; s25?: number };
type Centre = { code: string; name: string } & Cols;
type Group = { name: string; centres: Centre[] };
type Dept = { name: string; groups: Group[]; total: Cols };

const num = (s: string) => Number(s.replace(/[’']/g, "").replace(/\s/g, ""));
// gaps in the PDF's words ("Ediliz ia", "manuten z ione", "DICA STERO")
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s?z\s(?=i)/g, "z").replace(/DICA STERO/, "DICASTERO").trim();
// column positions come from each page's header row ('Unità' / 'Stipendi'); figures sit a few points right of their heading
type Anchor = { u: number[]; s: number[] };
function anchors(r: Item[][]): Anchor {
  const h = r.find((q) => q.filter((i) => i.s === "Unità").length === 3 && q.filter((i) => i.s === "Stipendi").length === 3);
  if (!h) throw new Error("table header (Unità / Stipendi) not found");
  return { u: h.filter((i) => i.s === "Unità").map((i) => i.x + 10), s: h.filter((i) => i.s === "Stipendi").map((i) => i.x + 10) };
}
const KEYS: [keyof Cols, keyof Cols][] = [["u27", "s27"], ["u26", "s26"], ["u25", "s25"]];

function rows(items: Item[]) {
  const out: Item[][] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const r = out.find((q) => Math.abs(q[0].y - it.y) <= 2);
    r ? r.push(it) : out.push([it]);
  }
  return out.map((r) => r.sort((a, b) => a.x - b.x));
}
// A row's figures are read as one sequence, since the PDF sometimes puts two of them in one item ("27.90   2’391’460.00")
// or splits one across two ("6." + "20", "3’401’ 400. 00"); "-" stands for zero. Six figures fill the six columns in
// order; two or four figures are (units, salaries) pairs placed by the position of their units figure.
function cells(r: Item[], ANCHOR: Anchor) {
  const text = r.filter((it) => it.x < 250).map((it) => it.s);
  let str = ""; const xs: number[] = [];
  for (const it of r.filter((q) => q.x >= 250)) for (const ch of (str ? " " : "") + it.s) { str += ch; xs.push(it.x); }
  const toks = [...str.matchAll(/(?:\d{1,3}(?:[’'] ?\d{3})+|\d+)\. ?\d{2}|(?<=^|\s)-(?=\s|$)/g)].map((m) => ({ v: m[0] === "-" ? 0 : num(m[0]), x: xs[m.index!] }));
  const cols: Cols = {};
  if (toks.length === 6) KEYS.forEach(([ku, ks], i) => { cols[ku] = toks[2 * i].v; cols[ks] = toks[2 * i + 1].v; });
  else {
    if (toks.length % 2) throw new Error(`odd number of figures in row '${text.join("")}': ${str}`);
    for (let i = 0; i < toks.length; i += 2) {
      const x = toks[i].x, k = ANCHOR.u.reduce((b, a, n) => (Math.abs(a - x) < Math.abs(ANCHOR.u[b] - x) ? n : b), 0);
      if (Math.abs(ANCHOR.u[k] - x) > 24) throw new Error(`figure ${toks[i].v} at x=${x} matches no column`);
      if (cols[KEYS[k][0]] !== undefined) throw new Error(`two pairs for column ${k} in '${text.join("")}'`);
      cols[KEYS[k][0]] = toks[i].v; cols[KEYS[k][1]] = toks[i + 1].v;
    }
  }
  return { text: clean(text.join("")), cols };
}

async function table(pages: number[], label: string) {
  const { items } = await readPdf(FILE, pages);
  const depts: Dept[] = []; let comune: Cols | null = null;
  for (const p of pages) { const page = rows(items[p - 1]), anc = anchors(page); for (const r of page) {
    if (/PREVENTIVO|EVENTIVO|CONSUNTIVO|Unità|Tabella|^\d+$/.test(r.map((i) => i.s).join(" "))) continue;
    const { text, cols } = cells(r, anc);
    if (!text || /^(PREVENTIVO|Dicasteri|Tabella|\d+$)/.test(text) || /PREVENTIVO|EVENTIVO|CONSUNTIVO/.test(text)) continue;
    if (/^Totale Comune/.test(text)) { comune = cols; continue; }
    if (/^DICASTERO /.test(text)) { depts.push({ name: text.replace(/^DICASTERO /, ""), groups: [], total: {} }); continue; }
    const d = depts[depts.length - 1]; if (!d) continue;
    if (/^Totale$/.test(text)) { d.total = cols; continue; }
    const m = text.match(/^(\d{5})\s*(.+)$/);
    if (m) { if (!d.groups.length) throw new Error(`${label}: centre ${m[1]} before any service`); d.groups[d.groups.length - 1].centres.push({ code: m[1], name: m[2].trim(), ...cols }); continue; }
    if (Object.keys(cols).length) throw new Error(`${label}: numbers on a heading row '${text}'`);
    d.groups.push({ name: text, centres: [] });
  } }
  if (!comune) throw new Error(`${label}: 'Totale Comune' not found`);
  // every department total equals the sum of its centres, and the departments add up to the City total, in every column
  const sum = (list: Cols[], k: keyof Cols) => list.reduce((t, c) => t + (c[k] ?? 0), 0);
  for (const d of depts) for (const [ku, ks] of KEYS) {
    const cs = d.groups.flatMap((g) => g.centres);
    if (Math.abs(sum(cs, ku) - (d.total[ku] ?? 0)) > 0.011 || Math.abs(sum(cs, ks) - (d.total[ks] ?? 0)) > 1)
      throw new Error(`${label} ${d.name} ${ku}/${ks}: centres ${sum(cs, ku).toFixed(2)} / ${sum(cs, ks).toFixed(2)} vs total ${d.total[ku]} / ${d.total[ks]}`);
  }
  for (const [ku, ks] of KEYS) {
    const tu = sum(depts.map((d) => d.total), ku), ts = sum(depts.map((d) => d.total), ks);
    if (Math.abs(tu - (comune[ku] ?? 0)) > 0.011 || Math.abs(ts - (comune[ks] ?? 0)) > 1) throw new Error(`${label} City ${ku}/${ks}: ${tu} / ${ts} vs ${comune[ku]} / ${comune[ks]}`);
  }
  return { depts, comune };
}

async function nature() {
  const { pages } = await readPdf(FILE, [PAGES.nature]);
  const t = pages[PAGES.nature - 1];
  const N = String.raw`-?\d{1,3}(?:'\d{3})*\.\d{2}%?`;
  const line = (code: string, name: string) => {
    const m = t.match(new RegExp(String.raw`${code} ${name} ((?:${N} ?)+)`, "i"));
    if (!m) throw new Error(`p.${PAGES.nature}: line ${code} missing`);
    const v = m[1].trim().split(" ");
    return num(v[v.length - 3]); // C2025 is always followed by its difference and percentage
  };
  const total = line("30", "SPESE PER IL PERSONALE"), spend = line("3", "SPESE");
  const L: [string, string, string, string][] = [
    ["300", "Autorità e commissioni", "Autorità e commissioni", "Authorities and commissions"],
    ["301", "Stipendi per il personale amministrativo e d'esercizio", "Stipendi del personale amministrativo e d'esercizio", "Salaries of administrative and operational staff"],
    ["302", "Stipendi dei docenti", "Stipendi dei docenti", "Teachers' salaries"],
    ["303", "Personale temporaneo", "Personale temporaneo", "Temporary staff"],
    ["304", "Assegni e indennità", "Assegni e indennità", "Allowances"],
    ["305", "Contributi del datore di lavoro", "Contributi del datore di lavoro", "Employer contributions"],
    ["306", "Prestazioni di previdenza del datore di lavoro", "Prestazioni di previdenza del datore di lavoro", "Employer pension benefits"],
    ["309", "Altre spese per il personale", "Altre spese per il personale", "Other personnel costs"],
  ];
  const lines = L.map(([code, pdf, it, en]) => ({ code, label: { it, en }, value: line(code, pdf.replace(/'/g, "'")) }));
  const s = lines.reduce((a, l) => a + l.value, 0);
  if (Math.abs(s - total) > 1) throw new Error(`p.${PAGES.nature}: lines 300–309 add up to ${s}, not ${total}`);
  return { total, spend, lines };
}

(async () => {
  const perm = await table(PAGES.perm, "Tabella 1"), temp = await table(PAGES.temp, "Tabella 1a"), nat = await nature();
  const src = (loc: string) => ({ file: `sources/${FILE}`, locator: loc });
  const out = {
    year: 2025, budgetYear: 2027,
    nature: { ...nat, source: [src(`p.${PAGES.nature}, §4.3.2 '30 Spese per il personale', column 'Consuntivo 2025' (lines 300–309; group 3 'SPESE' for total spending)`)] },
    perm: { ...perm, source: [src(`pp.${PAGES.perm.join("–")}, Tabella 1 'dettaglio personale di ruolo (unità e stipendi lordi) suddiviso secondo dicastero e centro di costo'`)] },
    temp: { ...temp, source: [src(`pp.${PAGES.temp.join("–")}, Tabella 1a 'dettaglio personale non di ruolo (unità e stipendi lordi) suddiviso secondo dicastero e centro di costo'`)] },
  };
  writeFileSync("catalog/personale.json", JSON.stringify(out, null, 1));
  const m = (v = 0) => (v / 1e6).toFixed(2);
  console.log(`account 30 (C2025): ${m(nat.total)} mio of ${m(nat.spend)} · permanent ${perm.comune.u25} units ${m(perm.comune.s25)} mio · non-permanent ${temp.comune.u25} units ${m(temp.comune.s25)} mio`);
  for (const d of perm.depts) console.log(`  ${d.name}: ${d.total.u25} units ${m(d.total.s25)} mio · ${d.groups.map((g) => `${g.name} (${g.centres.length})`).join(", ")}`);
})();
