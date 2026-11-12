import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { toLatinDigits } from "@/domain/shared/digits";
import { ShopDate } from "@/domain/shared/shop-date";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { param } from "../../lib/server";
import { PrintFrame, Row, printContext, type PrintParams } from "./print-frame";

function statementRange(sp: PrintParams) {
  const today = ShopDate.fromInstant(new Date());
  const f = ShopDate.parse(toLatinDigits(param(sp.from) ?? ""));
  const t = ShopDate.parse(toLatinDigits(param(sp.to) ?? ""));
  const from = f.ok ? f.value : today.addDays(-90);
  const to = t.ok ? t.value : today;
  return from.isAfter(to) ? { from: to.iso, to: from.iso } : { from: from.iso, to: to.iso };
}

/** Printable customer statement: opening balance, every entry with running balance, open schedule (spec 6.7). */
export async function CustomerStatement({ id, sp }: { id: string; sp: PrintParams }) {
  const q = container.queries();
  const profile = await q.customerProfile(id);
  if (!profile) notFound();
  const range = statementRange(sp);
  const [ledger, open, ctx, tc] = await Promise.all([q.customerLedger(id, range), q.customerOpenInstallments(id), printContext(sp), getTranslations("common")]);
  const { t, fmt, lang } = ctx;
  const te = await getTranslations({ locale: lang, namespace: "enums" });
  const c = profile.customer;
  const closing = ledger.entries.at(-1)?.balanceMinor ?? ledger.openingBalanceMinor;
  const detail = (kind: string, d: string | null) =>
    !d ? "" : kind === "payment" ? te(`paymentMethod.${d}` as "paymentMethod.cash") : kind === "adjustment" ? te(`adjustmentType.${d}` as "adjustmentType.return") : d;

  const rangeForm = (
    <form className="flex flex-wrap items-center gap-2" action={`/customers/${id}/statement`}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="size" value={ctx.size} />
      <Input name="from" type="date" defaultValue={range.from} aria-label={tc("from")} className="h-10 w-40" />
      <Input name="to" type="date" defaultValue={range.to} aria-label={tc("to")} className="h-10 w-40" />
      <Button type="submit" variant="secondary" className="h-10">
        {tc("apply")}
      </Button>
    </form>
  );

  return (
    <PrintFrame ctx={ctx} backHref={`/customers/${id}`} title={t("statement")} toolbarExtra={rangeForm}>
      <section className="space-y-0.5 text-sm">
        <Row label={t("customer")} value={lang === "bn" && c.nameBn ? c.nameBn : c.name} />
        <Row label={t("phone")} value={fmt.phone(c.phone)} />
        <p className="pt-1 text-xs">{t("period", { from: fmt.date(range.from), to: fmt.date(range.to) })}</p>
      </section>

      <table className="mt-3 w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-black/60 text-left">
            <th className="py-1">{t("date")}</th>
            <th className="py-1">{t("description")}</th>
            <th className="py-1 text-right">{t("debit")}</th>
            <th className="py-1 text-right">{t("credit")}</th>
            <th className="py-1 text-right">{t("balance")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black/20">
            <td className="py-1" colSpan={4}>
              {t("openingBalanceLine")}
            </td>
            <td className="money py-1 text-right">{fmt.money(ledger.openingBalanceMinor)}</td>
          </tr>
          {ledger.entries.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center">
                {t("noEntries")}
              </td>
            </tr>
          )}
          {ledger.entries.map((e) => (
            <tr key={`${e.kind}-${e.refId}`} className={`border-b border-black/20 ${e.voided || e.cancelled ? "line-through opacity-60" : ""}`}>
              <td className="py-1 whitespace-nowrap">{fmt.date(e.at, "short")}</td>
              <td className="py-1">
                {te(`ledgerKind.${e.kind}`)} {e.ref}
                {e.detail && ` · ${detail(e.kind, e.detail)}`}
                {e.voided && ` · ${t("void")}`}
              </td>
              <td className="money py-1 text-right">{e.debitMinor ? fmt.money(e.debitMinor) : ""}</td>
              <td className="money py-1 text-right">{e.creditMinor ? fmt.money(e.creditMinor) : ""}</td>
              <td className="money py-1 text-right">{fmt.money(e.balanceMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-1" colSpan={4}>
              {t("closingBalance")}
            </td>
            <td className="money py-1 text-right">{fmt.money(closing)}</td>
          </tr>
        </tfoot>
      </table>

      {open.length > 0 && (
        <section className="mt-4 text-sm">
          <p className="font-semibold">{t("openInstallments")}</p>
          {open.map((i) => (
            <Row
              key={i.id}
              label={`${fmt.date(i.dueDate)} · ${i.saleNumber ? `${i.saleNumber} ${t("installmentN", { n: fmt.number(i.seq) })}` : t("openingBalance")}`}
              value={fmt.money(i.remainingMinor)}
            />
          ))}
        </section>
      )}
      <p className="mt-4 text-right text-xs">{t("printedOn", { date: fmt.date(ShopDate.fromInstant(new Date())) })}</p>
    </PrintFrame>
  );
}
