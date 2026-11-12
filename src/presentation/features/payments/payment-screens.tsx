import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { ShopDate } from "@/domain/shared/shop-date";
import { PageHeader } from "../../components/page-header";
import { currentLang, customerName } from "../../lib/server";
import { AdjustmentForm } from "./adjustment-form";
import { PaymentForm, type PayableSale } from "./payment-form";

async function load(customerId: string) {
  const profile = await container.queries().customerProfile(customerId);
  if (!profile) notFound();
  const lang = await currentLang();
  const sales: PayableSale[] = profile.openSales
    .filter((s) => s.remainingMinor > 0)
    .map((s) => ({ id: s.id, saleNumber: s.saleNumber, label: s.items.map((i) => i.name).join(", "), remainingMinor: s.remainingMinor }));
  return { profile, name: customerName(profile.customer, lang), sales, todayIso: ShopDate.fromInstant(new Date()).iso };
}

export async function ReceivePaymentScreen({ customerId, saleId }: { customerId: string; saleId?: string }) {
  const t = await getTranslations("payments.form");
  const { profile, name, sales, todayIso } = await load(customerId);
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} description={name} backHref={`/customers/${customerId}`} />
      <PaymentForm customerId={customerId} balanceMinor={profile.balanceMinor} sales={sales} initialSaleId={saleId} todayIso={todayIso} />
    </section>
  );
}

export async function AdjustmentScreen({ customerId }: { customerId: string }) {
  const t = await getTranslations("payments.adjust");
  const { profile, name, sales, todayIso } = await load(customerId);
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} description={name} backHref={`/customers/${customerId}`} />
      <AdjustmentForm customerId={customerId} balanceMinor={profile.balanceMinor} sales={sales} todayIso={todayIso} />
    </section>
  );
}
