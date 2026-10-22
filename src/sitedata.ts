// The page's data comes in two files, so that a phone can draw the first screen before the rest has arrived:
//   docs/data/data.js       window.CIELO: every number the tiles, lists, sky and table are drawn from
//   docs/data/data-more.js  window.CIELO_MORE: what only a card or the overview shows (the figure records' explanations,
//                           methods, sources and comparisons; each sector's further figures; the City's own texts)
// Both are written by npm run site. joinSite() puts them back together exactly; npm run docs and npm run verify read the
// joined data, and assets/app.js does the same in the browser when the second file arrives.

import { readFileSync } from "node:fs";

/** Fields of a figure record that only a card or the overview shows. */
const STAR_DETAIL = ["about", "method", "source", "detail", "context", "cmp"];

type More = {
  stars: Record<string, Record<string, unknown>>;
  fns: Record<string, Record<string, unknown>>;
  slices: Record<string, Record<string, unknown>>;
  orgGroups: Record<string, Record<string, unknown>>;
  orgLines: Record<string, Record<string, unknown>>;
};

/** Moves the detail out of the page's data (which it changes) into a second object. */
export function splitSite(site: any): More {
  const more: More = { stars: {}, fns: {}, slices: {}, orgGroups: {}, orgLines: {} };
  const take = (o: any, keys: string[], empty: (k: string) => unknown) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in o) { out[k] = o[k]; o[k] = empty(k); }
    return out;
  };
  for (const [id, st] of Object.entries<any>(site.X.stars)) {
    const out: Record<string, unknown> = {};
    for (const k of STAR_DETAIL) if (k in st) { out[k] = st[k]; delete st[k]; }
    more.stars[id] = out;
  }
  // facts and texts keep an empty list in the first file, so the page can draw before the second one arrives
  for (const f of site.D.fns) more.fns[f.code] = take(f, ["facts"], () => []);
  for (const f of site.D.org.slices) more.slices[f.code] = take(f, ["facts"], () => []);
  for (const g of site.D.org.groups) more.orgGroups[g.code] = take(g, ["text"], () => []);
  for (const l of site.D.org.lines) more.orgLines[l.code] = take(l, ["text"], () => []);
  return more;
}

/** Puts the second object back into the first. */
export function joinSite(site: any, more: More) {
  for (const [id, v] of Object.entries(more.stars)) Object.assign(site.X.stars[id], v);
  const by = (list: any[], v: More[keyof More]) => { for (const o of list) if (v[o.code]) Object.assign(o, v[o.code]); };
  by(site.D.fns, more.fns); by(site.D.org.slices, more.slices); by(site.D.org.groups, more.orgGroups); by(site.D.org.lines, more.orgLines);
  return site;
}

const parse = (file: string, name: string) => { const s = readFileSync(file, "utf8"); return JSON.parse(s.slice(s.indexOf(`window.${name} = `) + name.length + 10).replace(/;\s*$/, "")); };

/** The page's data as one object, read from both files. */
export const loadSite = () => joinSite(parse("docs/data/data.js", "CIELO"), parse("docs/data/data-more.js", "CIELO_MORE"));
