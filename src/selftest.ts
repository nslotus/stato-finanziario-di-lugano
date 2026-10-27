// npm run verify:selftest — do the checks fail when something is wrong? Each case below plants one known error in the
// repository's files, runs the checks it should trip (npm run verify --quick --only=…), and requires exactly the
// expected outcome; the files are then put back byte for byte, also if the run is interrupted. GitHub Actions runs this
// after npm run verify. It changes nothing that is committed.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

type Json = any;
const DATA = "docs/data/data.js", MORE = "docs/data/data-more.js", STARS = "catalog/stars.json", MANIFEST = "sources/MANIFEST.json";
const js = (file: string, name: string) => { const s = readFileSync(file, "utf8"); return { head: s.slice(0, s.indexOf(`window.${name} = `)), obj: JSON.parse(s.slice(s.indexOf(`window.${name} = `) + name.length + 10).replace(/;\s*$/, "")) }; };
const writeJs = (file: string, name: string, f: { head: string; obj: Json }) => writeFileSync(file, `${f.head}window.${name} = ${JSON.stringify(f.obj).replace(/<\//g, "<\\/")};\n`);
const editJs = (file: string, name: string, change: (o: Json) => void) => { const f = js(file, name); change(f.obj); writeJs(file, name, f); };
const editJson = (file: string, change: (o: Json) => void) => { const o = JSON.parse(readFileSync(file, "utf8")); change(o); writeFileSync(file, JSON.stringify(o, null, 2) + "\n"); };
const line = (o: Json, code: string) => o.D.lines.find((l: Json) => l.code === code);

type Case = { what: string; touches: string[]; fail: number[]; pass?: number[]; plant: () => void; cleanup?: string[] };
const CASES: Case[] = [
  { what: "a line's budget off by CHF 1,000 (212 Scuola elementare)", touches: [DATA], fail: [4, 13, 15], plant: () => editJs(DATA, "CIELO", (o) => { line(o, "212").p25 += 0.001; }) },
  { what: "a line's actual read from the revenue column (011 Legislativo)", touches: [DATA], fail: [4, 13, 15], plant: () => editJs(DATA, "CIELO", (o) => { line(o, "011").c25 = 0.0127136; }) },
  { what: "two lines' actuals swapped within a function: every sum still adds up", touches: [DATA], fail: [13, 15], pass: [4],
    plant: () => editJs(DATA, "CIELO", (o) => { const a = line(o, "211"), b = line(o, "212"); [a.c25, b.c25] = [b.c25, a.c25]; }) },
  { what: "a cost centre's actual off by CHF 10 (1200)", touches: [DATA], fail: [4, 14], plant: () => editJs(DATA, "CIELO", (o) => { o.D.org.lines.find((l: Json) => l.code === "1200").c25 += 0.00001; }) },
  { what: "a department's budget off by CHF 1,000 (3 Immobili)", touches: [DATA], fail: [4, 14], plant: () => editJs(DATA, "CIELO", (o) => { o.D.org.slices.find((s: Json) => s.code === "3").p25 += 0.001; }) },
  { what: "a figure read from a PDF page changed by one unit", touches: [STARS], fail: [8, 15],
    plant: () => editJson(STARS, (o) => { const s = o.stars.find((x: Json) => x.kind === "official" && /\.pdf$/.test(x.source[0].file) && /^(PDF )?p\.\s?\d+(?![–-]\d)/.test(x.source[0].locator ?? "")); s.value += 1; }) },
  { what: "a figure searched across its pages changed: 675 road accidents read as 676", touches: [STARS], fail: [8, 15],
    plant: () => editJson(STARS, (o) => { o.stars.find((x: Json) => x.id === "sicurezza.incidenti").value = 676; }) },
  { what: "a part of a printed list misread, and its total with it (planned asset sales)", touches: [STARS], fail: [8, 15],
    plant: () => editJson(STARS, (o) => { const s = o.stars.find((x: Json) => x.id === "finanze.piano-rivalorizzazioni"); s.value += 0.1; const yr = s.detail.find((d: Json) => d.chart?.series); yr.chart.series[0].data[yr.chart.series[0].data.length - 1].value += 0.1; }) },
  { what: "a new centre's budget read as empty, which its row alone allows (1213)", touches: [DATA], fail: [4], pass: [14],
    plant: () => editJs(DATA, "CIELO", (o) => { o.D.org.lines.find((l: Json) => l.code === "1213").p25 = 0; }) },
  { what: "a rank among Ticino's municipalities off by one", touches: [MORE], fail: [6], plant: () => editJs(MORE, "CIELO_MORE", (o) => { const s: Json = Object.values(o.stars).find((x: Json) => x.cmp); s.cmp.rank += 1; }) },
  { what: "a printed difference in the budget table changed", touches: [DATA], fail: [5], plant: () => editJs(DATA, "CIELO", (o) => { const tb = o.X.chapters.find((c: Json) => c.id === "risultato").table; const y = tb.years[0]; tb.rows[0].cells[y].diff += 0.01; }) },
  { what: "the canton's indicator rank changed", touches: [DATA], fail: [7], plant: () => editJs(DATA, "CIELO", (o) => { const row = o.X.chapters.find((c: Json) => c.id === "confronto").chart.rows.find((r: Json) => /per abitante|pro capite/i.test(r.label.it)); row.rank = row.rank.replace(/^\s*(\d+)/, (_: string, r: string) => String(+r - 1)); }) },
  { what: "a source shown on the Italian page without its Italian version", touches: [MORE], fail: [9], plant: () => editJs(MORE, "CIELO_MORE", (o) => { delete o.srcIt.locators[Object.keys(o.srcIt.locators)[0]]; }) },
  { what: "the Italian method not updated with the English one (a number changed in METHOD.md only)", touches: ["METHOD.md"], fail: [12],
    plant: () => writeFileSync("METHOD.md", readFileSync("METHOD.md", "utf8").replace("63,629 permanent residents", "63,630 permanent residents")) },
  { what: "an English name missing", touches: [DATA], fail: [9], plant: () => editJs(DATA, "CIELO", (o) => { delete o.EN[Object.keys(o.EN)[0]]; }) },
  { what: "a source's fingerprint not matching the archived file", touches: [MANIFEST], fail: [1], plant: () => editJson(MANIFEST, (o) => { const a = Array.isArray(o) ? o : o.files; a[0].sha256 = "0".repeat(64); }) },
  { what: "a pinned upstream file whose URL names another commit", touches: [MANIFEST], fail: [3],
    plant: () => editJson(MANIFEST, (o) => { const a = Array.isArray(o) ? o : o.files; const m = a.find((x: Json) => /dati-di-lugano@/.test(x.file)); m.url = m.url.replace(/\/blob\/[0-9a-f]+\//, "/blob/0000000/"); }) },
  { what: "a stray file in sources/", touches: [], cleanup: ["sources/stray.txt"], fail: [2], plant: () => writeFileSync("sources/stray.txt", "not in the manifest\n") },
  { what: "an API key in a file", touches: [], cleanup: ["src/_selftest.tmp.txt"], fail: [10], plant: () => writeFileSync("src/_selftest.tmp.txt", `key = "sk-${"selftest".repeat(3)}"\n`) },
];

// keep every touched file, and put it back whatever happens
const saved = new Map<string, Buffer>();
const restore = () => {
  for (const [f, b] of saved) writeFileSync(f, b);
  for (const c of CASES) for (const f of c.cleanup ?? []) if (existsSync(f)) rmSync(f);
};
process.on("exit", restore);
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(1));

const outcome = (out: string) => new Map([...out.matchAll(/^(PASS|FAIL)\s+(\d+)\s/gm)].map((m) => [Number(m[2]), m[1]]));
let failures = 0;
for (const c of CASES) {
  for (const f of c.touches) if (!saved.has(f)) saved.set(f, readFileSync(f));
  c.plant();
  const run = [...c.fail, ...(c.pass ?? [])].sort((a, b) => a - b);
  let out = "";
  try { out = execFileSync("npx", ["tsx", "src/verify.ts", "--quick", `--only=${run.join(",")}`], { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e: any) { out = e.stdout ?? ""; }
  restore();
  const got = outcome(out);
  const wrong = [...c.fail.filter((k) => got.get(k) !== "FAIL").map((k) => `check ${k} did not fail`), ...(c.pass ?? []).filter((k) => got.get(k) !== "PASS").map((k) => `check ${k} did not pass`)];
  if (wrong.length) failures++;
  console.log(`${wrong.length ? "WRONG" : "OK   "}  ${c.what.padEnd(78)} fails ${c.fail.join(", ")}${c.pass ? `; passes ${c.pass.join(", ")}` : ""}${wrong.length ? `  — ${wrong.join("; ")}` : ""}`);
}
console.log(failures ? `\n${failures} of ${CASES.length} planted errors were not caught as expected` : `\nall ${CASES.length} planted errors caught by the expected checks`);
process.exit(failures ? 1 : 0);
