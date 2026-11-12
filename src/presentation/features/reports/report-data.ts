import "server-only";
import { getTranslations } from "next-intl/server";
import type { DateRange } from "@/application/ports/queries";
import { container } from "@/composition/container";
import { AGING_BUCKETS } from "@/domain/collections/aging";
import { pickText } from "@/domain/shared/bilingual";
import { toLatinDigits } from "@/domain/shared/digits";
import { ShopDate } from "@/domain/shared/shop-date";
import type { CsvCell } from "../../lib/csv";
import { takaValue } from "../../lib/csv";
import { getFormat } from "../../lib/format-server";
import { currentLang } from "../../lib/server";

export const REPORT_KINDS = ["collections", "new-credit", "aging", "by-category", "adjustments"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const isReportKind = (k: unknown): k is ReportKind => typeof k === "string" && (REPORT_KINDS as readonly string[]).includes(k);

/** Aging and outstanding-by-category are "as of today" and ignore the range. */
export const RANGED: Record<ReportKind, boolean> = {
  collections: true,
  "new-credit": true,
  aging: false,
  "by-category": false,
  adjustments: true,
};

/** ?from&to (YYYY-MM-DD, Bangla digits ok); default = this month so far. */
export function parseRange(from?: string, to?: string): DateRange {
  const today = ShopDate.fromInstant(new Date());
  const f = ShopDate.parse(toLatinDigits(from ?? ""));
  const t = ShopDate.parse(toLatinDigits(to ?? ""));
  const start = f.ok ? f.value : ShopDate.of(`${today.iso.slice(0, 8)}01`);
  const end = t.ok ? t.value : today;
  return start.isAfter(end) ? { from: end.iso, to: start.iso } : { from: start.iso, to: end.iso };
}

export interface ReportTable {
  header: string[];
  /** Which columns are amounts (right-aligned). */
  numeric: boolean[];
  /** Formatted for the screen. */
  display: string[][];
  /** Raw values for CSV (amounts in taka, dates ISO). */
  raw: CsvCell[][];
  /** Footer totals row (display), when it makes sense. */
  totals?: string[];
}

export async function buildReport(kind: ReportKind, range: DateRange): Promise<ReportTable> {
  const t = await getTranslations("reports.columns");
  const te = await getTranslations("enums");
  const tb = await getTranslations("enums.agingBucket");
  const fmt = await getFormat();
  const lang = await currentLang();
  const r = container.queries().reports;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  switch (kind) {
    case "collections": {
      const rows = await r.collectionsByDay(range);
      return {
        header: [t("date"), t("method"), t("count"), t("amount")],
        numeric: [false, false, true, true],
        display: rows.map((x) => [fmt.date(x.day), te(`paymentMethod.${x.method}`), fmt.number(x.count), fmt.money(x.amountMinor)]),
        raw: rows.map((x) => [x.day, x.method, x.count, takaValue(x.amountMinor)]),
        totals: ["", "", fmt.number(sum(rows.map((x) => x.count))), fmt.money(sum(rows.map((x) => x.amountMinor)))],
      };
    }
    case "new-credit": {
      const rows = await r.newCreditSales(range);
      return {
        header: [t("saleNumber"), t("date"), t("customer"), t("total"), t("remaining"), t("status")],
        numeric: [false, false, false, true, true, false],
        display: rows.map((x) => [x.saleNumber, fmt.date(x.saleDate), x.customerName, fmt.money(x.totalMinor), fmt.money(x.remainingMinor), te(`saleStatus.${x.status}` as "saleStatus.open")]),
        raw: rows.map((x) => [x.saleNumber, x.saleDate, x.customerName, takaValue(x.totalMinor), takaValue(x.remainingMinor), x.status]),
        totals: ["", "", "", fmt.money(sum(rows.map((x) => x.totalMinor))), fmt.money(sum(rows.map((x) => x.remainingMinor))), ""],
      };
    }
    case "aging": {
      const rows = await r.agingByCustomer();
      return {
        header: [t("customer"), t("phone"), ...AGING_BUCKETS.map((b) => tb(b)), t("total")],
        numeric: [false, false, ...AGING_BUCKETS.map(() => true), true],
        display: rows.map((x) => [x.name, fmt.phone(x.phone), ...AGING_BUCKETS.map((b) => fmt.money(x[b])), fmt.money(x.totalMinor)]),
        raw: rows.map((x) => [x.name, x.phone, ...AGING_BUCKETS.map((b) => takaValue(x[b])), takaValue(x.totalMinor)]),
        totals: ["", "", ...AGING_BUCKETS.map((b) => fmt.money(sum(rows.map((x) => x[b])))), fmt.money(sum(rows.map((x) => x.totalMinor)))],
      };
    }
    case "by-category": {
      const rows = await r.outstandingByCategory();
      const name = (x: (typeof rows)[number]) => (x.categoryId ? pickText(x.nameBn, x.nameEn, lang) : t("noCategory"));
      return {
        header: [t("category"), t("outstanding")],
        numeric: [false, true],
        display: rows.map((x) => [name(x), fmt.money(x.outstandingMinor)]),
        raw: rows.map((x) => [name(x), takaValue(x.outstandingMinor)]),
        totals: ["", fmt.money(sum(rows.map((x) => x.outstandingMinor)))],
      };
    }
    case "adjustments": {
      const rows = await r.adjustments(range);
      return {
        header: [t("date"), t("customer"), t("type"), t("direction"), t("amount"), t("saleNumber"), t("reason")],
        numeric: [false, false, false, false, true, false, false],
        display: rows.map((x) => [
          fmt.date(x.createdAt),
          x.customerName,
          te(`adjustmentType.${x.type}`),
          te(`direction.${x.direction}`),
          fmt.money(x.amountMinor),
          x.saleNumber ?? "",
          x.reason,
        ]),
        raw: rows.map((x) => [x.createdAt, x.customerName, x.type, x.direction, takaValue(x.amountMinor), x.saleNumber, x.reason]),
      };
    }
  }
}
