/**
 * CSV for Excel / Google Sheets: RFC 4180 quoting, CRLF line ends, and a UTF-8 BOM so
 * Excel shows Bangla text correctly. Cells that look like formulas are prefixed with
 * an apostrophe (CSV injection guard).
 */
export type CsvCell = string | number | boolean | null | undefined | Date;

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Paisa → plain taka number for spreadsheets ("1250.5"). */
export const takaValue = (minor: number) => minor / 100;

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
