// Municipality register for 2024, the join key for every per-municipality star.
// Source: USTAT T_010202_020, sheet "2024": only rows that start with a 4-digit BFS number are municipalities
// (the plain "Lugano" row is the district, 155k people; the city is "5192 Lugano").

import { fail, norm, num, sheet } from "./common";

export const AGE_FILE = "ustat-T_010202_020.xlsx";
export const AGE_SHEET = "2024";

export interface Municipality {
  bfs: number;
  name: string;
  key: string;
  population: number;
  aged65plus: number;
  aged80plus: number;
  aged0to14: number;
}

export function municipalities(): Municipality[] {
  const rows = sheet(AGE_FILE, AGE_SHEET);
  const header = rows.find((r) => r.includes("Totale")) ?? fail("age header not found");
  const col = (label: string) => header.indexOf(label);
  const iTot = col("Totale"), i65 = col("65-69"), i80 = col("80 e più"), i0 = col("0-4"), i14 = col("10-14");
  if (iTot < 0 || i65 < 0 || i80 < 0 || i0 < 0 || i14 < 0) fail("age columns not found");
  const out: Municipality[] = [];
  for (const r of rows) {
    const m = String(r[0] ?? "").match(/^(\d{4}) (.+)$/);
    if (!m) continue;
    const ages = r.slice(i65, i80 + 1).map(num);
    if (ages.some((a) => a === null) || num(r[iTot]) === null) fail(`incomplete age row for ${m[2]}`);
    out.push({ bfs: Number(m[1]), name: m[2].trim(), key: norm(m[2]), population: num(r[iTot])!,
      aged65plus: (ages as number[]).reduce((s, a) => s + a, 0), aged80plus: num(r[i80])!, aged0to14: r.slice(i0, i14 + 1).reduce((a: number, c) => a + (num(c) ?? NaN), 0) });
  }
  if (out.length !== 106) fail(`expected 106 municipalities in 2024, found ${out.length}`);
  if (!out.some((m) => m.bfs === 5192)) fail("5192 Lugano missing");
  return out;
}

/** Match a name from another file (no BFS numbers there) to the register; every one must match. */
export function matcher(register: Municipality[]) {
  const byKey = new Map(register.map((m) => [m.key, m]));
  const byBfs = new Map(register.map((m) => [m.bfs, m]));
  return (name: unknown, file: string) => {
    const k = norm(name);
    return byKey.get(k) ?? (ALIASES[k] ? byBfs.get(ALIASES[k]) : undefined) ?? fail(`${file}: "${String(name)}" matches no 2024 municipality`);
  };
}

/** Spellings that differ between the canton's accounts and USTAT, checked by hand (name → BFS number). */
const ALIASES: Record<string, number> = {
  "bosco gurin": 5304, // USTAT: "5304 Bosco/Gurin"
};
