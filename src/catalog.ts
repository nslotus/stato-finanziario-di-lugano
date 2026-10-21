// The catalogue: the one data contract between the source adapters and the page. A "star" is one figure record.
// Rule: no star without a source. Every value carries where it was read from.

export type Lang = "it" | "en";
export type Text = Record<Lang, string>;

export type Constellation = "bilancio" | "salute" | "finanze" | "istruzione" | "trasporti" | "economia" | "sociale" | "cultura" | "sicurezza" | "ambiente";

export interface Source {
  /** archived file in sources/ */
  file: string;
  url: string;
  publisher: string;
  /** sheet/row/column, or page, where the value is read */
  locator: string;
}

export interface Comparison {
  /** one value per municipality, same unit and year as the star */
  unit: string;
  values: { bfs: number | null; name: string; value: number; population: number }[];
  median: number;
  lugano: { value: number; rank: number; of: number };
  /** what "rank 1" means for this measure */
  rankOrder: "highest-first" | "lowest-first";
}

export interface Star {
  id: string;
  constellation: Constellation;
  label: Text;
  /** one or two plain sentences: what this measures. Describes; never explains causes. */
  about: Text;
  value: number;
  unit: string;
  year: number;
  area: "Lugano" | "Ticino" | "Svizzera";
  kind: "official" | "derived";
  /** how a derived value was computed */
  method?: Text;
  source: Source[];
  /** Ticino vs Switzerland context, for canton-level stars */
  context?: { label: Text; value: number; unit: string; digits?: number }[];
  comparison?: Comparison;
  related: string[];
  /** who runs it, when that is not the City (schools of the canton, independent universities) */
  operator?: "canton" | "independent";
  /** what the City itself spends on it, from its accounts (CHF million; 0 when the accounts show no line) */
  cityCost?: { value: number; code: string; year: number };
  /** decimals for the headline value when the unit's default is too coarse (rates printed to 0.01) */
  digits?: number;
  /** deeper views of the same sources: breakdowns and series, drawn with the Ledger chart types */
  detail?: Detail[];
}

export interface Detail {
  title: Text;
  chart: Extract<Chart, { type: "hbars" | "columns" }>;
  note?: Text;
  source: Source[];
}

/** Options for the detail charts: series colour (CSS colour, default the finance hue), decimals, caption under bars. */
export interface ChartStyle { color?: string; digits?: number; caption?: Text }

export interface Relation {
  /** a scatter of two stars' comparisons across municipalities */
  id: string;
  x: string;
  y: string;
  label: Text;
  about: Text;
}

export interface Catalogue {
  sourcesAsOf: string;
  stars: Star[];
  relations: Relation[];
  /** constellations announced but not yet sourced */
  uncharted: { id: string; label: Text }[];
  /** the Ledger (Libro dei conti): the finance story across many stars */
  chapters: Chapter[];
}

/** One bar/column/point in a Ledger chart. status marks how the value is known. */
export interface Datum {
  key: string;
  label: Text;
  value: number;
  /** actual = closed accounts; budget = preventivo; plan = financial plan; estimate = calculated here */
  status?: "actual" | "budget" | "plan" | "estimate" | "paid" | "contract";
  /** star this datum links to in the sky */
  star?: string;
  note?: Text;
  date?: string;
}

export type Chart =
  | { type: "kpi"; value: number; unit: string; sub: Text }
  | ({ type: "hbars"; unit: string; data: Datum[] } & ChartStyle)
  | ({ type: "columns"; unit: string; series: { label: Text; data: Datum[] }[] } & ChartStyle)
  | { type: "line"; unit: string; data: Datum[] }
  | { type: "ladder"; unit: string; data: Datum[]; bonds: { isin: string; coupon: number; maturity: string; volumeM: number | null; kind: string; sixUrl: string | null }[] }
  | { type: "indicators"; rows: { label: Text; value: string; rating: Text; level: string; rank: string; median: string }[] }
  | { type: "sources"; files: { file: string; publisher: string; url: string; sha256: string; note?: string }[] };

export interface Chapter {
  id: string;
  n: number;
  title: Text;
  /** built from values at build time; never hand-typed numbers */
  lede: Text;
  stars: string[];
  chart: Chart;
  notes?: Text[];
  /** budget vs actual table: one row per measure, one cell per year (CHF million) */
  table?: { years: number[]; rows: { label: Text; cells: Record<string, { budget: number; actual: number; diff: number }> }[] };
  source: Source[];
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function compare(values: Comparison["values"], unit: string, order: Comparison["rankOrder"]): Comparison {
  const lug = values.find((v) => v.bfs === 5192);
  if (!lug) throw new Error("Lugano (BFS 5192) missing from comparison");
  const sorted = [...values].sort((a, b) => (order === "highest-first" ? b.value - a.value : a.value - b.value));
  return { unit, values, median: median(values.map((v) => v.value)),
    lugano: { value: lug.value, rank: sorted.indexOf(lug) + 1, of: values.length }, rankOrder: order };
}
