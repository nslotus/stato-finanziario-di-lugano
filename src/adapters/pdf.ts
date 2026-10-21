// Read only the PDF pages a star needs. Each call opens the document, reads the requested pages one at a time (each
// page is released as soon as its text is taken) and closes the document; the text is cached per file and page, so
// a large file used by several sectors (the 2027 budget message, the City yearbook) is never parsed twice.
// Pages come back as a sparse array indexed by page number − 1, so page numbers in locators stay the real ones.

import { readFileSync } from "node:fs";
import { rawPath } from "./common";

// the pdf.js build that pdf-parse ships (v1.10.100), loaded directly so single pages can be read
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFJS = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
PDFJS.disableWorker = true;

/** A text piece: trimmed string, position, width, and whether the raw piece had a space before or after it. */
export type Item = { s: string; x: number; y: number; w: number; sp: boolean };
type Page = { text: string; items: Item[] };
const cache = new Map<string, { numPages: number; pages: Map<number, Page> }>();

/** Text (items joined by spaces, whitespace collapsed) and positioned items of the given pages; all pages when omitted. */
export async function readPdf(file: string, wanted?: number[]) {
  let entry = cache.get(file);
  const missing = (n: number) => !entry || !entry.pages.has(n);
  if (!entry || !wanted || wanted.some(missing)) {
    const doc = await PDFJS.getDocument(readFileSync(rawPath(file)));
    try {
      entry = entry ?? { numPages: doc.numPages, pages: new Map() };
      cache.set(file, entry);
      const list = wanted ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
      for (const n of list) {
        if (entry.pages.has(n) || n < 1 || n > doc.numPages) continue;
        const page = await doc.getPage(n);
        const tc = await page.getTextContent();
        entry.pages.set(n, {
          text: tc.items.map((i: any) => i.str).join(" ").replace(/\s+/g, " "),
          items: tc.items.filter((i: any) => i.str.trim()).map((i: any) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width ?? 0, sp: /^\s|\s$/.test(i.str) })),
        });
        page.cleanup();
      }
    } finally { doc.destroy(); }
  }
  const list = wanted ?? Array.from({ length: entry!.numPages }, (_, i) => i + 1);
  const pages: string[] = [], items: Item[][] = [];
  for (const n of list) { const p = entry!.pages.get(n); if (p) { pages[n - 1] = p.text; items[n - 1] = p.items; } }
  return { pages, items, numPages: entry!.numPages };
}

/** Pages 1 to n (or all), for documents read from the start. */
export const firstPages = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
