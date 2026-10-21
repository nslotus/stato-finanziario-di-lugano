// Business taxes at the three levels (federal, cantonal, municipal) for Lugano.
//   municipal: ★ 401, the City's own tax from companies (canton allegato tab9d, 2024 accounts) — already a star
//   cantonal:  the canton's tax from companies located in Lugano, assessment 2023 ("Gettito di imposta cantonale dei comuni
//              – Accertamento 2023 – Imposte PG"), from the SEL table that distributes a federal-tax amount to municipalities
//   federal:   the federal direct tax paid by companies is not published per municipality (ESTV: by canton only). What reaches
//              the City is its share of the amount the canton passes on under art. 196 cpv. 1bis LIFD, in proportion to each
//              municipality's cantonal company tax: CHF 9 million in all for 2026.
// Checks: rows add up to the printed sums; the shares add up to the distributed amount and follow the company tax.

import pdf from "pdf-parse/lib/pdf-parse.js";
import { readFileSync } from "node:fs";
import type { Source, Star, Text } from "./catalog";
import { fail, num, rawPath, sheet } from "./adapters/common";
import { AGE_FILE } from "./adapters/municipalities";

export const RIPARTO = "sel-riparto-lifd196-2026-gettito2023.pdf";
const RIPARTO_URL = "https://www4.ti.ch/fileadmin/DI/DI_DI/SEL/Comuni/DatiFinanziari/TAB20260811-Riparto_9.0_mio_x_anno_2026-Gettito_2023.pdf";
type Src = (file: string, locator: string) => Source;
const n = (v: number, d = 1) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const chf = (s: string) => Number(s.replace(/'/g, ""));

async function riparto() {
  const t = (await pdf(readFileSync(rawPath(RIPARTO)))).text;
  if (!/Accertamento\s+2023\s+-\s+Imposte PG/.test(t) || !/Ripartizione per\s+comune, anno 2026/.test(t)) fail(`${RIPARTO}: headings changed`);
  const rows = [...t.matchAll(/^(\d{3})(\D+?)(-?[\d']+)\s+(-?[\d']+\.\d{2})\s*$/gm)].map((m) => ({ name: m[2].trim(), pg: chf(m[3]), share: chf(m[4]) }));
  const sum = t.match(/SOMMA([\d']+)\s+([\d']+\.\d{2})/) ?? fail(`${RIPARTO}: SOMMA row missing`);
  const [pgAll, shareAll] = [chf(sum[1]), chf(sum[2])];
  const pgSum = rows.reduce((s, r) => s + r.pg, 0), shareSum = rows.reduce((s, r) => s + r.share, 0);
  // rows the pattern skips carry no amounts: otherwise the sums would not match the printed SOMMA
  if (Math.abs(pgSum - pgAll) > 2 || Math.abs(shareSum - shareAll) > 0.05) fail(`${RIPARTO}: rows add up to ${pgSum} / ${shareSum.toFixed(2)}, SOMMA says ${pgAll} / ${shareAll}`);
  const worst = Math.max(...rows.map((r) => Math.abs(r.share - (shareAll * r.pg) / pgAll)));
  if (worst > 0.05) fail(`${RIPARTO}: shares do not follow the company tax (max deviation CHF ${worst.toFixed(2)})`);
  const lug = rows.find((r) => r.name === "LUGANO") ?? fail(`${RIPARTO}: LUGANO missing`);
  return { pg: lug.pg, share: lug.share, pgAll, shareAll };
}

function population(bfs: number, year: string) {
  const rows = sheet(AGE_FILE, year), head = rows.find((r) => r.includes("Totale")) ?? fail(`${year} age header missing`);
  const r = rows.find((x) => String(x[0] ?? "").startsWith(`${bfs} `)) ?? fail(`${year} population: ${bfs} missing`);
  return num(r[head.indexOf("Totale")]) ?? fail(`${year} population empty`);
}

export async function imposteAziende(src: Src, cityPG2024M: number) {
  const r = await riparto(), pop23 = population(5192, "2023");
  const pgM = r.pg / 1e6, shareM = r.share / 1e6, pct = (r.pg / r.pgAll) * 100;
  const stars: Star[] = [
    { id: "finanze.pg-cantone", constellation: "finanze", label: { it: "Imposta cantonale delle aziende", en: "Cantonal tax from companies" },
      about: { it: `Imposta cantonale pagata dalle aziende con sede a Lugano, secondo l'accertamento 2023 del Cantone: ${n((r.pg / pop23), 0)} franchi per abitante, il ${n(pct, 1)}% di tutta l'imposta cantonale delle aziende in Ticino. L’imposta comunale delle aziende si calcola applicando a questa imposta il moltiplicatore del Comune.`,
        en: `Cantonal tax paid by companies based in Lugano, according to the canton's 2023 assessment: CHF ${n((r.pg / pop23), 0)} per resident, ${n(pct, 1)}% of all cantonal company tax in Ticino. The municipal company tax is calculated by applying the municipality’s multiplier to this tax.` },
      value: pgM, unit: "mio CHF", year: 2023, area: "Lugano", kind: "official",
      source: [src(RIPARTO, "column 'Gettito di imposta cantonale dei comuni – Accertamento 2023 – Imposte PG', row LUGANO and SOMMA"),
        src(AGE_FILE, "sheet 2023, row '5192 Lugano', column Totale (per resident, in the text only)")],
      context: [{ label: { it: "Ticino", en: "Ticino" }, value: r.pgAll / 1e6, unit: "mio CHF" },
        { label: { it: "Imposta comunale delle aziende (conti 2024)", en: "Municipal tax from companies (2024 accounts)" }, value: cityPG2024M, unit: "mio CHF" }],
      related: ["finanze.imposte-pg"] },
    { id: "finanze.ifd-quota", constellation: "finanze", label: { it: "Quota dell'imposta federale", en: "Share of the federal tax" },
      about: { it: `Parte dell'imposta federale diretta che il Cantone riversa ai Comuni per legge federale (art. 196 cpv. 1bis LIFD), in proporzione all'imposta cantonale delle loro aziende: a Lugano vanno ${n(shareM, 2)} milioni dei ${n(r.shareAll / 1e6, 1)} distribuiti nel 2026. L'imposta federale pagata dalle aziende di Lugano non è pubblicata per comune.`,
        en: `Part of the federal direct tax that the canton passes on to municipalities under federal law (art. 196 para. 1bis DBG/LIFD), in proportion to their companies' cantonal tax: Lugano receives CHF ${n(shareM, 2)} million of the ${n(r.shareAll / 1e6, 1)} million distributed in 2026. The federal tax paid by Lugano's companies is not published per municipality.` },
      value: shareM, unit: "mio CHF", year: 2026, area: "Lugano", kind: "official",
      source: [src(RIPARTO, "column 'Ripartizione per comune, anno 2026', row LUGANO and SOMMA (CHF)")],
      context: [{ label: { it: "Distribuiti ai Comuni", en: "Distributed to municipalities" }, value: r.shareAll / 1e6, unit: "mio CHF" },
        { label: { it: "Quota di Lugano", en: "Lugano's share" }, value: (r.share / r.shareAll) * 100, unit: "%" }],
      related: ["finanze.pg-cantone"] },
  ];
  const note: Text = {
    it: `Le aziende pagano tre imposte: federale, cantonale e comunale. Quella comunale (${n(cityPG2024M, 1)} milioni nel 2024) è nei conti della Città; quella cantonale delle aziende di Lugano era di ${n(pgM, 1)} milioni nel 2023 (${n(pct, 1)}% del Ticino); di quella federale la Città riceve una quota, ${n(shareM, 2)} milioni nel 2026. L'imposta federale delle aziende non è pubblicata per comune.`,
    en: `Companies pay three taxes: federal, cantonal and municipal. The municipal one (CHF ${n(cityPG2024M, 1)} million in 2024) is in the City's accounts; the cantonal tax of Lugano's companies was CHF ${n(pgM, 1)} million in 2023 (${n(pct, 1)}% of Ticino); of the federal tax the City receives a share, CHF ${n(shareM, 2)} million in 2026. Federal company tax is not published per municipality.` };
  return { stars, note };
}

export const IMPOSTE_AZIENDE_ORIGINS: Record<string, { url: string; publisher: string }> = {
  [RIPARTO]: { url: RIPARTO_URL, publisher: "Cantone Ticino, Sezione degli enti locali – riparto art. 196 cpv. 1bis LIFD (gettito PG 2023)" },
};
