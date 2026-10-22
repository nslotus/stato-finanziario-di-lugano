// npm run verify — checks this repository end to end, offline and without any key. It exits with 1 if any check fails.
//
//   1. sources      every archived file matches the size and SHA-256 recorded in sources/MANIFEST.json
//   2. citations    every file a figure cites is in the manifest, and every archived file is cited
//   3. upstream     files pinned from dati-di-lugano name the same commit as their URL
//   4. sums         recomputed independently of the build code: lines → groups → functions → total, centres →
//                   divisions → departments → total, functions → yearly totals, gaps and percentages
//   5. budget       in the budget-against-actual table, actual − budget = the printed difference
//   6. ranks        every rank and median among Ticino's municipalities, recomputed from the 106 values
//   7. canton rank  the canton's indicator rank and the page's rank describe the same position
//   8. printed      figures read from a PDF page: the value is printed on the page the source cites
//   9. names        every Italian line, group and department name has an English name, and none is unused
//  10. hygiene      no keys, tokens, personal paths or addresses in the files of the repository
//  11. rebuild      npm run build and npm run site, run again, give byte-identical files   (skipped with --quick)
//  12. docs         SOURCES.md and FIGURES.md are what npm run docs generates                (skipped with --quick)

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readPdf } from "./adapters/pdf";

const quick = process.argv.includes("--quick");
const results: { n: number; name: string; ok: boolean; detail: string }[] = [];
let n = 0;
async function check(name: string, fn: () => string | Promise<string>) {
  n++;
  try { results.push({ n, name, ok: true, detail: await fn() }); }
  catch (e: any) { results.push({ n, name, ok: false, detail: e.message }); }
}
const fail = (msg: string): never => { throw new Error(msg); };
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

const manifest: any[] = JSON.parse(readFileSync("sources/MANIFEST.json", "utf8"));
const loadSite = () => { const s = readFileSync("docs/data/data.js", "utf8"); return JSON.parse(s.slice(s.indexOf("window.CIELO = ") + 15).replace(/;\s*$/, "")); };
const site = loadSite();
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
      for (const col of ["p25", "c25"]) { const s = mine.reduce((t: number, l: any) => t + l[col], 0); if (!close(s, f[col], 0.001)) fail(`function ${f.code}: lines ${col} add up to ${s}, not ${f[col]}`); k++; }
      if (f.p25 && !close(((f.c25 - f.p25) / f.p25) * 100, f.pct, 1e-9)) fail(`function ${f.code}: percentage does not recompute`);
    }
    for (const g of D.groups) {
      const kids = D.lines.filter((l: any) => l.code.length === 3 && l.code.startsWith(g.code));
      if (!kids.length) continue;
      for (const col of ["p25", "c25"]) { const s = kids.reduce((t: number, l: any) => t + l[col], 0); if (!close(s, g[col], 0.001)) fail(`group ${g.code}: lines ${col} add up to ${s}, not ${g[col]}`); k++; }
    }
    const fnTotal = D.fns.reduce((t: number, f: any) => t + f.c25, 0);
    const orgTotal = D.org.lines.reduce((t: number, l: any) => t + l.c25, 0);
    if (!close(fnTotal, orgTotal, 0.0001)) fail(`functions add up to ${fnTotal}, departments to ${orgTotal}`); k++;
    for (const sl of D.org.slices) {
      const mine = D.org.lines.filter((l: any) => l.code.startsWith(sl.code));
      const s = mine.reduce((t: number, l: any) => t + l.c25, 0);
      if (!close(s, sl.c25, 0.0001)) fail(`department ${sl.code}: centres add up to ${s}, not ${sl.c25}`); k++;
    }
    for (const g of D.org.groups) {
      const kids = D.org.lines.filter((l: any) => l.code.startsWith(g.code));
      if (kids.length && !close(kids.reduce((t: number, l: any) => t + l.c25, 0), g.c25, 0.0001)) fail(`division ${g.code}: centres do not add up`); k++;
    }
    const totals = Object.fromEntries(X.totals.series.flatMap((s: any) => s.data.map((d: any) => [d.key, d.value])));
    for (const [key, col] of [["a2023", "c23"], ["a2024", "c24"], ["a2025", "c25"], ["b2027", "p27"]]) {
      const s = D.fns.reduce((t: number, f: any) => t + f.trend[col], 0);
      if (!close(s, totals[key], 0.01)) fail(`functions ${col} add up to ${s}, the yearly total says ${totals[key]}`); k++;
    }
    return `${k} sums`;
  });

  await check("budget against actual: actual − budget = printed difference", () => {
    const tb = X.chapters.find((c: any) => c.id === "risultato")?.table ?? fail("chapter risultato has no table");
    let k = 0;
    for (const r of tb.rows) for (const y of tb.years) {
      const c = r.cells[y]; if (!c || c.budget == null || c.actual == null || c.diff == null) continue;
      if (!close(c.actual - c.budget, c.diff, 0.01)) fail(`${r.label.it} ${y}: ${c.actual} − ${c.budget} ≠ ${c.diff}`); k++;
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
    // a value in CHF million may be printed in francs or in thousands; every printing within its own rounding counts
    const forms = (v0: number, unit: string) => {
      const out = new Set<string>();
      const scales = /^mio CHF/.test(unit) ? [1, 1e3, 1e6] : [1];
      for (const sc of scales) for (const d of [0, 1, 2]) {
        const v = v0 * sc;
        if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) > 1e-6 * sc) continue;
        const fixed = Math.abs(v).toFixed(d);
        const [i, f] = fixed.split(".");
        for (const sep of ["'", "’", ".", " ", ""]) {
          const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
          out.add(f ? `${g}.${f}` : g); if (f) out.add(`${g},${f}`);
        }
      }
      return [...out].filter((x) => x.replace(/\D/g, "").length >= 2);
    };
    let checked = 0, found = 0;
    const missed: string[] = [], ranges: string[] = [];
    for (const s of catalog.stars) {
      // official figures read from a PDF: their first source is that PDF
      const src = s.source[0];
      if (s.kind !== "official" || !/\.pdf$/.test(src.file)) continue;
      // "p. 38", "p.28", "PDF p. 64 (book p. 116)"; a range such as "p. 5–6" or "pp. 65–66" is a sum over several pages
      // or a list, checked by the build against the document's own totals, and is counted here but not searched
      const page = src.locator?.match(/^(?:PDF )?p\.\s?(\d+)(?![–-]\d)/)?.[1];
      if (!page) { ranges.push(s.id); continue; }
      checked++;
      const { pages, items } = await readPdf(src.file.replace(/^sources\//, ""), [+page]);
      const text = (pages[+page - 1] ?? "").replace(/\s+/g, " ");
      // chart labels are sometimes laid out with spaces inside the number ("1' 7 74"): also compare each text piece of
      // the page with its spaces removed
      const pieces = new Set((items[+page - 1] ?? []).map((i) => i.s.replace(/\s/g, "")));
      const printed = forms(s.value, s.unit).some((x) => text.includes(x) || pieces.has(x));
      if (printed) found++; else missed.push(`${s.id} (${s.value} ${s.unit}, ${src.file} p. ${page})`);
    }
    if (missed.length) fail(`${found} of ${checked} found; not printed as such: ${missed.join("; ")}`);
    return `${found} of ${checked} single-page figures; ${ranges.length} more read across pages or lists (${ranges.join(", ")})`;
  });

  await check("every name has an English name, none unused", () => {
    const need = new Set<string>([...D.lines.map((l: any) => l.label), ...D.groups.map((g: any) => g.label), ...D.org.groups.map((g: any) => g.label), ...D.org.lines.map((l: any) => l.label), ...D.org.slices.map((s: any) => s.name.it)]);
    const missing = [...need].filter((k) => !EN[k]), unused = Object.keys(EN).filter((k) => !need.has(k));
    if (missing.length || unused.length) fail(`missing: ${missing.join(" | ")}; unused: ${unused.join(" | ")}`);
    return `${need.size} names`;
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

  if (quick) { results.push({ n: ++n, name: "rebuild is byte-identical", ok: true, detail: "skipped (--quick)" }); results.push({ n: ++n, name: "generated docs are current", ok: true, detail: "skipped (--quick)" }); }
  else {
    const outputs = ["catalog/stars.json", "catalog/funzioni.json", "catalog/dicasteri.json", "catalog/personale.json", "sources/MANIFEST.json", "docs/data/data.js"];
    await check("rebuild is byte-identical", () => {
      const before = Object.fromEntries(outputs.map((f) => [f, sha(f)]));
      execSync("npx tsx src/build.ts", { stdio: "ignore" });
      execSync("npx tsx src/personale.ts", { stdio: "ignore" });
      execSync("npx tsx src/site.ts", { stdio: "ignore" });
      const changed = outputs.filter((f) => sha(f) !== before[f]);
      if (changed.length) fail(`rebuilt files differ: ${changed.join(", ")}`);
      return `${outputs.length} files rebuilt from the archived sources, identical`;
    });
    await check("generated docs are current", () => {
      const docs = ["SOURCES.md", "FIGURES.md"], before = Object.fromEntries(docs.map((f) => [f, existsSync(f) ? sha(f) : ""]));
      execSync("npx tsx src/docs.ts", { stdio: "ignore" });
      const changed = docs.filter((f) => sha(f) !== before[f]);
      if (changed.length) fail(`out of date: ${changed.join(", ")} (run npm run docs)`);
      return docs.join(", ");
    });
  }

  await check("every line's budget and actual are printed on its row of the cited page", async () => {
    // The 72 lines of the page against the City's tables "ripartizione funzionale a 3 cifre": on the cited page, the row
    // that starts with the line's code must show the line's value in the COSTI column (francs, two decimals). A line
    // with no cost must have that column empty. The column is found from its heading, so a value read from RICAVI or
    // SALDO, or from the wrong row, fails.
    const docs = [
      { file: "city-preventivo-2025-messaggio.pdf", key: "p25", page: "pagesP", what: "budget" },
      { file: "city-consuntivo-2025-messaggio.pdf", key: "c25", page: "pagesC", what: "actual" },
    ];
    const francs = (parts: string[]) => { const t = parts.join("").replace(/[\s'’]/g, ""); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };
    const bad: string[] = [], pages = { p25: new Set<number>(), c25: new Set<number>() };
    let k = 0;
    for (const l of D.lines) {
      for (const d of docs) {
        const page = l[d.page];
        if (!page) { bad.push(`${l.code}: no ${d.what} page`); continue; }
        const items = (await readPdf(d.file, [page])).items[page - 1] ?? [];
        const head = (s: string) => items.find((i) => i.s === s) ?? fail(`${d.file} p. ${page}: no ${s} heading`);
        const costs = head("COSTI"), revenue = head("RICAVI"), edge = (costs.x + revenue.x) / 2;
        const rows = items.filter((i) => (i.s === l.code || i.s.startsWith(`${l.code} `)) && i.x < costs.x / 2);   // the code column, not a piece of a number
        if (rows.length !== 1) { bad.push(`${l.code}: ${rows.length} rows on ${d.file} p. ${page}`); continue; }
        const cells = items.filter((i) => Math.abs(i.y - rows[0].y) < 2.5 && i.x > rows[0].x && i.x >= costs.x - 30 && i.x < edge).sort((a, b) => a.x - b.x);
        const printed = cells.length ? francs(cells.map((i) => i.s)) : 0;
        if (!close(printed, l[d.key] * 1e6, 0.5)) bad.push(`${l.code} ${d.what}: ${l[d.key]} mio, printed ${cells.map((i) => i.s).join(" ") || "nothing"} on ${d.file} p. ${page}`);
        else { k++; pages[d.key as "p25" | "c25"].add(page); }
      }
    }
    if (bad.length) fail(bad.join("; "));
    const span = (s: Set<number>) => { const v = [...s].sort((a, b) => a - b); return v.length > 1 ? `${v[0]}–${v[v.length - 1]}` : `${v[0]}`; };
    return `${D.lines.length} lines, ${k} values: budget pp. ${span(pages.p25)}, actual pp. ${span(pages.c25)}, COSTI column`;
  });

  const w = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${String(r.n).padStart(2)}  ${r.name.padEnd(w)}  ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
