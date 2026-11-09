// The investment plan in the 2027 budget message ("Conti investimenti 2027/2030", pp. 313–323): for every work with a
// voted credit, the updated credit, the estimated final cost, probable spending to 31.12.2026, outgoings and income
// planned for each year 2027–2030, and what is left for 2031–2034. Amounts in thousands of francs (the credit voted
// is printed in francs). Read by position like the 2025 register: each amount goes to the column whose header it
// ends under, found on every page; pieces of one number printed touching each other are joined.
// Checks that stop the build: each section has the number of works it prints ("Totale No. Opere"); every work's
// 2027–2030 summary is the sum of its four years and the summary's outgoings minus income its net figure (rounding
// to the thousand allowed); the works add up to every printed total, within the rounding of the rows summed.

import { fail } from "./common";
import type { Item } from "./pdf";

export const PLAN_PAGES = { council: [313, 321], municipio: [323, 323] } as const;
export type PlanWork = {
  code: string; section: "council" | "municipio"; name: string; page: number;
  creditVoted: number; credit: number; estimated: number; prob26: number; prob26in: number;
  y27: number; y28: number; y29: number; y30: number; in27_30: number; sum27_30: number; net27_30: number; after30: number;
};

const K = ["credU", "credE", "probU", "probE", "p27U", "p27E", "p28U", "p28E", "p29U", "p29E", "p30U", "p30E", "riepU", "riepE"] as const;
const NUM = /^-?\d{1,3}(?:['’]\d{3})*$/;
const n = (s: string) => Number(s.replace(/['’]/g, ""));

/** Join pieces printed touching each other ("601", "'", "565" → "601'565"). */
function joinPieces(its: Item[]) {
  const out: Item[] = [];
  for (const it of [...its].sort((a, b) => Math.round(b.y) - Math.round(a.y) || a.x - b.x)) {
    const last = out.at(-1);
    if (last && Math.abs(last.y - it.y) <= 1 && it.x - (last.x + last.w) < 0.8 && /^[-\d'’]+$/.test(last.s) && /^[\d'’]+$/.test(it.s))
      out[out.length - 1] = { ...last, s: last.s + it.s, w: it.x + it.w - last.x };
    else out.push(it);
  }
  return out;
}

export async function investmentPlan(read: (file: string, pages: number[]) => Promise<{ items: Item[][] }>, file: string) {
  const works: PlanWork[] = [];
  const checks = { totals: 0, works: 0 };
  for (const section of ["council", "municipio"] as const) {
    const [a, b] = PLAN_PAGES[section];
    const pages = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const { items } = await read(file, pages);
    let printedCount = 0, cur: PlanWork | null = null;
    const totals: { label: string; v: number[]; page: number; group: string }[] = [];
    let group = "", category = "", kind = "";
    const tagged: { w: PlanWork; group: string; category: string; kind: string }[] = [];
    for (const p of pages) {
      const raw = items[p - 1] ?? [];
      if (!raw.some((i) => /CONTI INVESTIMENTI - 2027\/2030: CREDITI VOTATI/.test(i.s))) continue; // blank back pages
      const its = joinPieces(raw);
      const firstU = its.filter((i) => i.s === "Uscite").sort((x, y) => x.x - y.x)[0];
      const ue = its.filter((i) => (i.s === "Uscite" || i.s === "Entrate") && firstU && Math.abs(i.y - firstU.y) <= 1).sort((x, y) => x.x - y.x);
      const agg = its.find((i) => i.s === "agg."), stim = its.find((i) => i.s === "stimato"), net = its.find((i) => i.s === "Uscite ./."), late = its.find((i) => i.s === "2031-2034");
      if (ue.length !== 14 || !agg || !stim || !net || !late) fail(`investment plan p. ${p}: header columns not found (${ue.length} Uscite/Entrate)`);
      const anchors: [string, number][] = [...ue.map((u, k): [string, number] => [K[k], u.x + u.w]), ["credAgg", agg.x + agg.w], ["estimated", stim.x + stim.w], ["riepNet", net.x + net.w], ["after30", late.x + late.w]];
      const colOf = (it: Item) => { const r = it.x + it.w; return anchors.reduce((best, x) => (Math.abs(x[1] - r) < Math.abs(best[1] - r) ? x : best))[0]; };
      const nameFrom = ue[1].x + ue[1].w + 2, nameTo = agg.x - 6;
      // lines: pieces within 2 points of height belong together (a code can sit a point off its amounts)
      const lines: Item[][] = [];
      for (const it of its.filter((i) => i.y < firstU.y - 1.5 && i.y >= 30).sort((x, z) => z.y - x.y)) {
        const last = lines.at(-1);
        if (last && Math.abs(last[0].y - it.y) <= 2) last.push(it); else lines.push([it]);
      }
      for (const l0 of lines) {
        const l = l0.sort((x, z) => x.x - z.x);
        const code = l.find((i) => /^INV\.\d{6}$/.test(i.s));
        const text = l.filter((i) => i.x >= nameFrom && i.x < nameTo && !NUM.test(i.s) && !/^INV\./.test(i.s) && !/^\d\d\.\d\d\.\d{4}$/.test(i.s)).map((i) => i.s).join(" ").trim();
        const tot = /^Totale No\. Opere\s+(\d+)/.exec(text);
        if (tot) { printedCount = Number(tot[1]); continue; }
        const cells: Record<string, number> = {};
        for (const i of l) if (NUM.test(i.s) && (i.x >= nameTo || i.x < nameFrom - 40 || colOf(i).startsWith("cred"))) {
          const c = colOf(i);
          if (c in cells) fail(`investment plan p. ${p}: two values in column ${c} on the line of '${text || code?.s}'`);
          cells[c] = n(i.s);
        }
        const vals = ["credAgg", "estimated", "probU", "probE", "p27U", "p27E", "p28U", "p28E", "p29U", "p29E", "p30U", "p30E", "riepU", "riepE", "riepNet", "after30"];
        if (code) {
          if (vals.some((k) => !(k in cells))) fail(`investment plan p. ${p}: ${code.s} is missing ${vals.filter((k) => !(k in cells)).join(", ")}`);
          cur = { code: code.s, section, name: text, page: p, creditVoted: cells.credU ?? 0, credit: cells.credAgg, estimated: cells.estimated,
            prob26: cells.probU, prob26in: cells.probE, y27: cells.p27U, y28: cells.p28U, y29: cells.p29U, y30: cells.p30U,
            in27_30: cells.riepE, sum27_30: cells.riepU, net27_30: cells.riepNet, after30: cells.after30 };
          works.push(cur); tagged.push({ w: cur, group, category, kind });
        } else if (vals.every((k) => k in cells) && text) {
          if (/^INVESTIMENTI IN BENI/.test(text)) { kind = text; totals.push({ label: text, v: vals.map((k) => cells[k]), page: p, group: "*" }); }
          else if (text === text.toUpperCase()) { group = text; totals.push({ label: text, v: vals.map((k) => cells[k]), page: p, group: "G" }); }
          else { category = text; totals.push({ label: text, v: vals.map((k) => cells[k]), page: p, group: "C" }); }
          cur = null;
        } else if (cur && text && !Object.keys(cells).length) cur.name = `${cur.name} ${text}`.trim();
      }
    }
    const mine = tagged.filter((t) => t.w.section === section);
    if (!printedCount || mine.length !== printedCount) fail(`investment plan (${section}): ${mine.length} works read, ${printedCount} printed`);
    // each work: the four years add up to the summary, outgoings minus income to the net (to the rounding of 5 figures)
    for (const { w } of mine) {
      if (Math.abs(w.y27 + w.y28 + w.y29 + w.y30 - w.sum27_30) > 2) fail(`investment plan ${w.code} (p. ${w.page}): 2027–2030 do not add up to the summary`);
      if (Math.abs(w.sum27_30 - w.in27_30 - w.net27_30) > 1) fail(`investment plan ${w.code} (p. ${w.page}): summary outgoings − income ≠ net`);
      checks.works++;
    }
    // every printed total = the works under it (thousands, each row rounded: allow half a thousand per row summed)
    for (const t of totals) {
      const under = mine.filter((x) => (t.group === "*" ? x.kind === t.label : t.group === "G" ? x.group === t.label : x.category === t.label)).map((x) => x.w);
      if (!under.length) fail(`investment plan (${section}) p. ${t.page}: no works under '${t.label}'`);
      const s = ["credit", "estimated", "prob26"].map((k) => under.reduce((a, w) => a + (w as any)[k], 0));
      const tol = Math.max(1, Math.ceil(under.length / 2));
      if (s.some((v, k) => Math.abs(v - t.v[k === 2 ? 2 : k]) > tol)) fail(`investment plan (${section}) p. ${t.page}: works under '${t.label}' give ${s.join(" / ")}, printed ${t.v.slice(0, 3).join(" / ")}`);
      const yrs = [4, 6, 8, 10].map((ix, j) => under.reduce((a, w) => a + [w.y27, w.y28, w.y29, w.y30][j], 0) - t.v[ix]);
      if (yrs.some((d) => Math.abs(d) > tol) || Math.abs(under.reduce((a, w) => a + w.after30, 0) - t.v[15]) > tol) fail(`investment plan (${section}) p. ${t.page}: yearly amounts under '${t.label}' do not add up`);
      checks.totals++;
    }
  }
  return { works, checks };
}
