import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { applicableFields } from "@/domain/catalog/field-definition";
import { customFieldText } from "../../lib/custom-field-text";
import { VoidPaymentButton } from "../sales/record-actions";
import { PrintFrame, Row, printContext, type PrintParams } from "./print-frame";

const nameIn = (c: { name: string; nameBn: string | null }, lang: "bn" | "en") => (lang === "bn" && c.nameBn ? c.nameBn : c.name);

export async function SaleReceipt({ id, sp }: { id: string; sp: PrintParams }) {
  const detail = await container.queries().saleDetail(id);
  if (!detail) notFound();
  const ctx = await printContext(sp);
  const { t, fmt, text, lang } = ctx;
  const catalog = container.catalog();
  const [categories, fields] = await Promise.all([catalog.listCategories(), catalog.listFields()]);
  const { sale, customer, items } = detail;
  const fctx = { fmt: { money: fmt.money, number: (n: number) => fmt.number(n), date: (d: string) => fmt.date(d) }, text, yes: t("yes"), no: t("no") };
  const upfront = detail.applied.filter((a) => a.isUpfront).reduce((s, a) => s + a.amountMinor, 0);

  return (
    <PrintFrame ctx={ctx} backHref={`/sales/${id}`} title={t("saleReceipt")} number={sale.saleNumber}>
      <section className="space-y-0.5 text-sm">
        <Row label={t("date")} value={fmt.date(sale.saleDate)} />
        <Row label={t("customer")} value={nameIn(customer, lang)} />
        <Row label={t("phone")} value={fmt.phone(customer.phone)} />
        {sale.status === "cancelled" && <p className="font-bold text-red-600">{t("cancelled")}</p>}
      </section>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-black/60 text-left">
            <th className="py-1">{t("item")}</th>
            <th className="py-1 text-right">{t("qty")}</th>
            <th className="py-1 text-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const defs = applicableFields(it.categoryId, categories, fields, { includeArchived: true }).filter((f) => f.showOnReceipt);
            const extras = defs
              .map((f) => {
                const v = customFieldText(f, it.customFields[f.key], fctx);
                return v ? `${text(f.labelBn, f.labelEn)}: ${v}` : null;
              })
              .filter(Boolean);
            return (
              <tr key={it.id} className="border-b border-black/20 align-top">
                <td className="py-1">
                  <p className="font-medium">{it.name}</p>
                  {extras.length > 0 && <p className="text-xs">{extras.join(" · ")}</p>}
                </td>
                <td className="money py-1 text-right">{fmt.number(it.quantity)}</td>
                <td className="money py-1 text-right">{fmt.money(it.lineTotalMinor)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="mt-2 text-sm">
        <Row label={t("subtotal")} value={fmt.money(sale.subtotalMinor)} />
        {sale.discountMinor > 0 && <Row label={t("discount")} value={`−${fmt.money(sale.discountMinor)}`} />}
        <Row label={t("total")} value={fmt.money(sale.totalMinor)} strong />
        {upfront > 0 && <Row label={t("upfront")} value={fmt.money(upfront)} />}
        <Row label={t("paid")} value={fmt.money(detail.paidMinor)} />
        <Row label={t("due")} value={fmt.money(detail.remainingMinor)} strong />
      </section>

      {detail.installments.some((i) => i.seq >= 1) && (
        <section className="mt-3 text-sm">
          <p className="font-semibold">{t("schedule")}</p>
          {detail.installments
            .filter((i) => i.seq >= 1)
            .map((i) => (
              <Row key={i.id} label={`${fmt.number(i.seq)}. ${fmt.date(i.dueDate)}`} value={fmt.money(i.amountMinor)} />
            ))}
        </section>
      )}

      <p className="mt-8 flex justify-between text-xs">
        <span className="border-t border-black/60 px-4 pt-1">{t("customerSign")}</span>
        <span className="border-t border-black/60 px-4 pt-1">{t("shopSign")}</span>
      </p>
    </PrintFrame>
  );
}

export async function PaymentReceipt({ id, sp }: { id: string; sp: PrintParams }) {
  const detail = await container.queries().paymentDetail(id);
  if (!detail) notFound();
  const ctx = await printContext(sp);
  const { t, fmt, lang } = ctx;
  const tEnums = await getTranslations({ locale: lang, namespace: "enums" });
  const { payment, customer } = detail;
  const voided = payment.status === "voided";

  return (
    <PrintFrame
      ctx={ctx}
      backHref={`/customers/${customer.id}`}
      title={t("paymentReceipt")}
      number={payment.receiptNumber}
      voided={voided}
      toolbarExtra={!voided ? <VoidPaymentButton paymentId={payment.id} /> : undefined}
    >
      <section className="space-y-0.5 text-sm">
        <Row label={t("date")} value={fmt.dateTime(payment.paidAt)} />
        <Row label={t("customer")} value={nameIn(customer, lang)} />
        <Row label={t("phone")} value={fmt.phone(customer.phone)} />
        <Row label={t("method")} value={tEnums(`paymentMethod.${payment.method}`)} />
        {payment.reference && <Row label={t("reference")} value={payment.reference} />}
      </section>

      <p className="my-3 rounded border border-black/60 py-2 text-center">
        <span className="block text-xs">{t("received")}</span>
        <span className="money block text-2xl font-bold">{fmt.money(payment.amountMinor)}</span>
      </p>

      {detail.allocations.length > 0 && (
        <section className="text-sm">
          <p className="font-semibold">{t("appliedTo")}</p>
          {detail.allocations.map((a, i) => (
            <Row
              key={i}
              label={a.saleNumber ? `${a.saleNumber} · ${t("installmentN", { n: fmt.number(a.seq) })}` : t("openingBalance")}
              value={fmt.money(a.amountMinor)}
            />
          ))}
        </section>
      )}
      {!voided && <Row label={t("balanceAfter")} value={fmt.money(detail.customerBalanceMinor)} strong />}
      {payment.note && <p className="mt-2 text-sm">{payment.note}</p>}
      {voided && payment.voidReason && <p className="mt-2 text-sm">{t("voidReason", { reason: payment.voidReason })}</p>}
    </PrintFrame>
  );
}
