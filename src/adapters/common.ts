import * as XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";

export type Row = unknown[];
export const RAW = "data/raw";

/** Working copy in data/raw if present, otherwise the committed archive in sources/. */
export const rawPath = (file: string) => (existsSync(`${RAW}/${file}`) ? `${RAW}/${file}` : `sources/${file}`);

export function sheet(file: string, name: string): Row[] {
  const wb = XLSX.read(readFileSync(rawPath(file)));
  if (!wb.Sheets[name]) throw new Error(`${file}: no sheet "${name}" (has ${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { header: 1, blankrows: false });
}

/** Names differ in case and markers between files ("LUGANO", "Lugano", "Agno [*]"). */
export const norm = (s: unknown) =>
  String(s ?? "").replace(/\[\*\]/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function fail(msg: string): never {
  throw new Error(`DATA CHECK FAILED: ${msg}`);
}
