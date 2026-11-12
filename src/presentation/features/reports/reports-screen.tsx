import { Download, FileBarChart } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "../../components/empty-state";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { cn } from "../../lib/utils";
import { RANGED, REPORT_KINDS, buildReport, isReportKind, parseRange, type ReportKind } from "./report-data";
import { chipClass, chipRowClass } from "../../components/chip";

export async function ReportsScreen({ kind: k, from, to }: { kind?: string; from?: string; to?: string }) {
  const t = await getTranslations("reports");
  const tc = await getTranslations("common");
  const kind: ReportKind = isReportKind(k) ? k : "collections";
  const range = parseRange(from, to);
  const table = await buildReport(kind, range);
  const qs = (patch: Record<string, string>) => new URLSearchParams({ kind, from: range.from, to: range.to, ...patch }).toString();

  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} backHref="/more" />

      <nav className={chipRowClass} aria-label={t("kinds")}>
        {REPORT_KINDS.map((r) => (
          <Link
            key={r}
            href={`/reports?${qs({ kind: r })}`}
            aria-current={r === kind ? "page" : undefined}
            className={chipClass(r === kind)}
          >
            {t(`kind.${r}`)}
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t(`about.${kind}`)}</p>
          <form className="flex flex-wrap items-end gap-3" action="/reports">
            <input type="hidden" name="kind" value={kind} />
            {RANGED[kind] && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="r-from">{tc("from")}</Label>
                  <Input id="r-from" name="from" type="date" defaultValue={range.from} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-to">{tc("to")}</Label>
                  <Input id="r-to" name="to" type="date" defaultValue={range.to} className="h-11" />
                </div>
                <Button type="submit" variant="secondary" className="h-11">
                  {tc("apply")}
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="ml-auto h-11">
              <a href={`/reports/${kind}/csv?${qs({})}`} download>
                <Download className="size-5" aria-hidden /> {tc("downloadCsv")}
              </a>
            </Button>
          </form>
        </CardContent>
      </Card>

      {table.display.length === 0 ? (
        <EmptyState icon={FileBarChart} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th]:h-11 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4 sm:[&_td:first-child]:pl-5 sm:[&_th:first-child]:pl-5">
            <TableHeader>
              <TableRow>
                {table.header.map((h, i) => (
                  <TableHead key={i} className={cn("whitespace-nowrap", table.numeric[i] && "text-right")}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.display.map((row, r) => (
                <TableRow key={r}>
                  {row.map((c, i) => (
                    <TableCell key={i} className={cn(table.numeric[i] ? "money text-right" : "max-w-64 truncate")}>
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {table.totals && (
              <TableFooter>
                <TableRow>
                  {table.totals.map((c, i) => (
                    <TableCell key={i} className={cn("font-semibold", table.numeric[i] && "money text-right")}>
                      {i === 0 ? tc("total") : c}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </Card>
      )}
    </section>
  );
}
