import { Ban, Banknote, FileText, MessageSquare, Plus } from "@/presentation/components/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { FollowUpView, LedgerEntry } from "@/application/ports/queries";
import { container } from "@/composition/container";
import { creditUsagePercent } from "@/domain/customer/credit";
import { ContactButtons } from "../../components/contact-buttons";
import { EmptyState } from "../../components/empty-state";
import { StatusBadge, installmentTone, promiseTone } from "../../components/status-badge";
import { TabPanels } from "../../components/tab-panels";
import { Thumb } from "../../components/thumb";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { getFormat } from "../../lib/format-server";
import { currentLang, customerName, signPhotos } from "../../lib/server";
import { cn } from "../../lib/utils";
import { FollowUpSheet } from "../followups/follow-up-sheet";
import { CustomerMenu } from "./customer-menu";
import { rowCardClass } from "../../components/chip";

type Fmt = Awaited<ReturnType<typeof getFormat>>;

export async function CustomerProfileScreen({ id }: { id: string }) {
  const q = container.queries();
  const profile = await q.customerProfile(id);
  if (!profile) notFound();
  const [ledger, followUps, openInstallments] = await Promise.all([q.customerLedger(id), q.customerFollowUps(id), q.customerOpenInstallments(id)]);

  const t = await getTranslations("customers.profile");
  const tc = await getTranslations("common");
  const te = await getTranslations("enums");
  const fmt = await getFormat();
  const lang = await currentLang();
  const c = profile.customer;
  const name = customerName(c, lang);
  const urls = await signPhotos([c.photoThumbKey ?? c.photoKey, ...profile.openSales.flatMap((s) => s.items.map((i) => i.thumbKey))]);
  const usage = creditUsagePercent(profile.balanceMinor, c.creditLimitMinor);
  const otherDues = openInstallments.filter((i) => i.saleId === null);

  return (
    <section className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <Thumb url={urls[c.photoThumbKey ?? c.photoKey ?? ""]} alt={tc("photoOf", { name })} kind="person" className="size-20" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl leading-tight font-semibold break-words">{name}</h1>
              {lang === "bn" && c.nameBn && <p className="text-sm text-muted-foreground">{c.name}</p>}
              <p className="text-muted-foreground">{fmt.phone(c.phone)}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.isBlocked && (
                  <StatusBadge tone="danger" icon={Ban}>
                    {t("blocked")}
                  </StatusBadge>
                )}
                {c.archivedAt && <StatusBadge tone="neutral">{tc("archived")}</StatusBadge>}
              </div>
            </div>
            <CustomerMenu id={c.id} blocked={c.isBlocked} archived={Boolean(c.archivedAt)} />
          </div>

          <ContactButtons phone={c.phone} name={name} />

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <dt className="text-xs text-muted-foreground">{t("balance")}</dt>
              <dd className="money text-xl font-semibold">{fmt.money(profile.balanceMinor)}</dd>
            </div>
            <div className={cn("rounded-lg p-3", profile.overdueMinor > 0 ? "bg-destructive-soft" : "bg-muted")}>
              <dt className="text-xs text-muted-foreground">{t("overdue")}</dt>
              <dd className={cn("money text-xl font-semibold", profile.overdueMinor > 0 && "text-destructive")}>{fmt.money(profile.overdueMinor)}</dd>
              {profile.maxDaysOverdue > 0 && <dd className="text-xs text-destructive">{tc("daysOverdue", { days: fmt.number(profile.maxDaysOverdue) })}</dd>}
            </div>
          </dl>

          {usage !== null && c.creditLimitMinor !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t("creditLimit")}</span>
                <span className="money">
                  {fmt.money(profile.balanceMinor)} / {fmt.money(c.creditLimitMinor)} ({fmt.number(usage)}%)
                </span>
              </div>
              <Progress value={Math.min(100, usage)} aria-label={t("creditLimit")} className={usage > 100 ? "[&>*]:bg-destructive" : undefined} />
            </div>
          )}
          {profile.lastPaymentAt && <p className="text-sm text-muted-foreground">{t("lastPayment", { date: fmt.date(profile.lastPaymentAt) })}</p>}

          <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button asChild className="h-12">
              <Link href={`/sales/new?customer=${c.id}`}>
                <Plus className="size-5" aria-hidden /> {t("newSale")}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12">
              <Link href={`/customers/${c.id}/pay`}>
                <Banknote className="size-5" aria-hidden /> {t("receivePayment")}
              </Link>
            </Button>
            <FollowUpSheet
              customerId={c.id}
              customerName={name}
              trigger={
                <Button variant="outline" className="h-12">
                  <MessageSquare className="size-5" aria-hidden /> {t("logFollowUp")}
                </Button>
              }
            />
            <Button asChild variant="outline" className="h-12">
              <Link href={`/customers/${c.id}/statement`}>
                <FileText className="size-5" aria-hidden /> {t("statement")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <TabPanels
        tabs={[
          {
            id: "dues",
            label: t("tabs.dues"),
            content:
              profile.openSales.length === 0 && otherDues.length === 0 ? (
                <EmptyState illustration="receipt" title={t("noDues")} />
              ) : (
                <ul className="space-y-2">
                  {profile.openSales.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sales/${s.id}`} className={rowCardClass}>
                        <div className="flex -space-x-3">
                          {s.items.slice(0, 3).map((i, k) => (
                            <Thumb key={k} url={i.thumbKey ? urls[i.thumbKey] : null} alt={i.name} className="size-14 border-2 border-card" />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.items.map((i) => i.name).join(", ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.saleNumber} · {fmt.date(s.saleDate)}
                          </p>
                          {s.nextDueDate && <p className="text-xs">{t("nextDue", { date: fmt.date(s.nextDueDate) })}</p>}
                          {s.maxDaysOverdue > 0 && <StatusBadge tone="danger">{tc("daysOverdue", { days: fmt.number(s.maxDaysOverdue) })}</StatusBadge>}
                        </div>
                        <div className="text-right">
                          <p className="money font-semibold">{fmt.money(s.remainingMinor)}</p>
                          <p className="money text-xs text-muted-foreground">{fmt.money(s.totalMinor)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {otherDues.map((i) => (
                    <li key={i.id} className={rowCardClass}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t("otherDue")}</p>
                        <p className="text-xs text-muted-foreground">{t("nextDue", { date: fmt.date(i.dueDate) })}</p>
                        <StatusBadge tone={installmentTone(i.status)}>{te(`installmentStatus.${i.status}`)}</StatusBadge>
                      </div>
                      <p className="money font-semibold">{fmt.money(i.remainingMinor)}</p>
                    </li>
                  ))}
                </ul>
              ),
          },
          { id: "ledger", label: t("tabs.ledger"), content: <LedgerTable entries={ledger.entries} fmt={fmt} /> },
          { id: "followups", label: t("tabs.followUps"), content: <FollowUpList items={followUps} fmt={fmt} /> },
        ]}
      />
    </section>
  );
}

async function LedgerTable({ entries, fmt }: { entries: LedgerEntry[]; fmt: Fmt }) {
  const t = await getTranslations("customers.ledger");
  const te = await getTranslations("enums");
  if (entries.length === 0) return <EmptyState illustration="scroll" title={t("empty")} />;
  const href = (e: LedgerEntry) => (e.kind === "sale" ? `/sales/${e.refId}` : e.kind === "payment" ? `/payments/${e.refId}` : null);
  const detail = (e: LedgerEntry) =>
    !e.detail
      ? null
      : e.kind === "payment"
        ? te(`paymentMethod.${e.detail}` as "paymentMethod.cash")
        : e.kind === "adjustment"
          ? te(`adjustmentType.${e.detail}` as "adjustmentType.return")
          : e.detail;

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {[...entries].reverse().map((e) => {
        const link = href(e);
        const struck = e.voided || e.cancelled;
        const body = (
          <div className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", struck && "line-through")}>
                {te(`ledgerKind.${e.kind}`)} · {e.ref}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmt.date(e.at)}
                {detail(e) && ` · ${detail(e)}`}
              </p>
              {e.voided && <StatusBadge tone="neutral">{t("void")}</StatusBadge>}
              {e.cancelled && <StatusBadge tone="neutral">{te("saleStatus.cancelled")}</StatusBadge>}
            </div>
            <div className="text-right text-sm">
              {e.debitMinor > 0 && <p className={cn("money text-destructive", struck && "line-through")}>+{fmt.money(e.debitMinor)}</p>}
              {e.creditMinor > 0 && <p className={cn("money text-success", struck && "line-through")}>−{fmt.money(e.creditMinor)}</p>}
              <p className="money text-xs text-muted-foreground">{t("balanceAfter", { amount: fmt.money(e.balanceMinor) })}</p>
            </div>
          </div>
        );
        return <li key={`${e.kind}-${e.refId}`}>{link ? <Link href={link} className="block hover:bg-accent">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

async function FollowUpList({ items, fmt }: { items: FollowUpView[]; fmt: Fmt }) {
  const t = await getTranslations("followUps");
  const te = await getTranslations("enums");
  if (items.length === 0) return <EmptyState illustration="speech" title={t("empty")} />;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((f) => (
        <li key={f.id} className="space-y-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {te(`channel.${f.channel}`)} · {te(`outcome.${f.outcome}`)}
            </span>
            {f.promiseStatus && <StatusBadge tone={promiseTone(f.promiseStatus)}>{te(`promiseStatus.${f.promiseStatus}`)}</StatusBadge>}
          </div>
          <p className="text-xs text-muted-foreground">{fmt.dateTime(f.createdAt)}</p>
          {f.promisedDate && (
            <p className="text-sm">
              {t("promiseLine", {
                date: fmt.date(f.promisedDate),
                amount: f.promisedAmountMinor ? fmt.money(f.promisedAmountMinor) : t("anyAmount"),
                paid: fmt.money(f.paidTowardMinor),
              })}
            </p>
          )}
          {f.note && <p className="text-sm whitespace-pre-line">{f.note}</p>}
        </li>
      ))}
    </ul>
  );
}
