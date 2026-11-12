import { AlertTriangle, CalendarClock, ChevronRight, Users, Wallet } from "@/presentation/components/icons";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { CollectionRow } from "@/application/ports/queries";
import { container } from "@/composition/container";
import { ShopDate } from "@/domain/shared/shop-date";
import { EmptyState } from "../../components/empty-state";
import { Illustration, type IllustrationName } from "../../components/illustration";
import { PageHeader } from "../../components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { getFormat } from "../../lib/format-server";
import { signPhotos } from "../../lib/server";
import { cn } from "../../lib/utils";
import { StarterSetPrompt } from "../catalog/starter-set-prompt";
import { AgingChart, MonthlyChart } from "../dashboard/charts";
import { CollectionRowCard } from "./collection-row";
import { TodayView } from "./today-view";

type WithPhotos<T> = T & { photoUrl: string | null; productUrl: string | null };

/** Presign customer and product thumbnails for several row groups in one call. */
async function withPhotos<K extends string>(groups: Record<K, CollectionRow[]>): Promise<Record<K, WithPhotos<CollectionRow>[]>> {
  const all = Object.values<CollectionRow[]>(groups).flat();
  const urls = await signPhotos(all.flatMap((r) => [r.photoThumbKey, r.productThumbKey]));
  const u = (k: string | null) => (k ? (urls[k] ?? null) : null);
  const out = {} as Record<K, WithPhotos<CollectionRow>[]>;
  for (const k of Object.keys(groups) as K[]) out[k] = groups[k].map((r) => ({ ...r, photoUrl: u(r.photoThumbKey), productUrl: u(r.productThumbKey) }));
  return out;
}

export async function TodayScreen() {
  const t = await getTranslations("collections");
  const fmt = await getFormat();
  const c = await container.queries().collections();
  const sections = await withPhotos({
    promisesDueToday: c.promisesDueToday,
    dueToday: c.dueToday,
    brokenPromises: c.brokenPromises,
    overdue: c.overdue,
    upcoming: c.upcoming,
    later: c.later,
  });
  return (
    <section className="space-y-5">
      <PageHeader title={t("title")} description={fmt.date(ShopDate.fromInstant(new Date()), "long")} />
      <TodayView sections={sections} />
    </section>
  );
}

function Stat({
  illustration,
  label,
  value,
  tone,
  href,
}: {
  illustration: IllustrationName;
  label: string;
  value: string;
  tone: "danger" | "success" | "gold";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 shadow-card",
        href && "transition-colors duration-150 hover:border-input hover:bg-accent/60",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          tone === "danger" && "bg-destructive-soft",
          tone === "success" && "bg-success-soft",
          tone === "gold" && "bg-gold-soft",
        )}
      >
        <Illustration name={illustration} size={28} eager />
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
      <span className="money mt-auto font-heading text-xl leading-none font-bold">{value}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-gold hover:underline">
          {linkLabel} <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export async function DashboardScreen({ userName }: { userName: string }) {
  const t = await getTranslations("dashboard");
  const tb = await getTranslations("enums.agingBucket");
  const tCol = await getTranslations("collections");
  const fmt = await getFormat();
  const [d, settings] = await Promise.all([container.queries().dashboard(), container.settings()]);
  const { topOverdue, upcoming } = await withPhotos({ topOverdue: d.topOverdue, upcoming: d.upcoming });
  const monthLabel = (ym: string) => fmt.date(`${ym}-01`, "medium").replace(/^\S+\s/, "");
  const overdueShare =
    d.totalOutstandingMinor > 0 ? Math.min(100, Math.round((d.totalOverdueMinor / d.totalOutstandingMinor) * 100)) : 0;

  return (
    <section className="space-y-6">
      <PageHeader
        title={t("greeting", { name: userName })}
        description={fmt.date(ShopDate.fromInstant(new Date()), "long")}
      />

      {!settings.starterSetDecidedAt && <StarterSetPrompt />}

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        {/* Hero: how much the shop is owed, and how much of that is late */}
        <div className="relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground shadow-float ring-1 ring-white/10 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gold" />
          <div className="relative flex h-full flex-col gap-5">
            <div>
              <p className="flex items-center gap-1.5 text-sm text-hero-muted">
                <Wallet className="size-4" aria-hidden /> {t("totalOutstanding")}
              </p>
              <p className="money mt-2 font-heading text-[2.25rem] leading-none font-bold sm:text-[2.75rem]">{fmt.money(d.totalOutstandingMinor)}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-hero-muted">
                  <AlertTriangle className="size-4 text-brand-gold" aria-hidden /> {t("totalOverdue")}
                </span>
                <span className="money font-semibold">{fmt.money(d.totalOverdueMinor)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                <div className="h-full rounded-full bg-brand-gold" style={{ width: `${overdueShare}%` }} />
              </div>
              <p className="text-xs text-hero-muted">{t("overdueShare", { pct: fmt.number(overdueShare) })}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link
                href="/customers?filter=has_dues"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium transition-colors duration-150 hover:bg-white/20"
              >
                <Users className="size-4" aria-hidden /> {t("customersCount", { count: fmt.number(d.customersWithDues) })}
              </Link>
              <Link
                href="/today"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-gold px-3.5 text-sm font-semibold text-brand-gold-foreground transition-[filter] duration-150 hover:brightness-105"
              >
                <CalendarClock className="size-4" aria-hidden /> {t("promisesCount", { count: fmt.number(d.promisesDueToday) })}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat illustration="money-bag" label={t("collectedToday")} value={fmt.money(d.collectedTodayMinor)} tone="success" />
          <Stat illustration="coin" label={t("collectedMonth")} value={fmt.money(d.collectedMonthMinor)} tone="success" />
          <Stat illustration="chart-up" label={t("newCreditMonth")} value={fmt.money(d.newCreditMonthMinor)} tone="gold" />
          <Stat illustration="alarm" label={t("totalOverdue")} value={fmt.money(d.totalOverdueMinor)} tone="danger" href="/customers?filter=overdue" />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("aging")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingChart data={d.aging.map((a) => ({ label: tb(a.bucket), amountMinor: a.amountMinor }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("monthly")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart
              data={d.monthly.map((m) => ({ label: monthLabel(m.month), collectedMinor: m.collectedMinor, newCreditMinor: m.newCreditMinor }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle title={t("topOverdue")} href="/today" linkLabel={t("seeAll")} />
          {topOverdue.length === 0 ? (
            <EmptyState illustration="party" title={t("noOverdue")} />
          ) : (
            <ul className="space-y-2">
              {topOverdue.map((r) => (
                <CollectionRowCard key={r.customerId} row={r} amountLabel={tCol("amount.overdue")} />
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <SectionTitle title={t("upcoming")} href="/today" linkLabel={t("seeAll")} />
          {upcoming.length === 0 ? (
            <EmptyState illustration="check" title={t("noUpcoming")} />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((r) => (
                <CollectionRowCard key={r.customerId} row={r} amountLabel={tCol("amount.due")} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
