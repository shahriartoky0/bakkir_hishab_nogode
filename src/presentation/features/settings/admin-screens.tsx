import { Download } from "@/presentation/components/icons";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { EmptyState } from "../../components/empty-state";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { getFormat } from "../../lib/format-server";
import { chipClass, chipRowClass } from "../../components/chip";

/** Full data export: one CSV per table (spec 6.7). Photos stay in object storage. */
export async function ExportScreen() {
  const t = await getTranslations("settings.export");
  const tables = container.queries().exportableTables();
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} backHref="/more" />
      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {tables.map((name) => (
            <div key={name} className="flex min-h-14 items-center gap-3 px-4">
              <span className="flex-1 font-mono text-sm">{name}</span>
              <Button asChild variant="outline" className="h-10">
                <a href={`/settings/export/${name}`} download>
                  <Download className="size-4" aria-hidden /> {t("download")}
                </a>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("photosNote")}</p>
    </section>
  );
}

const PAGE = 50;

/** Who-did-what timeline with before/after for every change (spec 6.8). */
export async function ActivityScreen({ before, entity }: { before?: string; entity?: string }) {
  const t = await getTranslations("settings.activity");
  const fmt = await getFormat();
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const rows = await container.queries().activity({ limit: PAGE, before: beforeDate, entity: entity || undefined });
  const entities = ["sale", "payment", "adjustment", "customer", "follow_up", "category", "field", "settings", "translation"];
  const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v, null, 2));

  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} backHref="/more" />
      <nav className={chipRowClass} aria-label={t("filter")}>
        {["", ...entities].map((e) => (
          <Link
            key={e || "all"}
            href={e ? `/settings/activity?entity=${e}` : "/settings/activity"}
            aria-current={(entity ?? "") === e ? "page" : undefined}
            className={chipClass((entity ?? "") === e)}
          >
            {t(`entity.${e || "all"}` as "entity.all")}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState illustration="scroll" title={t("empty")} />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {rows.map((r) => {
            const b = json(r.before);
            const a = json(r.after);
            return (
              <li key={r.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.action}</span>
                  <span className="font-medium">{r.summary}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmt.dateTime(r.at)}</span>
                </div>
                {(b || a) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer py-1 text-muted-foreground">{t("changes")}</summary>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {b && (
                        <div>
                          <p className="font-medium">{t("before")}</p>
                          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap break-all">{b}</pre>
                        </div>
                      )}
                      {a && (
                        <div>
                          <p className="font-medium">{t("after")}</p>
                          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap break-all">{a}</pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {rows.length === PAGE && (
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href={`/settings/activity?before=${encodeURIComponent(rows.at(-1)!.at.toISOString())}${entity ? `&entity=${entity}` : ""}`}>{t("older")}</Link>
        </Button>
      )}
    </section>
  );
}
