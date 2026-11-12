import "server-only";
import { container } from "@/composition/container";
import { ShopDate } from "@/domain/shared/shop-date";
import { getCurrentUser } from "../auth/session";
import { buildReport, isReportKind, parseRange } from "../features/reports/report-data";
import { csvResponse, toCsv } from "../lib/csv";

const unauthorized = () => new Response(null, { status: 401 });
const notFound = () => new Response(null, { status: 404 });

/** GET /reports/[kind]/csv?from&to — the report as CSV with headers in the UI language. */
export async function reportCsv(request: Request, kind: string): Promise<Response> {
  if (!(await getCurrentUser())) return unauthorized();
  if (!isReportKind(kind)) return notFound();
  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const table = await buildReport(kind, range);
  return csvResponse(`baki-${kind}-${range.from}_${range.to}.csv`, toCsv(table.header, table.raw));
}

/** GET /settings/export/[table] — one raw table as CSV (full data export; photos stay in storage). */
export async function tableCsv(table: string): Promise<Response> {
  if (!(await getCurrentUser())) return unauthorized();
  const data = await container.queries().exportTable(table);
  if (!data) return notFound();
  const rows = data.rows.map((r) => data.columns.map((c) => r[c] as never));
  const today = ShopDate.fromInstant(new Date()).iso;
  return csvResponse(`baki-${table}-${today}.csv`, toCsv(data.columns, rows));
}

/** GET /settings/clear-data/backup?from&to&customers=1 — JSON of exactly the rows "clear data" would delete. */
export async function clearBackupJson(request: Request): Promise<Response> {
  if (!(await getCurrentUser())) return unauthorized();
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const r = await container.clearDateRange().backup({ from, to, removeEmptyCustomers: url.searchParams.get("customers") === "1" });
  if (!r.ok) return new Response(null, { status: 400 });
  return new Response(JSON.stringify(r.value, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="baki-backup-${from}_${to}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
