// npm run verify — checks this repository end to end, offline and without any key. It exits with 1 if any check fails.
//
//   1. sources      every archived file matches the size and SHA-256 recorded in sources/MANIFEST.json
//   2. citations    every file a figure cites is in the manifest, every archived file is cited, nothing else in sources/
//   3. upstream     files pinned from dati-di-lugano name the same commit as their URL
//   4. sums         recomputed independently of the build code: lines → groups → functions → total, centres →
//                   divisions → departments → total, functions → yearly totals, gaps and percentages
//   5. budget       in the budget-against-actual table, actual − budget = the printed difference
//   6. ranks        every rank and median among Ticino's municipalities, recomputed from the 106 values
//   7. canton rank  the canton's indicator rank and the page's rank describe the same position
//   8. printed      official figures read from a PDF: printed on the cited page(s), or the sum of printed parts
//   9. names        every Italian line, group and department name has an English name, and none is unused
//  10. hygiene      no keys, tokens, personal paths or addresses in the files of the repository
//  11. rebuild      npm run build and npm run site, run again, give byte-identical files   (skipped with --quick)
//  12. docs         SOURCES.md and FIGURES.md are what npm run docs generates                (skipped with --quick)
//  13. table        every line, group and function, and the total, on its row of the 2025 budget and accounts tables
//  14. departments  every department, division and cost centre in the 2025 accounts, through the printed arithmetic
//  15. second reader checks 8 and 13 again with pypdf, a separate PDF reader, finding columns by arithmetic alone
// npm run verify:selftest plants known errors and requires the right checks to fail (src/selftest.ts).

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { departments, figuresPrinted, functionalTable, pdfjs, pypdf } from "./pages";
import { loadSite } from "./sitedata";

const quick = process.argv.includes("--quick");
// --only=4,13 runs only those checks (used by npm run verify:selftest); the others are listed as skipped
const only = new Set((process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? []).map(Number));
const results: { n: number; name: string; ok: boolean; detail: string }[] = [];
let n = 0;
async function check(name: string, fn: () => string | Promise<string>) {
  n++;
  if (only.size && !only.has(n)) { results.push({ n, name, ok: true, detail: "skipped (--only)" }); return; }
  try { results.push({ n, name, ok: true, detail: await fn() }); }
  catch (e: any) { results.push({ n, name, ok: false, detail: e.message }); }
}
const fail = (msg: string): never => { throw new Error(msg); };
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
// Tolerances, in CHF million. Amounts are printed to the centime, so sums of printed amounts agree to a few centimes;
// set just above what rounding allows (the largest difference actually found is given for each).
const CENTIMES = 0.05e-6;   // CHF 0.05: sums of lines, groups, centres, divisions; the budget table (found: CHF 0.01)
const YEARLY = 2e-6;        // CHF 2: yearly totals printed in other documents (found: CHF 1.42, the 2024 accounts)

const manifest: any[] = JSON.parse(readFileSync("sources/MANIFEST.json", "utf8"));
const site = loadSite();                                 // both data files, joined (src/sitedata.ts)
const { D, X, EN } = site;
const catalog = JSON.parse(readFileSync("catalog/stars.json", "utf8"));

(async () => {
  await check("sources match their fingerprints", () => {
    let archived = 0, bytes = 0;
    const absent: string[] = [];
    for (const m of manifest) {
      if (!existsSync(m.file)) { if (m.archived === false) { absent.push(m.file); continue; } fail(`${m.file} is missing`); }
      const size = statSync(m.file).size;
      if (size !== m.bytes) fail(`${m.file}: ${size} bytes, manifest says ${m.bytes}`);
      if (sha(m.file) !== m.sha256) fail(`${m.file}: SHA-256 differs from the manifest`);
      archived++; bytes += size;
    }
    // names must match exactly, including case (Windows ignores case, Linux does not)
    const onDisk = new Set(readdirSync("sources"));
    const wrongCase = manifest.map((m) => m.file.replace(/^sources\//, "")).filter((f) => existsSync(`sources/${f}`) && !onDisk.has(f));
    const named = new Set<string>();
    for (const f of readdirSync("src").concat(readdirSync("src/adapters").map((x) => `adapters/${x}`))) {
      if (!f.endsWith(".ts")) continue;
      for (const m of readFileSync(`src/${f}`, "utf8").matchAll(/["'`]([\w@.\-]+\.(?:pdf|xlsx?|csv|html|json|rq))["'`]/g)) if (!/^(catalog|package)/.test(m[1])) named.add(m[1]);
    }
    const listed = new Set(manifest.map((m) => m.file.replace(/^sources\//, "")));
    const notExact = [...named].filter((f) => !listed.has(f) && [...listed].some((l) => l.toLowerCase() === f.toLowerCase()));
    if (wrongCase.length || notExact.length) fail(`file names differ in case: ${[...wrongCase, ...notExact].join(", ")}`);
    return `${archived} files, ${(bytes / 1e6).toFixed(1)} MB, all match, names exact${absent.length ? `; ${absent.length} listed but not archived` : ""}`;
  });

  await check("every cited file is archived, every archived file is cited", () => {
    const listed = new Set(manifest.map((m) => m.file)), cited = new Map<string, number>();
    const walk = (o: any): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") { if (typeof o.file === "string") cited.set(o.file, (cited.get(o.file) ?? 0) + 1); Object.values(o).forEach(walk); }
    };
    walk(site); walk(catalog);
    for (const f of ["catalog/funzioni.json", "catalog/dicasteri.json", "catalog/personale.json"]) walk(JSON.parse(readFileSync(f, "utf8")));
    const unknown = [...cited.keys()].filter((f) => !listed.has(f));
    if (unknown.length) fail(`cited but not in the manifest: ${unknown.join(", ")}`);
    const orphans = [...listed].filter((f) => !cited.has(f));
    if (orphans.length) fail(`archived but cited by no figure: ${orphans.join(", ")}`);
    // and nothing lies in sources/ that the manifest does not list
    const strays = readdirSync("sources").filter((f) => !["MANIFEST.json", "README.md"].includes(f) && !listed.has(`sources/${f}`));
    if (strays.length) fail(`in sources/ but not in the manifest: ${strays.join(", ")}`);
    return `${cited.size} files cited ${[...cited.values()].reduce((a, b) => a + b, 0)} times`;
  });

  await check("files pinned from dati-di-lugano name the commit of their URL", () => {
    const pinned = manifest.filter((m) => /dati-di-lugano@/.test(m.file));
    for (const m of pinned) {
      const commit = m.file.match(/@([0-9a-f]{7,})-/)?.[1] ?? fail(`${m.file}: no commit in the name`);
      if (!m.url.includes(`/blob/${commit}/`)) fail(`${m.file}: URL ${m.url} is not at commit ${commit}`);
    }
    return `${pinned.length} files, ${new Set(pinned.map((m) => m.file.match(/@([0-9a-f]+)-/)[1])).size} commits of github.com/nslotus/dati-di-lugano`;
  });

  await check("sums add up (recomputed here, not by the build)", () => {
    let k = 0;
    for (const f of D.fns) {
      const mine = D.lines.filter((l: any) => l.code[0] === f.code);
      for (const col of ["p25", "c25"]) { const s = mine.reduce((t: number, l: any) => t + l[col], 0); if (!close(s, f[col], CENTIMES)) fail(`function ${f.code}: lines ${col} add up to ${s}, not ${f[col]}`); k++; }
      if (f.p25 && !close(((f.c25 - f.p25) / f.p25) * 100, f.pct, 1e-9)) fail(`function ${f.code}: percentage does not recompute`);
    }
    for (const g of D.groups) {
      const kids = D.lines.filter((l: any) => l.code.length === 3 && l.code.startsWith(g.code));
      if (!kids.length) continue;
      for (const col of ["p25", "c25"]) { const s = kids.reduce((t: number, l: any) => t + l[col], 0); if (!close(s, g[col], CENTIMES)) fail(`group ${g.code}: lines ${col} add up to ${s}, not ${g[col]}`); k++; }
    }
    const fnTotal = D.fns.reduce((t: number, f: any) => t + f.c25, 0);
    const orgTotal = D.org.lines.reduce((t: number, l: any) => t + l.c25, 0);
    if (!close(fnTotal, orgTotal, CENTIMES)) fail(`functions add up to ${fnTotal}, departments to ${orgTotal}`); k++;
    for (const sl of D.org.slices) {
      const mine = D.org.lines.filter((l: any) => l.code.startsWith(sl.code));
      const s = mine.reduce((t: number, l: any) => t + l.c25, 0);
      if (!close(s, sl.c25, CENTIMES)) fail(`department ${sl.code}: centres add up to ${s}, not ${sl.c25}`); k++;
    }
    for (const g of D.org.groups) {
      const kids = D.org.lines.filter((l: any) => l.code.startsWith(g.code));
      if (kids.length && !close(kids.reduce((t: number, l: any) => t + l.c25, 0), g.c25, CENTIMES)) fail(`division ${g.code}: centres do not add up`); k++;
    }
    // the budget side too (not functions = departments: the Council's CHF 100,000 change is allocated only by department)
    for (const u of [...D.org.slices, ...D.org.groups]) {
      const kids = D.org.lines.filter((l: any) => l.code.startsWith(u.code));
      const s = kids.reduce((t: number, l: any) => t + l.p25, 0);
      if (kids.length && !close(s, u.p25, CENTIMES)) fail(`${u.code}: centres' budgets add up to ${s}, not ${u.p25}`); k++;
    }
    const totals = Object.fromEntries(X.totals.series.flatMap((s: any) => s.data.map((d: any) => [d.key, d.value])));
    for (const [key, col] of [["a2023", "c23"], ["a2024", "c24"], ["a2025", "c25"], ["b2027", "p27"]]) {
      const s = D.fns.reduce((t: number, f: any) => t + f.trend[col], 0);
      if (!close(s, totals[key], YEARLY)) fail(`functions ${col} add up to ${s}, the yearly total says ${totals[key]}`); k++;
    }
    return `${k} sums`;
  });

  await check("budget against actual: actual − budget = printed difference", () => {
    const tb = X.chapters.find((c: any) => c.id === "risultato")?.table ?? fail("chapter risultato has no table");
    let k = 0;
    for (const r of tb.rows) for (const y of tb.years) {
      const c = r.cells[y]; if (!c || c.budget == null || c.actual == null || c.diff == null) continue;
      if (!close(c.actual - c.budget, c.diff, CENTIMES)) fail(`${r.label.it} ${y}: ${c.actual} − ${c.budget} ≠ ${c.diff}`); k++;
    }
    return `${k} rows`;
  });

  await check("ranks and medians among Ticino's municipalities", () => {
    let k = 0;
    for (const s of Object.values<any>(X.stars)) {
      if (!s.cmp) continue;
      const vs = s.cmp.v.map((r: any) => r[1]) as number[], lug = s.cmp.v.find((r: any) => r[0] === "Lugano") ?? fail(`${s.id}: Lugano missing from the comparison`);
      if (vs.length !== s.cmp.of) fail(`${s.id}: ${vs.length} values, rank is out of ${s.cmp.of}`);
      if (!close(lug[1], s.value, 1e-9)) fail(`${s.id}: Lugano's comparison value differs from the figure`);
      const rank = 1 + vs.filter((v) => (s.cmp.order === "lowest-first" ? v < lug[1] : v > lug[1])).length;
      if (rank !== s.cmp.rank) fail(`${s.id}: rank recomputes to ${rank}, stored ${s.cmp.rank}`);
      const sorted = [...vs].sort((a, b) => a - b), mid = sorted.length / 2;
      const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
      if (!close(median, s.cmp.median, 1e-6)) fail(`${s.id}: median recomputes to ${median}, stored ${s.cmp.median}`);
      k++;
    }
    return `${k} figures, each against ${106} municipalities`;
  });

  await check("canton indicator rank = 106 − page rank + 1 (net debt per resident)", () => {
    const row = X.chapters.find((c: any) => c.id === "confronto").chart.rows.find((r: any) => /per abitante|pro capite/i.test(r.label.it)) ?? fail("no per-resident debt row");
    const [cr, of] = row.rank.split("/").map((x: string) => Number(x.trim()));
    const s = X.stars["finanze.debito-pro-capite"];
    if (cr !== of - s.cmp.rank + 1) fail(`canton rank ${cr}, page rank ${s.cmp.rank} of ${of}`);
    const ord = (r: number) => `${r}${r % 100 > 10 && r % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th"}`;
    return `canton ${cr}/${of} (1 = lowest debt), page ${ord(s.cmp.rank)} highest`;
  });

  await check("values read from PDF pages are printed on the cited page", async () => {
    // every official figure whose source is a PDF: printed on its cited page or pages (the whole document when the
    // locator gives none), in its unit, in thousands or in francs; a total the document does not print (a sum over a
    // list) must equal the sum of one of its series, each part printed on a cited page
    const r = await figuresPrinted(pdfjs, catalog.stars);
    if (r.missed.length) fail(`not printed as such: ${r.missed.join("; ")}`);
    return `${r.one + r.range + r.sum} figures: ${r.one} on their page, ${r.range} within their cited pages or document, ${r.sum} as the sum of its printed parts`;
  });
  await check("every name has an English name, every source an Italian one, none unused", () => {
    const need = new Set<string>([...D.lines.map((l: any) => l.label), ...D.groups.map((g: any) => g.label), ...D.org.groups.map((g: any) => g.label), ...D.org.lines.map((l: any) => l.label), ...D.org.slices.map((s: any) => s.name.it)]);
    const missing = [...need].filter((k) => !EN[k]), unused = Object.keys(EN).filter((k) => !need.has(k));
    if (missing.length || unused.length) fail(`English names missing: ${missing.join(" | ")}; unused: ${unused.join(" | ")}`);
    // every source the page can show, in Italian (translations/sources-it.json): its locator and its publisher
    const locs = new Set<string>(), pubs = new Set<string>(D.manifest.map((m: any) => m.publisher));
    const walk = (o: any): void => { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === "object") { if (typeof o.file === "string" && typeof o.locator === "string") locs.add(o.locator); if (typeof o.file === "string" && typeof o.publisher === "string") pubs.add(o.publisher); Object.values(o).forEach(walk); } };
    walk(D); walk({ ...X, srcIt: null });
    const it = X.srcIt ?? fail("the Italian sources are missing from the page's data");
    const gaps = [...[...locs].filter((l) => !it.locators[l]).map((l) => `locator "${l}"`), ...[...pubs].filter((p) => !it.publishers[p]).map((p) => `publisher "${p}"`)];
    const extra = [...Object.keys(it.locators).filter((l) => !locs.has(l)), ...Object.keys(it.publishers).filter((p) => !pubs.has(p))];
    if (gaps.length || extra.length) fail(`Italian sources missing: ${gaps.join(" | ")}; unused: ${extra.join(" | ")}`);
    return `${need.size} names in English; ${locs.size} source locators and ${pubs.size} publishers in Italian`;
  });

  await check("no keys, tokens, personal paths or addresses", () => {
    const skip = new Set(["node_modules", ".git", "sources"]);
    const files: string[] = [];
    const walk = (d: string): void => { for (const e of readdirSync(d)) { if (skip.has(e)) continue; const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js|json|md|html|css|yml|txt|svg)$|^\.[a-z]+$/.test(e)) files.push(p); } };
    walk(".");
    const patterns: [string, RegExp][] = [
      ["API key", /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|TYPESAFE_API_KEY\s*=\s*\S{8,}|-----BEGIN [A-Z ]*PRIVATE KEY)/],
      ["local path", /[A-Z]:\\Users\\|\/Users\/[a-z]+\/|\/home\/[a-z]+\//],
      ["e-mail address", /[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|proton)\.[a-z]+/i],
    ];
    const hits: string[] = [];
    for (const f of files) { const t = readFileSync(f, "utf8"); for (const [what, re] of patterns) if (re.test(t)) hits.push(`${what} in ${f}`); }
    if (existsSync(".env")) hits.push(".env present");
    if (hits.length) fail(hits.join("; "));
    return `${files.length} files scanned`;
  });

  if (quick) results.push({ n: ++n, name: "rebuild is byte-identical", ok: true, detail: "skipped (--quick)" });
  else {
    const outputs = ["catalog/stars.json", "catalog/funzioni.json", "catalog/dicasteri.json", "catalog/personale.json", "sources/MANIFEST.json", "docs/data/data.js", "docs/data/data-more.js"];
    await check("rebuild is byte-identical", () => {
      const before = Object.fromEntries(outputs.map((f) => [f, sha(f)]));
      execSync("npx tsx src/build.ts", { stdio: "ignore" });
      execSync("npx tsx src/personale.ts", { stdio: "ignore" });
      execSync("npx tsx src/site.ts", { stdio: "ignore" });
      const changed = outputs.filter((f) => sha(f) !== before[f]);
      if (changed.length) fail(`rebuilt files differ: ${changed.join(", ")}`);
      return `${outputs.length} files rebuilt from the archived sources, identical`;
    });
  }
  await check("generated docs are current, and the Italian documents match the English ones", () => {
    const docs = ["SOURCES.md", "FIGURES.md", "FONTI.md", "CIFRE.md"], before = Object.fromEntries(docs.map((f) => [f, existsSync(f) ? sha(f) : ""]));
    execSync("npx tsx src/docs.ts", { stdio: "ignore" });
    const changed = docs.filter((f) => sha(f) !== before[f]);
    if (changed.length) fail(`out of date: ${changed.join(", ")} (run npm run docs)`);
    // the hand-written pairs must be changed together: the same sections, and the same numbers (written as 1'234 in
    // Italian and 1,234 in English, so thousands separators are removed before comparing)
    const pairs = [["METHOD.md", "METODO.md"], ["README.md", "LEGGIMI.md"]];
    const heads = (t: string) => [2, 3].map((k) => (t.match(new RegExp(`^#{${k}} `, "gm")) ?? []).length).join("+");
    const nums = (t: string) => new Set(t.replace(/(\d)[,'’](?=\d{3}(?!\d))/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []);
    const bad: string[] = [];
    for (const [en, it] of pairs) {
      const a = readFileSync(en, "utf8"), b = readFileSync(it, "utf8");
      if (heads(a) !== heads(b)) bad.push(`${it} has ${heads(b)} sections, ${en} ${heads(a)}`);
      const na = nums(a), nb = nums(b), onlyEn = [...na].filter((x) => !nb.has(x)), onlyIt = [...nb].filter((x) => !na.has(x));
      if (onlyEn.length || onlyIt.length) bad.push(`${en} and ${it} differ in numbers: only in ${en}: ${onlyEn.join(" ") || "-"}; only in ${it}: ${onlyIt.join(" ") || "-"}`);
    }
    if (bad.length) fail(`${bad.join("; ")}. The English and Italian documents must be updated together.`);
    return `${docs.join(", ")} generated; ${pairs.map(([en, it]) => `${it} matches ${en}`).join(", ")}`;
  });

  await check("every line, group and function is printed on its row of the cited page", async () => {
    // the 72 lines, 43 groups, 10 functions and the City's total, in the 2025 budget and in the 2025 accounts: the
    // value in the COSTI column, found by the row's code and the column's heading; a row printed twice must read the same.
    // Lines are checked against their printed values and, through check 4's sums, against the City's printed totals.
    const r = await functionalTable(pdfjs, D, true);
    if (r.bad.length) fail(r.bad.join("; "));
    return `${r.k} values (${r.k / 2} rows × budget and actual): ${r.detail}, COSTI column`;
  });

  await check("every department, division and cost centre is printed in the 2025 accounts", async () => {
    // each centre's (or division's) own table, row 3 SPESE, read through the City's arithmetic on that row
    // (difference = actual − budget, and against 2024); departments and divisions from each department's overview table,
    // by the columns' headings
    const r = await departments(D);
    if (r.bad.length) fail(r.bad.join("; "));
    const notes = [
      r.notes.length ? `as printed: ${r.notes.join("; ")}` : "",
      r.twoReadings.length ? `${r.twoReadings.length} rows read two ways by their arithmetic alone (${r.twoReadings.join(", ")}): their divisions' printed budgets decide, through check 4` : "",
      r.derived.length ? `${r.derived.length} derived, not printed (${r.derived.join(", ")}: the rest of a division, check 4)` : "",
    ].filter(Boolean);
    return `${r.units} departments, divisions and centres (${r.nTables} from their own tables, ${r.nOverview} from the overview tables; divisions with both, in both)${notes.length ? `; ${notes.join("; ")}` : ""}`;
  });

  await check("a second, independent PDF reader (pypdf) finds the same values", async () => {
    // checks 8 and 13 again with pypdf (src/pdftext.py) instead of pdf.js, and for the table without any column
    // positions: the COSTI value of each row is the one its own arithmetic (costs − revenue = −balance) allows
    const f = await figuresPrinted(pypdf, catalog.stars), t = await functionalTable(pypdf, D, false);
    const bad = [...f.missed.map((x) => `figure ${x}`), ...t.bad];
    if (bad.length) fail(bad.join("; "));
    return `${f.one + f.range + f.sum} figures and ${t.k} table values, as with pdf.js`;
  });
  const w = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${String(r.n).padStart(2)}  ${r.name.padEnd(w)}  ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
