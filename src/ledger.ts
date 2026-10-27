// The City total per resident, each sector's spending per resident, and the overview chapters (revenue, spending,
// result, investment, debt, bonds, interest, comparison in Ticino).
// Every number comes from an adapter; ledes are generated from those values.

import { compare, type Chapter, type Datum, type Source, type Star, type Text } from "./catalog";
import type { Municipality } from "./adapters/municipalities";
import { ALLEGATO } from "./adapters/sel";
import { fail, num, rawPath, sheet } from "./adapters/common";
import { readPdf } from "./adapters/pdf";
import { readFileSync } from "node:fs";
export const DS_PIN = "a90ca4a"; // dati-di-lugano commit with out/debt-service.json
const DEBT_SERVICE = `dati-di-lugano@${DS_PIN}-debt-service.json`;
const MOODYS_PDF = "20251027-moodys-rating.pdf";
const MOODYS_2026 = "20261026-moodys-rating.html";
const NTH: Record<string, [number, string]> = { nono: [9, "ninth"], decimo: [10, "tenth"], undicesimo: [11, "eleventh"], dodicesimo: [12, "twelfth"] };
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The latest Moody's review, read from the City's news page, and its count checked against the previous release. */
async function moodys() {
  const page = readFileSync(rawPath(MOODYS_2026), "utf8").replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&rsquo;/g, "’").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([aeiou])(grave|acute);/gi, (_, v, k) => (v + (k.toLowerCase() === "grave" ? "̀" : "́")).normalize("NFC")).replace(/\s+/g, " ");
  const re = /revisione periodica pubblicata il (\d{1,2}) (\p{L}+) (\d{4}), l.agenzia di rating Moody.s ha confermato per il (\p{L}+) anno consecutivo la propria valutazione del profilo creditizio della Città di Lugano, che mantiene il rating (A[a1-3]+) con prospettiva (stabile)/u;
  const m = page.match(re) ?? fail(`${MOODYS_2026}: the review sentence was not found`);
  const [, day, month, year, nth, rating, outlook] = m;
  const mi = MONTHS.indexOf(month), count = NTH[nth] ?? fail(`${MOODYS_2026}: unknown ordinal "${nth}"`);
  if (mi < 0) fail(`${MOODYS_2026}: unknown month "${month}"`);
  // the previous release (October 2025) gave the year before: the count must follow on
  const prev = (await readPdf(MOODYS_PDF, [1])).pages[0]?.replace(/\s+/g, " ") ?? "";
  const pm = prev.match(/per il (\p{L}+) anno consecutivo, un rating (A[a1-3]+) con prospettiva stabile/u) ?? fail(`${MOODYS_PDF}: the rating sentence was not found`);
  if ((NTH[pm[1]]?.[0] ?? -1) !== count[0] - 1 || pm[2] !== rating) fail(`Moody's: ${pm[1]} year ${pm[2]} in 2025 does not lead to ${nth} year ${rating}`);
  return { rating, outlook, nth, nthEn: count[1], dateIt: `${day} ${month} ${year}`, dateEn: `${day} ${MONTHS_EN[mi]} ${year}`, quote: m[0], prevQuote: pm[0] };
}
import { BUDGET_VS_ACTUAL, BVA_ROWS, budgetVsActual, BUDGET_PDF, BUDGET27_MSG, BUDGET27_PDF, BUDGET27_SLIDES, CITY_FIGURES, CITY_PIN, DEBT_PROFILE, INDICATORS, PIN, budget2027Phrases, budgetMultipliers, cityFigures, debtProfile, finance, indicators } from "./adapters/finance";

type Src = (file: string, locator: string) => Source;

const n = (v: number, d = 1) => v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
const FN_EN: Record<number, string> = { 0: "General administration", 1: "Public order and safety", 2: "Education", 3: "Culture, sport, leisure, church",
  4: "Health", 5: "Social security", 6: "Transport and communications", 7: "Environment and land", 8: "Public economy", 9: "Finance and taxes" };
const REV_EN: Record<string, string> = { "40": "Taxes", "41": "Royalties and concessions", "42": "Fees and charges", "43": "Other revenue",
  "44": "Financial revenue", "45": "Drawings from funds", "46": "Transfers received", "48": "Extraordinary revenue" };
const RATING_EN: Record<string, string> = { "molto elevato": "very high", eccessivo: "excessive", debole: "weak", disavanzo: "deficit", bassa: "low",
  media: "average", buona: "good", avanzo: "surplus", basso: "low", medio: "medium", elevato: "high" };
const ord = (k: number) => `${k}°`;
/** Italian article before a percentage: l'8%, l'11%, il 12% */
const ilPct = (p: number) => (/^(8|11)(D|$)/.test(String(p)) ? `l'${p}%` : `il ${p}%`);
const alPct = (p: number) => (/^(8|11)(D|$)/.test(String(p)) ? `all'${p}%` : `al ${p}%`);

export async function ledger(register: Municipality[], population: Map<number, number>, src: Src) {
  const fin = finance(register);
  const mp2026 = await budgetMultipliers();
  const p27 = await budget2027Phrases();
  const mo = await moodys();
  const city = cityFigures();
  const debt = debtProfile();
  const ind = indicators();
  const pop = (bfs: number) => population.get(bfs)!;
  const name = (bfs: number) => register.find((m) => m.bfs === bfs)!.name;
  const lugSpend = fin.spend.get(5192)!;
  const totalM = lugSpend.reduce((s, v) => s + v, 0) / 1000;

  const perResident = (pick: (v: number[]) => number) => compare([...fin.spend].map(([bfs, v]) => ({
    bfs, name: name(bfs), value: (pick(v) * 1000) / pop(bfs), population: pop(bfs) })), "CHF / abitante", "highest-first");
  const fnSrc = (code: string) => [src(ALLEGATO, `sheet tab9e, row 'Spese' of each municipality, column ${code} (CHF thousands, gross)`),
    src(ALLEGATO, "sheet tab8, column 'Popolazione residente al 31.12.2024'")];
  const method: Text = { it: "Spesa lorda del comune (conto economico 2024) divisa per la popolazione al 31.12.2024.",
    en: "The municipality's gross spending (2024 accounts) divided by its population at 31.12.2024." };

  // ---- stars: the sun and the sector anchors ----
  const sun = perResident((v) => v.reduce((s, x) => s + x, 0));
  const anchor = (code: number, constellation: Star["constellation"], id: string, label: Text, about: Text): Star => {
    const c = perResident((v) => v[code]);
    return { id, constellation, label, about, value: c.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived",
      method, source: fnSrc(`${code} '${fin.functions[code].label}'`), comparison: c, related: ["bilancio.spesa"] };
  };
  // Tax from individuals as the amount the City collects. Not divided by residents (taxes are paid by taxpayers, not by
  // every resident) and not ranked against other municipalities (each sets its own multiplier); the comparison across
  // municipalities per taxpayer is the federal tax star (finanze.contribuente).
  const individualTax = (): Star => {
    const t = fin.taxes.get(5192)!, pfM = t.pf / 1000, pgM = t.pg / 1000, share = (t.pf / (t.pf + t.pg)) * 100;
    return { id: "finanze.imposte-pf", constellation: "finanze", label: { it: "Imposte delle persone fisiche", en: "Taxes from individuals" },
      about: { it: `Imposte dirette sul reddito e sulla sostanza pagate alla Città dalle persone fisiche nel 2024: ${n(pfM)} milioni di franchi, ${ilPct(Math.round(share))} delle imposte dirette comunali; le aziende ne hanno versate ${n(pgM)} milioni. La Città le incassa applicando il suo moltiplicatore (${fin.mp2025.pf}% nel 2025) all'imposta cantonale.`,
        en: `Direct taxes on income and wealth paid to the City by individuals in 2024: CHF ${n(pfM)} million, ${Math.round(share)}% of municipal direct taxes; companies paid CHF ${n(pgM)} million. The City collects them by applying its multiplier (${fin.mp2025.pf}% in 2025) to the cantonal tax.` },
      value: pfM, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: "Conto 400 «imposte dirette delle persone fisiche» del conto economico 2024 della Città, come pubblicato dalla Sezione degli enti locali. La cifra non è divisa per gli abitanti, perché le imposte le pagano i contribuenti e non tutti gli abitanti (bambini, persone senza reddito imponibile), e non è confrontata con gli altri comuni, perché ogni comune fissa il proprio moltiplicatore. Il confronto fra comuni per contribuente è nella stella dell'imposta federale diretta.",
        en: "Account 400 'direct taxes from individuals' in the City's 2024 accounts, as published by the cantonal Local Authorities Section. The figure is not divided by residents, because taxes are paid by taxpayers and not by every resident (children, people without taxable income), and it is not compared with other municipalities, because each municipality sets its own multiplier. The comparison between municipalities per taxpayer is in the federal direct tax star." },
      source: [src(ALLEGATO, "sheet tab9d, columns 400 and 401, row 'Lugano' (CHF thousands)"), src(ALLEGATO, "sheet tab8, multipliers 2025")],
      context: [{ label: { it: "Imposte delle aziende (401)", en: "Taxes from companies (401)" }, value: pgM, unit: "mio CHF" },
        { label: { it: "Quota delle imposte dirette", en: "Share of direct taxes" }, value: share, unit: "%" },
        { label: { it: "Moltiplicatore persone fisiche 2025", en: "Individual tax multiplier 2025" }, value: fin.mp2025.pf, unit: "%" }],
      related: ["bilancio.spesa", "finanze.imposte-pg", "finanze.contribuente"] };
  };
  // Company tax as the amount the City receives: companies are not residents, so the figure is not divided by the
  // population, and it is not ranked against other municipalities.
  const companyTax = (): Star => {
    const t = fin.taxes.get(5192)!, pgM = t.pg / 1000, pfM = t.pf / 1000, share = (t.pg / (t.pf + t.pg)) * 100;
    return { id: "finanze.imposte-pg", constellation: "finanze", label: { it: "Imposte delle persone giuridiche", en: "Taxes from companies" },
      about: { it: `Imposte dirette pagate alla Città dalle persone giuridiche (SA, Sagl, cooperative e altre società) nel 2024: ${n(pgM)} milioni di franchi, ${ilPct(Math.round(share))} delle imposte dirette comunali; le persone fisiche ne hanno versate ${n(pfM)} milioni.`,
        en: `Direct taxes paid to the City by legal persons (SA, Sagl, cooperatives and other companies) in 2024: CHF ${n(pgM)} million, ${Math.round(share)}% of municipal direct taxes; individuals paid CHF ${n(pfM)} million.` },
      value: pgM, unit: "mio CHF", year: 2024, area: "Lugano", kind: "official",
      method: { it: "Conto 401 «imposte dirette delle persone giuridiche» del conto economico 2024 della Città, come pubblicato dalla Sezione degli enti locali. La cifra non è divisa per gli abitanti, perché le aziende non sono abitanti, e non è confrontata con gli altri comuni.",
        en: "Account 401 'direct taxes from legal persons' in the City's 2024 accounts, as published by the cantonal Local Authorities Section. The figure is not divided by residents, because companies are not residents, and it is not compared with other municipalities." },
      source: [src(ALLEGATO, "sheet tab9d, columns 400 and 401, row 'Lugano' (CHF thousands)"), src(ALLEGATO, "sheet tab8, multipliers 2025")],
      context: [{ label: { it: "Imposte delle persone fisiche (400)", en: "Taxes from individuals (400)" }, value: pfM, unit: "mio CHF" },
        { label: { it: "Quota delle imposte dirette", en: "Share of direct taxes" }, value: share, unit: "%" },
        { label: { it: "Moltiplicatore persone giuridiche 2025", en: "Company tax multiplier 2025" }, value: fin.mp2025.pg, unit: "%" }],
      related: ["bilancio.spesa", "finanze.imposte-pf"] };
  };

  const stars: Star[] = [
    { id: "bilancio.spesa", constellation: "bilancio", label: { it: "Bilancio della città", en: "City budget" },
      about: { it: "La spesa lorda totale della Città, per abitante: il centro attorno a cui girano tutti i settori.",
        en: "The City's total gross spending per resident: the centre that every sector orbits." },
      value: sun.lugano.value, unit: "CHF / abitante", year: 2024, area: "Lugano", kind: "derived", method,
      source: fnSrc("0–9 (sum of all functions)"), comparison: sun,
      related: ["salute.spesa", "istruzione.spesa", "trasporti.spesa", "economia.spesa", "sociale.spesa", "cultura.spesa", "sicurezza.spesa", "ambiente.spesa", "finanze.debito-pro-capite", "finanze.imposte-pf"] },
    anchor(2, "istruzione", "istruzione.spesa", { it: "Spesa per la formazione", en: "Education spending" },
      { it: "Spesa comunale per la formazione (scuole comunali e servizi collegati), per abitante: il centro della costellazione istruzione.",
        en: "Municipal spending on education (municipal schools and related services), per resident: the centre of the education constellation." }),
    anchor(1, "sicurezza", "sicurezza.spesa", { it: "Spesa per la sicurezza pubblica", en: "Public safety spending" },
      { it: "Spesa comunale per ordine pubblico, sicurezza e difesa (polizia, pompieri, protezione civile, servizi giuridici), per abitante: il centro della costellazione sicurezza. Una parte serve anche i comuni vicini.",
        en: "Municipal spending on public order, safety and defence (police, fire service, civil protection, legal services), per resident: the centre of the safety constellation. Part of it also serves neighbouring municipalities." }),
    anchor(7, "ambiente", "ambiente.spesa", { it: "Spesa per ambiente e territorio", en: "Environment and land spending" },
      { it: "Spesa comunale per ambiente e territorio (acque di scarico, rifiuti, energia, pianificazione), per abitante: il centro della costellazione ambiente. Acque di scarico e rifiuti sono pagati quasi interamente dalle tasse per il servizio.",
        en: "Municipal spending on environment and land (wastewater, waste, energy, planning), per resident: the centre of the environment constellation. Wastewater and waste are paid almost entirely by service fees." }),
    anchor(3, "cultura", "cultura.spesa", { it: "Spesa per cultura e sport", en: "Culture and sport spending" },
      { it: "Spesa comunale per cultura, sport, tempo libero e chiesa, per abitante: il centro della costellazione cultura e sport.",
        en: "Municipal spending on culture, sport, leisure and church, per resident: the centre of the culture and sport constellation." }),
    anchor(5, "sociale", "sociale.spesa", { it: "Spesa per la sicurezza sociale", en: "Social security spending" },
      { it: "Spesa comunale per la sicurezza sociale (contributi ai regimi cantonali, assistenza, famiglie e giovani), per abitante: il centro della costellazione socialità.",
        en: "Municipal spending on social security (contributions to cantonal schemes, social assistance, families and youth), per resident: the centre of the social constellation." }),
    anchor(6, "trasporti", "trasporti.spesa", { it: "Spesa per trasporti e comunicazioni", en: "Transport spending" },
      { it: "Spesa comunale per trasporti e comunicazioni (strade, trasporto pubblico), per abitante: il centro della costellazione trasporti.",
        en: "Municipal spending on transport and communications (roads, public transport), per resident: the centre of the transport constellation." }),
    anchor(8, "economia", "economia.spesa", { it: "Spesa per l'economia pubblica", en: "Public economy spending" },
      { it: "Spesa comunale per l'economia pubblica (turismo, industria e commercio, energia, agricoltura), per abitante.",
        en: "Municipal spending on the public economy (tourism, industry and commerce, energy, agriculture), per resident." }),
    individualTax(),
    companyTax(),
  ];
  const S = Object.fromEntries(stars.map((s) => [s.id, s]));
  const rankText = (s: Star) => ({ it: `${ord(s.comparison!.lugano.rank)} su ${s.comparison!.lugano.of} comuni ticinesi (mediana ${n(s.comparison!.median, 0)} CHF)`,
    en: `rank ${s.comparison!.lugano.rank} of Ticino's ${s.comparison!.lugano.of} municipalities (median CHF ${n(s.comparison!.median, 0)})` });

  // ---- chapters ----
  const allegatoTab = (t: string) => src(ALLEGATO, `sheet ${t}, row 'Lugano'`);
  const cityPdfSrc = (kind: string, year: number) => {
    const file = kind === "preventivo" ? (year === 2027 ? BUDGET27_PDF : BUDGET_PDF) : CITY_FIGURES;
    return src(file, kind === "preventivo" ? "press release, p. 1–3" : `results[${kind} ${year}] (extracted from the city's PDF; see Dati di Lugano TRACE.md)`);
  };

  const fiscal = fin.revenue.find((r) => r.code === "40")!.value, revTotal = fin.revenue.reduce((s, r) => s + r.value, 0);
  const pf = fin.taxes.get(5192)!.pf / 1000, pg = fin.taxes.get(5192)!.pg / 1000;
  const fnRows: Datum[] = fin.functions.map((f, i) => ({ key: `f${f.code}`, label: { it: `${f.code} ${f.label}`, en: `${f.code} ${FN_EN[f.code]}` },
    value: lugSpend[i] / 1000, status: "actual",
    star: ({ 1: "sicurezza.spesa", 2: "istruzione.spesa", 3: "cultura.spesa", 4: "salute.spesa", 5: "sociale.spesa", 6: "trasporti.spesa", 7: "ambiente.spesa", 8: "economia.spesa" } as Record<number, string>)[f.code] }));
  const topFn = [...fnRows].sort((a, b) => b.value - a.value).slice(0, 3);

  const y23 = ind.years.find((y: any) => y.year === 2023), y24 = ind.years.find((y: any) => y.year === 2024);
  const ce23 = (re: RegExp) => (Object.entries(y23.contoEconomico).find(([k]) => re.test(k))![1] as number) / 1000;
  const r2023 = ce23(/TOTALE/), extra2023 = ce23(/^Ricavi straordinari/), ordinary2023 = ce23(/ORDINARIO/);
  const r2024 = city("consuntivo", 2024, "risultatoTotaleEsercizio"), r2025 = city("consuntivo", 2025, "risultatoTotaleEsercizio");
  const b2026 = city("preventivo", 2026, "risultatoEsercizio");
  const b2027 = city("preventivo", 2027, "risultatoEsercizio"), plan2027 = city("preventivo", 2027, "disavanzoPrevistoPiano");
  const g27 = (k: string) => city("preventivo", 2027, k).value;
  const bva = budgetVsActual();
  // the deck's recap actual must equal the figure already used for the same year
  for (const y of [2024, 2025]) if (Math.abs(bva(y, "risultatoTotaleEsercizio").actual - (y === 2024 ? r2024 : r2025).value) > 0.000001)
    throw new Error(`DATA CHECK FAILED: ${y} result in budget-vs-actual differs from city figures`);
  const better = (y: number) => bva(y, "risultatoTotaleEsercizio").diff;
  const results: Datum[] = [
    { key: "r2023", label: { it: "2023", en: "2023" }, value: r2023, status: "actual",
      note: { it: `comprende ${n(extra2023)} mio di ricavi straordinari`, en: `includes CHF ${n(extra2023)}M of one-off revenue` } },
    { key: "r2024", label: { it: "2024", en: "2024" }, value: r2024.value, status: "actual" },
    { key: "r2025", label: { it: "2025", en: "2025" }, value: r2025.value, status: "actual" },
    { key: "r2026", label: { it: "2026 preventivo", en: "2026 budget" }, value: b2026.value, status: "budget" },
    { key: "r2027", label: { it: "2027 preventivo", en: "2027 budget" }, value: b2027.value, status: "budget" },
  ];

  const inv = (k: "consuntivo" | "preventivo", y: number) => k === "consuntivo"
    ? { net: city(k, y, "onereNettoInvestimenti").value, self: city(k, y, "autofinanziamento").value }
    : { net: city(k, y, "investimentiNetti").value, self: city(k, y, "autofinanziamento").value };
  const i24 = inv("consuntivo", 2024), i25 = inv("consuntivo", 2025), i27 = inv("preventivo", 2027);
  // 2026: the 2027 message's restated figures (262.4), which the financial plan (262'398'000) and the 2026 overall result
  // (21.6 − 262.4 = −240.8) agree with; the 2026 release's 263.5 does not, and is given in the note
  const rel26 = inv("preventivo", 2026), i26 = { net: p27.inv2026.net, self: p27.inv2026.self };
  if (Math.abs(rel26.self - i26.self) > 0.05) fail(`ledger: 2026 self-financing, release ${rel26.self} vs 2027 message ${i26.self}`);
  const pct = (a: number, b: number) => Math.round((a / b) * 100);

  const snap = (l: string) => debt.snapshots.find((s: any) => s.label === l);
  const path: Datum[] = [
    { key: "d2024", label: { it: "fine 2024", en: "end 2024" }, value: snap("end 2024").grossDebt.M, status: "actual", date: "2024-12-31" },
    { key: "d2025", label: { it: "fine 2025", en: "end 2025" }, value: snap("end 2025").grossDebt.M, status: "actual", date: "2025-12-31" },
    { key: "dq1", label: { it: "1° trim. 2026", en: "Q1 2026" }, value: snap("Q1 2026").grossDebt.M, status: "actual", date: "2026-03-31" },
    ...debt.plan.debtPath.filter((p: any) => p.label !== "end 2025 (actual)").map((p: any) => ({
      key: `p${p.label.replace(/\W+/g, "")}`, date: `${p.year}-12-31`, value: p.M,
      status: /implied/.test(p.label) ? "estimate" : "plan",
      label: /implied/.test(p.label) ? { it: "fine 2026 (stima dal preventivo)", en: "end 2026 (estimate from budget)" }
        : /peak/.test(p.label) ? { it: `${p.year} picco del piano`, en: `${p.year} plan peak` }
        : /end of plan/.test(p.label) ? { it: `${p.year} fine piano`, en: `${p.year} end of plan` } : { it: `fine ${p.year} (piano)`, en: `end ${p.year} (plan)` } } as Datum)),
  ];
  const peak = path.find((p) => /peak/.test(p.label.en))!, last = path[path.length - 1];
  const book = debt.today;

  // bond interest and repayments (computed in dati-di-lugano from the bond terms)
  const ds = JSON.parse(readFileSync(rawPath(DEBT_SERVICE), "utf8"));
  if (ds.today.bondCount !== book.bondCount || ds.today.outstandingM !== book.outstandingM) fail("debt service and debt profile disagree on the bond book");
  // independent check: account 340 read here from the canton annex must equal the figure used in dati-di-lugano
  const t9c = sheet(ALLEGATO, "tab9c");
  const i340 = t9c.find((r) => r.some((c) => /^340/.test(String(c))))!.findIndex((c) => /^340/.test(String(c)));
  const exp340 = (num(t9c.find((r) => String(r[0]).trim() === "Lugano")![i340]) ?? NaN) / 1000;
  if (Math.abs(exp340 - ds.accounts2024.interestExpenseM) > 0.001) fail(`account 340: annex ${exp340} vs debt service ${ds.accounts2024.interestExpenseM}`);
  if (ds.accounts2024.bondInterestAccruedM > exp340) fail("2024 bond interest exceeds interest expense");
  const yearNow = Number(ds.asOf.slice(0, 4));
  // the City's own interest on short- and long-term debt (account 3401) must cover the bond interest in the same year
  const acc = (y: number) => ds.byYear.find((r: any) => r.year === y).interestAccruedM;
  if (acc(2025) > p27.interest3401.c2025 || acc(2027) > p27.interest3401.p2027) fail("bond interest exceeds account 3401");
  const dsRows = ds.byYear.filter((r: any) => r.year <= 2036);
  const latest = [...ds.bonds].filter((b: any) => b.listed).sort((a: any, b: any) => b.listed.localeCompare(a.listed))[0];
  const next = ds.byYear.find((r: any) => r.year >= yearNow && r.redemptionM > 0);
  const nextBond = ds.bonds.find((b: any) => b.maturity.startsWith(String(next.year)) && b.volumeM === next.redemptionM);
  if (!nextBond) fail("next maturing bond not found");
  const refiDelta = (nextBond.volumeM * (latest.coupon - nextBond.coupon)) / 100;
  const repayList = (en: boolean) => ds.byYear.filter((r: any) => r.redemptionM && r.year >= yearNow)
    .map((r: any) => (en ? `${r.year} CHF ${n(r.redemptionM, 0)}M` : `${r.year} ${n(r.redemptionM, 0)} mio`)).join(", ");
  const interestStar: Star = { id: "finanze.interessi", constellation: "finanze", label: { it: "Interessi sulle obbligazioni", en: "Interest on bonds" },
    about: { it: `Interessi che la Città paga ogni anno sulle sue ${ds.today.bondCount} obbligazioni (${n(ds.today.outstandingM, 0)} milioni), con una cedola media dello ${n(ds.today.averageCouponPct, 2)}%. Nei conti 2024 gli interessi passivi erano ${n(exp340, 2)} milioni, di cui ${n(ds.accounts2024.bondInterestAccruedM, 2)} sulle obbligazioni; il resto riguarda prestiti bancari e altri debiti.`,
      en: `Interest the City pays each year on its ${ds.today.bondCount} bonds (CHF ${n(ds.today.outstandingM, 0)} million), at an average coupon of ${n(ds.today.averageCouponPct, 2)}%. In the 2024 accounts interest expense was CHF ${n(exp340, 2)} million, of which ${n(ds.accounts2024.bondInterestAccruedM, 2)} on bonds; the rest is bank loans and other debt.` },
    value: ds.today.annualInterestM, unit: "mio CHF / anno", year: yearNow, area: "Lugano", kind: "derived",
    method: { it: `Somma di volume × cedola delle obbligazioni in circolazione al ${ds.asOf}, dalle condizioni dei titoli (nessun dato di mercato). Le cifre 2024 confrontano gli interessi maturati sulle obbligazioni con il conto 340 «spese per interessi».`,
      en: `Sum of volume × coupon of the bonds outstanding on ${ds.asOf}, from the bond terms (no market data). The 2024 figures compare interest accrued on bonds with account 340 'spese per interessi'.` },
    source: [src(DEBT_SERVICE, "today.annualInterestM and accounts2024 (computed from the bond register of Dati di Lugano)"),
      src(ALLEGATO, "sheet tab9c, column 340 'spese per interessi', row 'Lugano' (CHF thousands)")],
    context: [{ label: { it: "Per abitante", en: "Per resident" }, value: (ds.today.annualInterestM * 1e6) / pop(5192), unit: "CHF / anno" },
      { label: { it: "Cedola media", en: "Average coupon" }, value: ds.today.averageCouponPct, unit: "%" },
      { label: { it: "Interessi nei conti 2024", en: "Interest expense 2024" }, value: exp340, unit: "mio CHF" },
      { label: { it: "di cui obbligazioni (2024)", en: "of which bonds (2024)" }, value: ds.accounts2024.bondInterestAccruedM, unit: "mio CHF" }],
    related: ["finanze.obbligazioni"] };
  stars.push(interestStar);

  const chapters: Chapter[] = [
    { id: "bilancio", n: 0, title: { it: "Il bilancio in breve", en: "The budget in brief" }, stars: ["bilancio.spesa"],
      lede: { it: `Nel 2024 la Città ha speso ${n(totalM)} milioni di franchi (spesa lorda), cioè ${n(S["bilancio.spesa"].value, 0)} CHF per abitante: ${rankText(S["bilancio.spesa"]).it}.`,
        en: `In 2024 the City spent CHF ${n(totalM)} million (gross), or CHF ${n(S["bilancio.spesa"].value, 0)} per resident: ${rankText(S["bilancio.spesa"]).en}.` },
      chart: { type: "kpi", value: totalM, unit: "mio CHF", sub: { it: `${n(S["bilancio.spesa"].value, 0)} CHF per abitante · 2024`, en: `CHF ${n(S["bilancio.spesa"].value, 0)} per resident · 2024` } },
      source: fnSrc("0–9 (sum)") },
    { id: "entrate", n: 1, title: { it: "Entrate: da dove arriva il denaro", en: "Money in" }, stars: ["finanze.imposte-pf", "finanze.imposte-pg", "finanze.contribuente"],
      lede: { it: `Le imposte portano ${n(fiscal / 1000)} dei ${n(revTotal / 1000)} milioni di ricavi (${pct(fiscal, revTotal)}%). Le persone fisiche versano ${n(pf)} milioni, le aziende ${n(pg)} milioni.`,
        en: `Taxes bring in CHF ${n(fiscal / 1000)} million of CHF ${n(revTotal / 1000)} million revenue (${pct(fiscal, revTotal)}%). Individuals pay CHF ${n(pf)} million, companies CHF ${n(pg)} million.` },
      chart: { type: "hbars", unit: "mio CHF", data: fin.revenue.filter((r) => r.value > 0).map((r) => ({ key: `r${r.code}`, label: { it: `${r.code} ${r.label}`, en: `${r.code} ${REV_EN[r.code] ?? r.label}` }, value: r.value / 1000, status: "actual",
        star: r.code === "40" ? "finanze.imposte-pf" : undefined })) },
      notes: [{ it: `Moltiplicatore d'imposta: ${fin.mp2025.pf}% per le persone fisiche e ${fin.mp2025.pg}% per le aziende nel 2025; ${mp2026.pf}% e ${mp2026.pg}% nel preventivo 2026, ${p27.pf}% e ${p27.pg}% nel preventivo 2027.`,
        en: `Tax multiplier: ${fin.mp2025.pf}% for individuals and ${fin.mp2025.pg}% for companies in 2025; ${mp2026.pf}% and ${mp2026.pg}% in the 2026 budget, ${p27.pf}% and ${p27.pg}% in the 2027 budget.` },
        { it: `Preventivo 2027: gettito delle persone fisiche ${n(g27("gettitoPF"))} milioni, delle persone giuridiche ${n(g27("gettitoPG"))} milioni, su un fabbisogno da coprire con le imposte di ${n(g27("fabbisognoImposte"))} milioni.`,
          en: `2027 budget: tax revenue of CHF ${n(g27("gettitoPF"))} million from individuals and CHF ${n(g27("gettitoPG"))} million from companies, against CHF ${n(g27("fabbisognoImposte"))} million to be covered by taxes.` }],
      source: [allegatoTab("tab9b (CHF thousands; excludes 47 pass-through and 49 internal)"), allegatoTab("tab9d, columns 400–401"), allegatoTab("tab8, multipliers 2025"),
        src(BUDGET_PDF, `p. 2: "${mp2026.quote}"`), cityPdfSrc("preventivo", 2027), src(BUDGET27_PDF, `p. 1: "${p27.mpQuote}"`)] },
    { id: "uscite", n: 2, title: { it: "Uscite: dove va il denaro", en: "Money out, by sector" }, stars: ["salute.spesa", "istruzione.spesa", "cultura.spesa", "sicurezza.spesa", "ambiente.spesa", "sociale.spesa", "trasporti.spesa", "economia.spesa"],
      lede: { it: `Le voci maggiori sono ${topFn.map((f) => `${f.label.it.replace(/^\d /, "").toLowerCase()} (${n(f.value)} mio)`).join(", ")}. Ogni barra con una stella porta alla sua costellazione.`,
        en: `The largest items are ${topFn.map((f) => `${f.label.en.replace(/^\d /, "").toLowerCase()} (CHF ${n(f.value)}M)`).join(", ")}. Each bar with a star leads to its constellation.` },
      chart: { type: "hbars", unit: "mio CHF", data: fnRows }, source: [allegatoTab("tab9e, row 'Spese' (CHF thousands, gross; functions 0–9)")] },
    { id: "risultato", n: 3, title: { it: "Il risultato d'esercizio", en: "The operating result" }, stars: ["bilancio.spesa"],
      lede: { it: `Dopo il disavanzo di ${n(-r2024.value)} milioni nel 2024, il 2025 si è chiuso con un avanzo di ${n(r2025.value)} milioni. Rispetto al preventivo il risultato è stato migliore di ${n(better(2024))} milioni nel 2024 e di ${n(better(2025))} milioni nel 2025, quando i ricavi operativi hanno superato le attese di ${n(bva(2025, "ricaviOperativi").diff)} milioni. Il preventivo 2026 prevede ${b2026.value < 0 ? "un disavanzo" : "un avanzo"} di ${n(Math.abs(b2026.value))} milioni, quello 2027 un disavanzo di ${n(-b2027.value)} milioni, ${n(b2027.value - plan2027.value)} milioni meno di quanto previsto dal piano finanziario (${n(-plan2027.value)}).`,
        en: `After a CHF ${n(-r2024.value)} million deficit in 2024, 2025 closed with a CHF ${n(r2025.value)} million surplus. Against the budget, the result was CHF ${n(better(2024))} million better in 2024 and CHF ${n(better(2025))} million better in 2025, when operating revenue beat the budget by CHF ${n(bva(2025, "ricaviOperativi").diff)} million. The 2026 budget plans ${b2026.value < 0 ? "a deficit" : "a surplus"} of CHF ${n(Math.abs(b2026.value))} million, the 2027 budget a deficit of CHF ${n(-b2027.value)} million, ${n(b2027.value - plan2027.value)} million less than the financial plan foresaw (${n(-plan2027.value)}).` },
      chart: { type: "columns", unit: "mio CHF", series: [
        { label: { it: "Consuntivo", en: "Actual" }, data: results.filter((d) => d.status === "actual").map((d) => ({ ...d, key: "a" + d.key.slice(1) })) },
        { label: { it: "Preventivo", en: "Budget" }, data: [
          ...[2024, 2025].map((y) => ({ key: `b${y}`, label: { it: `${y}`, en: `${y}` }, value: bva(y, "risultatoTotaleEsercizio").budget, status: "budget" as const })),
          { key: "b2026", label: { it: "2026", en: "2026" }, value: b2026.value, status: "budget" as const },
          { key: "b2027", label: { it: "2027", en: "2027" }, value: b2027.value, status: "budget" as const }] }] },
      table: { years: [2024, 2025], rows: BVA_ROWS.map((k) => ({ label: bva(2025, k).label,
        cells: Object.fromEntries([2024, 2025].map((y) => [String(y), { budget: bva(y, k).budget, actual: bva(y, k).actual, diff: bva(y, k).diff }])) })) },
      notes: [{ it: "Presentando il preventivo 2027 (ottobre 2026), la Città indica che il 2026 dovrebbe chiudersi con un risultato totale positivo, contro il disavanzo a preventivo.",
          en: "Presenting the 2027 budget (October 2026), the City says 2026 is expected to close with a positive total result, against the budgeted deficit." },
        { it: `Il risultato 2023 è sostenuto da ${n(extra2023)} milioni di ricavi straordinari: il risultato ordinario è stato di ${n(ordinary2023)} milioni.`,
        en: `The 2023 result rests on CHF ${n(extra2023)} million of one-off revenue: the ordinary result was CHF ${n(ordinary2023)} million.` }],
      source: [src(INDICATORS, "years[2023].contoEconomico (canton accounts 2023)"), cityPdfSrc("consuntivo", 2024), cityPdfSrc("consuntivo", 2025), cityPdfSrc("preventivo", 2026), cityPdfSrc("preventivo", 2027),
        src(BUDGET27_SLIDES, `p. ${p27.outlookPage}: "Il risultato totale di esercizio è atteso in territorio positivo"`),
        src(BUDGET_VS_ACTUAL, `recap tables of the 2024 deck (p. ${bva(2024, "risultatoTotaleEsercizio").page}) and 2025 deck (p. ${bva(2025, "risultatoTotaleEsercizio").page}); actual − budget = printed difference for every row`)] },
    { id: "investire", n: 4, title: { it: "Investimenti e autofinanziamento", en: "Investment and self-financing" }, stars: ["bilancio.spesa", "finanze.debito-lordo"],
      lede: { it: `L'autofinanziamento ha coperto ${ilPct(pct(i24.self, i24.net))} degli investimenti netti nel 2024 e ${ilPct(pct(i25.self, i25.net))} nel 2025. Nel preventivo 2026, con l'acquisto di Arena Sportiva e Palazzetto dello Sport, scende ${alPct(pct(i26.self, i26.net))}; nel preventivo 2027 risale ${alPct(pct(i27.self, i27.net))}, su ${n(i27.net)} milioni di investimenti netti. Nel 2025 gli investimenti netti sono stati ${n(Math.abs(bva(2025, "onereNettoInvestimenti").diff))} milioni ${bva(2025, "onereNettoInvestimenti").diff < 0 ? "sotto" : "sopra"} il preventivo.`,
        en: `Self-financing covered ${pct(i24.self, i24.net)}% of net investment in 2024 and ${pct(i25.self, i25.net)}% in 2025. In the 2026 budget, which includes buying the Arena Sportiva and the Palazzetto dello Sport, it falls to ${pct(i26.self, i26.net)}%; in the 2027 budget it rises to ${pct(i27.self, i27.net)}%, on CHF ${n(i27.net)} million of net investment. In 2025 net investment was CHF ${n(Math.abs(bva(2025, "onereNettoInvestimenti").diff))} million ${bva(2025, "onereNettoInvestimenti").diff < 0 ? "below" : "above"} budget.` },
      chart: { type: "columns", unit: "mio CHF", digits: 1, series: [
        { label: { it: "Investimenti netti", en: "Net investment" }, data: [
          { key: "n24", label: { it: "2024", en: "2024" }, value: i24.net, status: "actual" }, { key: "n25", label: { it: "2025", en: "2025" }, value: i25.net, status: "actual" },
          { key: "n26", label: { it: "2026 preventivo", en: "2026 budget" }, value: i26.net, status: "budget" },
          { key: "n27", label: { it: "2027 preventivo", en: "2027 budget" }, value: i27.net, status: "budget" }] },
        { label: { it: "Autofinanziamento", en: "Self-financing" }, data: [
          { key: "s24", label: { it: "2024", en: "2024" }, value: i24.self, status: "actual" }, { key: "s25", label: { it: "2025", en: "2025" }, value: i25.self, status: "actual" },
          { key: "s26", label: { it: "2026 preventivo", en: "2026 budget" }, value: i26.self, status: "budget" },
          { key: "s27", label: { it: "2027 preventivo", en: "2027 budget" }, value: i27.self, status: "budget" }] }] },
      notes: [{ it: `Per il preventivo 2026 gli investimenti netti sono ${n(i26.net)} milioni, come nel messaggio sul preventivo 2027 e nel piano finanziario; con l'autofinanziamento di ${n(i26.self)} milioni dà il risultato globale del preventivo 2026 (${n(i26.self)} − ${n(i26.net)} = −${n(i26.net - i26.self)}). Il comunicato sul preventivo 2026 indicava ${n(rel26.net)} milioni.`,
          en: `For the 2026 budget, net investment is CHF ${n(i26.net)} million, as in the 2027 budget message and the financial plan; with CHF ${n(i26.self)} million of self-financing it gives the 2026 budget's overall result (${n(i26.self)} − ${n(i26.net)} = −${n(i26.net - i26.self)}). The 2026 budget release gave CHF ${n(rel26.net)} million.` }],
      source: [cityPdfSrc("consuntivo", 2024), cityPdfSrc("consuntivo", 2025), src(BUDGET27_MSG, `p. ${p27.inv2026.page}: '${p27.inv2026.quote}'`), cityPdfSrc("preventivo", 2027),
        cityPdfSrc("preventivo", 2026)] },
    { id: "debito", n: 5, title: { it: "Il debito", en: "Debt" }, stars: ["finanze.debito-lordo", "finanze.debito-pro-capite", "finanze.obbligazioni"],
      lede: { it: `Il debito finanziario lordo era di ${n(path[2].value)} milioni a fine marzo 2026. Il piano finanziario lo porta a un picco di ${n(peak.value)} milioni nel ${peak.date!.slice(0, 4)}, poi a ${n(last.value)} milioni nel ${last.date!.slice(0, 4)}.`,
        en: `Gross financial debt was CHF ${n(path[2].value)} million at the end of March 2026. The financial plan takes it to a peak of CHF ${n(peak.value)} million in ${peak.date!.slice(0, 4)}, then to CHF ${n(last.value)} million in ${last.date!.slice(0, 4)}.` },
      chart: { type: "line", unit: "mio CHF", data: path },
      notes: [{ it: "Il punto «stima» somma al debito di fine 2025 il fabbisogno di finanziamento del preventivo 2026, prima di eventuali vendite di beni: non è una cifra della Città.",
        en: "The 'estimate' point adds the 2026 budget's borrowing need to end-2025 debt, before any asset sales: it is not a City figure." },
        { it: `Preventivo 2027: il debito pubblico aumenta di ${n(-g27("risultatoGlobale"))} milioni (risultato globale: autofinanziamento di ${n(g27("autofinanziamento"))} meno investimenti netti di ${n(g27("investimentiNetti"))}).`,
          en: `2027 budget: public debt rises by CHF ${n(-g27("risultatoGlobale"))} million (overall result: self-financing of ${n(g27("autofinanziamento"))} minus net investment of ${n(g27("investimentiNetti"))}).` },
        { it: `Rating Moody's: ${mo.rating} con prospettiva ${mo.outlook}, confermato per il ${mo.nth} anno consecutivo nella revisione periodica pubblicata il ${mo.dateIt}.`,
          en: `Moody's rating: ${mo.rating} with a stable outlook, confirmed for the ${mo.nthEn} consecutive year in the periodic review published on ${mo.dateEn}.` }],
      source: [src(DEBT_PROFILE, "snapshots (end 2024, end 2025, Q1 2026) and plan.debtPath"), cityPdfSrc("preventivo", 2027),
        src(BUDGET27_MSG, "p. 14: «incremento del debito pubblico di CHF 80.4 mio»"),
        src(MOODYS_2026, `news page of 26 October 2026: '${mo.quote}'`), src(MOODYS_PDF, `p. 1: '${mo.prevQuote}' (27 October 2025)`)] },
    { id: "obbligazioni", n: 6, title: { it: "Le obbligazioni", en: "The bonds" }, stars: ["finanze.obbligazioni", "finanze.debito-lordo", "finanze.interessi"],
      lede: { it: `${n(book.outstandingM, 0)} milioni in ${book.bondCount} obbligazioni, con cedola media ponderata dello ${n(book.weightedCouponPct, 2)}% e una durata residua media di ${n(book.weightedRemainingYears)} anni. Entro tre anni ne scadono ${n(book.maturingWithin["3y"], 0)} milioni.`,
        en: `CHF ${n(book.outstandingM, 0)} million in ${book.bondCount} bonds, with a volume-weighted coupon of ${n(book.weightedCouponPct, 2)}% and ${n(book.weightedRemainingYears)} years average remaining life. CHF ${n(book.maturingWithin["3y"], 0)} million falls due within three years.` },
      chart: { type: "ladder", unit: "mio CHF",
        data: Object.entries(book.ladderM as Record<string, number>).map(([y, v]) => ({ key: `y${y}`, label: { it: y, en: y }, value: v, status: "actual" })),
        bonds: book.bonds.map((b: any) => ({ isin: b.isin, coupon: b.coupon, maturity: b.maturity, volumeM: b.volumeMCHF, kind: b.kind, sixUrl: b.sixUrl })) },
      notes: [{ it: "Solo le condizioni dei titoli: i prezzi di mercato sono su SIX (dati soggetti a licenza).", en: "Bond terms only: market prices are on SIX (licensed data)." }],
      source: [src(DEBT_PROFILE, "today (bond register of Dati di Lugano, terms only)")] },
    { id: "interessi", n: 7, title: { it: "Interessi e rimborsi", en: "Interest and repayments" }, stars: ["finanze.interessi", "finanze.obbligazioni"],
      lede: { it: `Sulle obbligazioni di oggi la Città paga ${n(ds.today.annualInterestM, 2)} milioni di interessi all'anno. Nel ${next.year} scade l'obbligazione da ${n(nextBond.volumeM, 0)} milioni allo ${n(nextBond.coupon, 2)}%: se fosse rifinanziata alla cedola dell'ultima emissione (${n(latest.coupon, 2)}%), costerebbe ${n(refiDelta, 2)} milioni in più all'anno.`,
        en: `On today's bonds the City pays CHF ${n(ds.today.annualInterestM, 2)} million in interest a year. In ${next.year} the CHF ${n(nextBond.volumeM, 0)} million bond at ${n(nextBond.coupon, 2)}% falls due: refinanced at the coupon of the latest issue (${n(latest.coupon, 2)}%), it would cost CHF ${n(refiDelta, 2)} million more a year.` },
      chart: { type: "columns", unit: "mio CHF", series: [{ label: { it: "Interessi pagati", en: "Interest paid" }, data: dsRows.map((r: any): Datum => ({
        key: `i${r.year}`, label: { it: String(r.year), en: String(r.year) }, value: r.interestPaidM, status: r.year < yearNow ? "paid" : "contract",
        note: r.redemptionM ? { it: `rimborso ${n(r.redemptionM, 0)} mio`, en: `repayment CHF ${n(r.redemptionM, 0)}M` } : undefined })) }] },
      notes: [{ it: "Barre piene: interessi già pagati. Tratteggiate: interessi da contratto, se nessuna obbligazione viene rifinanziata. Calcolati dalle condizioni dei titoli, non dai conti.",
          en: "Solid bars: interest already paid. Dashed: contracted interest, if no bond is refinanced. Computed from the bond terms, not from the accounts." },
        { it: `Rimborsi: ${repayList(false)}.`, en: `Repayments: ${repayList(true)}.` },
        { it: `Nei conti della Città gli interessi su debiti a breve e lungo termine (conto 3401) sono ${n(p27.interest3401.c2025, 2)} milioni nel consuntivo 2025 e ${n(p27.interest3401.p2027, 2)} nel preventivo 2027; quelli maturati sulle obbligazioni ${n(acc(2025), 2)} e ${n(acc(2027), 2)}.`,
          en: `In the City's accounts, interest on short- and long-term debt (account 3401) is CHF ${n(p27.interest3401.c2025, 2)} million in the 2025 accounts and ${n(p27.interest3401.p2027, 2)} in the 2027 budget; interest accrued on bonds is ${n(acc(2025), 2)} and ${n(acc(2027), 2)}.` }],
      source: [src(DEBT_SERVICE, "byYear (interestPaidM, interestAccruedM, redemptionM) and bonds[].payments"),
        src(BUDGET27_MSG, `p. ${p27.interest3401.page}: account 3401, columns Preventivo 2027 and Consuntivo 2025`)] },
    { id: "confronto", n: 8, title: { it: "Come si confronta in Ticino", en: "How it compares in Ticino" }, stars: ["finanze.debito-pro-capite"],
      lede: { it: "Gli otto indicatori del Cantone per il 2024. La valutazione usa soglie fisse valide in tutti i cantoni; posizione e mediana confrontano Lugano solo con i comuni ticinesi.",
        en: "The canton's eight indicators for 2024. Ratings use fixed thresholds valid across cantons; rank and median compare Lugano only with Ticino's municipalities." },
      chart: { type: "indicators", rows: y24.indicatori.filter((i: any) => i.value !== null).map((i: any) => ({
        label: { it: i.label, en: i.en }, value: i.display,
        rating: { it: i.rating?.label ?? "–", en: RATING_EN[i.rating?.label] ?? i.rating?.label ?? "–" }, level: i.rating?.level ?? "neutral",
        rank: i.rank ? `${i.rank} / ${i.of}` : "–",
        median: i.cantonMedian === null ? "–" : i.unit === "ratio" ? `${n(i.cantonMedian * 100)}%` : i.unit === "points" ? n(i.cantonMedian, 2) : n(i.cantonMedian, 0) })) },
      notes: [{ it: "Per gli indicatori di debito, 1 = il valore migliore (debito più basso) in Ticino.", en: "For the debt indicators, 1 = the best value (lowest debt) in Ticino." }],
      source: [src(INDICATORS, "years[2024].indicatori (canton tab12, rating scales from the 2024 report)")] },
  ];

  return { stars, chapters };
}

export const LEDGER_ORIGINS: Record<string, { url: string; publisher: string }> = {
    [DEBT_SERVICE]: { url: `https://github.com/nslotus/dati-di-lugano/blob/${DS_PIN}/out/debt-service.json`, publisher: "Dati di Lugano (bond interest and repayments computed from the bond terms)" },
    [CITY_FIGURES]: { url: `https://github.com/nslotus/dati-di-lugano/blob/${CITY_PIN}/out/city-figures.json`, publisher: "Dati di Lugano (figures extracted from the City of Lugano's PDFs)" },
    [INDICATORS]: { url: `https://github.com/nslotus/dati-di-lugano/blob/${PIN}/out/lugano-indicators.json`, publisher: "Dati di Lugano (from the Canton of Ticino municipal statistics)" },
    [BUDGET_VS_ACTUAL]: { url: "https://github.com/nslotus/dati-di-lugano/blob/6627e5f/out/budget-vs-actual.json", publisher: "Dati di Lugano (budget vs actual from the City's recap tables)" },
    [MOODYS_2026]: { url: "https://www.lugano.ch/news/20261026-rating-moodys/", publisher: "Città di Lugano, notizia: Moody’s conferma il rating Aa3 con prospettiva stabile (26 ottobre 2026)" },
    [MOODYS_PDF]: { url: "https://www.lugano.ch/dam/jcr:f659385e-ceef-4a3b-b14f-c776dcbf239d/20251027-cs-conferma-rating-moodys.pdf", publisher: "Città di Lugano, Moody's rating announcement" },
    [BUDGET27_PDF]: { url: "https://www.lugano.ch/dam/jcr:3252b132-7bd9-4f5b-84af-f03a9a61c763/15%2010%202026_Comunicato_Preventivo%202027.pdf", publisher: "Città di Lugano, Preventivo 2027 press release (15 October 2026)" },
    [BUDGET27_SLIDES]: { url: "https://www.lugano.ch/dam/jcr:3f7967db-a4c6-4d4b-8570-c0ddf97179db/Presentazione_Preventivo%202027.pdf", publisher: "Città di Lugano, Preventivo 2027 press presentation" },
    [BUDGET27_MSG]: { url: "https://www.lugano.ch/dam/jcr:5b2703d5-bf4c-446d-85d9-20bfdc2b2fc6/Messaggio%20generale_Preventivo%202027.pdf", publisher: "Città di Lugano, Preventivo 2027 municipal message" },
    [BUDGET_PDF]: { url: "https://www.lugano.ch/dam/jcr:0a793cce-fba0-4c83-b596-e65560732832/20251023-cs-preventivo-2026-piano-finanziario-2026-2033.pdf", publisher: "Città di Lugano, Preventivo 2026 press release" },
};
