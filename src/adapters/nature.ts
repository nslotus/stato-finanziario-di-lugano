// Spending and revenue by type of account (gruppo) in the 2025 accounts message, pp. 41–56: every group's heading row
// prints the 2025 actual, the approved 2025 budget, their difference and %, the 2024 actual, and the difference from
// 2024. pdf.js sometimes splits a number in two ("162’80 5’730.00"); pieces are joined until a complete amount forms.
// Checks that stop the build: every row's two differences recompute; the groups add up to the printed totals of
// spending (3) and revenue (4) in all three columns; operating spending is spending without groups 34 and 39, and
// must equal the City's recap row (p. 13).

import { fail } from "./common";
import type { readPdf } from "./pdf";

export const NATURE_PAGES = { spend: [41, 49], revenue: [50, 56], recap: 13 } as const;
export const SPEND_GROUPS = ["30", "31", "33", "34", "35", "36", "37", "38", "39"] as const;
export const REVENUE_GROUPS = ["40", "41", "42", "43", "44", "45", "46", "47", "48", "49"] as const;
export type Row = { code: string; label: string; c25: number; p25: number; c24: number; page: number };

const AMOUNT = /^-?\d{1,3}(?:’\d{3})*\.\d\d$/, PCT = /^-?\d{1,3}(?:’\d{3})*\.\d\d%$/;
const chf = (s: string) => Number(s.replace(/’/g, ""));

/** The seven figures after a heading (actual, budget, diff, %, 2024, diff, %), joining split pieces. */
function figures(after: string) {
  const out: string[] = [];
  let cur = "";
  for (const tok of after.split(" ")) {
    if (!tok) continue;
    cur += tok;
    if (AMOUNT.test(cur) || PCT.test(cur)) { out.push(cur); cur = ""; if (out.length === 7) return out; }
    else if (!/^-?[\d’.]*$/.test(cur)) return null;
  }
  return null;
}

/** The first heading row of `code` printed with all seven figures on the given pages (some pages print it shorter). */
function heading(pages: string[], from: number, to: number, code: string, label: RegExp): Row {
  for (let p = from; p <= to; p++) {
    const text = pages[p - 1] ?? fail(`nature: page ${p} missing`);
    for (const m of text.matchAll(new RegExp(`(?:^| )${code.split("").join(" ?")} (${label.source}) `, "g"))) {
      const f = figures(text.slice(m.index! + m[0].length));
      if (!f) continue;
      const [c25, p25, d, , c24, d24] = [0, 1, 2, 3, 4, 5].map((i) => chf(f[i]));
      if (Math.abs(c25 - p25 - d) > 0.015 || Math.abs(c25 - c24 - d24) > 0.015) fail(`nature p. ${p}: ${code} ${c25} − ${p25} ≠ ${d} or − ${c24} ≠ ${d24}`);
      return { code, label: m[1].replace(/\s+/g, " ").trim(), c25, p25, c24, page: p };
    }
  }
  fail(`nature: heading ${code} not found on pp. ${from}–${to}`);
}

export async function nature2025(read: typeof readPdf, file: string) {
  const [s0, s1] = NATURE_PAGES.spend, [r0, r1] = NATURE_PAGES.revenue;
  const all = Array.from({ length: r1 - s0 + 1 }, (_, i) => s0 + i);
  const { pages } = await read(file, [...all, NATURE_PAGES.recap]);
  const CAPS = /[A-ZÀ-Ù][A-ZÀ-Ù' ,]*[A-ZÀ-Ù]/;
  const spend = heading(pages, s0, s1, "3", /SPESE/), revenue = heading(pages, r0, r1, "4", /RICAVI/);
  const present = (codes: readonly string[], from: number, to: number) => codes.filter((c) => pages.slice(from - 1, to).some((t) => t.includes(` ${c} `) && new RegExp(` ${c} [A-ZÀ-Ù]{2}`).test(t)));
  const groups = (codes: readonly string[], from: number, to: number) => present(codes, from, to).map((c) => heading(pages, from, to, c, CAPS));
  const sg = groups(SPEND_GROUPS, s0, s1), rg = groups(REVENUE_GROUPS, r0, r1);
  const sum = (rows: Row[], k: "c25" | "p25" | "c24") => rows.reduce((t, r) => t + r[k], 0);
  for (const [rows, tot] of [[sg, spend], [rg, revenue]] as const)
    for (const k of ["c25", "p25", "c24"] as const) if (Math.abs(sum(rows, k) - tot[k]) > 0.015) fail(`nature: groups ${rows.map((r) => r.code).join(",")} add up to ${sum(rows, k)}, total ${tot.code} is ${tot[k]} (${k})`);
  // individuals' and companies' direct taxes (lines 400 and 401)
  const line = (code: string, label: RegExp) => heading(pages, r0, r0, code, label);
  const pf = line("400", /Imposte dirette delle persone fisiche \(PF\)/), pg = line("401", /Imposte dirette delle persone giuridiche ?\(PG\)/);
  // operating spending = spending less financial spending (34) and internal charges (39), as in the recap (p. 13)
  const g = (code: string) => sg.find((r) => r.code === code) ?? fail(`nature: group ${code} missing`);
  const operating = { c25: spend.c25 - g("34").c25 - g("39").c25, p25: spend.p25 - g("34").p25 - g("39").p25, c24: spend.c24 - g("34").c24 - g("39").c24 };
  const recap = pages[NATURE_PAGES.recap - 1].match(/Spese operative (\S+) (\S+) (\S+) \S+ (\S+)/) ?? fail(`nature p. ${NATURE_PAGES.recap}: 'Spese operative' row missing`);
  const printed = { c25: chf(recap[1]), p25: chf(recap[2]), c24: chf(recap[4]) };
  for (const k of ["c25", "p25", "c24"] as const) if (Math.abs(operating[k] - printed[k]) > 0.015) fail(`nature: operating spending ${k} ${operating[k]} vs recap ${printed[k]}`);
  return { spend, revenue, spendGroups: sg, revenueGroups: rg, pf, pg, operating };
}
