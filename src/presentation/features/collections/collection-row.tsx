"use client";

import { Banknote, MessageSquarePlus } from "@/presentation/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CollectionRow, PromiseRow } from "@/application/ports/queries";
import { ContactButtons } from "../../components/contact-buttons";
import { StatusBadge, promiseTone } from "../../components/status-badge";
import { Thumb } from "../../components/thumb";
import { Button } from "../../components/ui/button";
import { useFormat } from "../../lib/format-context";
import { useCustomerName } from "../../lib/use-text";
import { FollowUpSheet } from "../followups/follow-up-sheet";

export type CollectionItem = (CollectionRow | PromiseRow) & { photoUrl: string | null; productUrl: string | null };

const isPromise = (r: CollectionItem): r is PromiseRow & { photoUrl: string | null; productUrl: string | null } => "followUpId" in r;

/** One customer to chase: who, what product, how much, how late, and one-tap actions (spec 6.5). */
export function CollectionRowCard({ row, amountLabel }: { row: CollectionItem; amountLabel: string }) {
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const fmt = useFormat();
  const nameOf = useCustomerName();
  const name = nameOf(row);

  return (
    <li className="space-y-3 rounded-2xl border bg-card p-3 shadow-card">
      <Link href={`/customers/${row.customerId}`} className="flex items-center gap-3">
        <Thumb url={row.photoUrl} alt={tc("photoOf", { name })} kind="person" />
        <Thumb url={row.productUrl} alt={t("product")} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">
            {t("balance", { amount: fmt.money(row.balanceMinor) })}
            {row.lastFollowUp && ` · ${t("lastContact", { outcome: te(`outcome.${row.lastFollowUp.outcome}`), date: fmt.date(row.lastFollowUp.at) })}`}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {row.maxDaysOverdue > 0 && <StatusBadge tone="danger">{tc("daysOverdue", { days: fmt.number(row.maxDaysOverdue) })}</StatusBadge>}
            {isPromise(row) && (
              <StatusBadge tone={promiseTone(row.status)}>
                {te(`promiseStatus.${row.status}`)} · {fmt.date(row.promisedDate)}
              </StatusBadge>
            )}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-xs text-muted-foreground">{amountLabel}</span>
          <span className="money block font-semibold">
            {fmt.money(isPromise(row) && row.promisedAmountMinor ? row.promisedAmountMinor : row.amountMinor)}
          </span>
        </span>
      </Link>
      <div className="flex flex-wrap gap-2">
        <ContactButtons phone={row.phone} name={name} compact />
        <FollowUpSheet
          customerId={row.customerId}
          customerName={name}
          trigger={
            <Button variant="outline" className="h-11 flex-1">
              <MessageSquarePlus className="size-5" aria-hidden /> {t("followUp")}
            </Button>
          }
        />
        <Button asChild className="h-11 flex-1">
          <Link href={`/customers/${row.customerId}/pay`}>
            <Banknote className="size-5" aria-hidden /> {t("receive")}
          </Link>
        </Button>
      </div>
    </li>
  );
}
