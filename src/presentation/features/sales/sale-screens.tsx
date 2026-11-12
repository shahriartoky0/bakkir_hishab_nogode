import { Banknote, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { applicableFields } from "@/domain/catalog/field-definition";
import { ShopDate } from "@/domain/shared/shop-date";
import { PageHeader } from "../../components/page-header";
import { StatusBadge, installmentTone, promiseTone, saleTone } from "../../components/status-badge";
import { Thumb } from "../../components/thumb";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { customFieldInputValue, customFieldText } from "../../lib/custom-field-text";
import { getFormat } from "../../lib/format-server";
import { currentLang, customerName, signPhotos, textPicker } from "../../lib/server";
import { FollowUpSheet } from "../followups/follow-up-sheet";
import { CancelSaleButton } from "./record-actions";
import { SaleGallery } from "./sale-gallery";
import { SaleWizard } from "./wizard/sale-wizard";
import type { ItemDraft, PlanDraft } from "./wizard/draft";

async function catalogData() {
  const catalog = container.catalog();
  const [categories, fields] = await Promise.all([catalog.listCategories(), catalog.listFields()]);
  return { categories, fields };
}

export async function NewSaleScreen({ customerId }: { customerId?: string }) {
  const t = await getTranslations("sales.wizard");
  const [{ categories, fields }, settings] = await Promise.all([catalogData(), container.settings()]);
  const lang = await currentLang();
  let initialCustomer = null;
  if (customerId) {
    const p = await container.queries().customerProfile(customerId);
    if (p && !p.customer.archivedAt) {
      const urls = await signPhotos([p.customer.photoThumbKey]);
      initialCustomer = {
        id: p.customer.id,
        name: customerName(p.customer, lang),
        phone: p.customer.phone,
        thumbUrl: p.customer.photoThumbKey ? (urls[p.customer.photoThumbKey] ?? null) : null,
        balanceMinor: p.balanceMinor,
        isBlocked: p.customer.isBlocked,
      };
    }
  }
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} backHref={customerId ? `/customers/${customerId}` : "/"} />
      <SaleWizard
        categories={categories.filter((c) => !c.archivedAt)}
        fields={fields.filter((f) => !f.archivedAt)}
        todayIso={ShopDate.fromInstant(new Date()).iso}
        defaultCreditDays={settings.defaultCreditDays}
        initialCustomer={initialCustomer}
      />
    </section>
  );
}

export async function SaleDetailScreen({ id }: { id: string }) {
  const q = container.queries();
  const detail = await q.saleDetail(id);
  if (!detail) notFound();
  const [{ categories, fields }, followUps] = await Promise.all([catalogData(), q.customerFollowUps(detail.customer.id)]);
  const t = await getTranslations("sales.detail");
  const tc = await getTranslations("common");
  const te = await getTranslations("enums");
  const fmt = await getFormat();
  const text = await textPicker();
  const lang = await currentLang();
  const { sale, customer, items } = detail;
  const name = customerName(customer, lang);
  const photos = items.flatMap((i) => i.photos.map((p) => ({ ...p, item: i.name })));
  const urls = await signPhotos([customer.photoThumbKey, ...photos.flatMap((p) => [p.thumbKey, p.fileKey])]);
  const defsFor = (categoryId: string | null) => new Map(applicableFields(categoryId, categories, fields, { includeArchived: true }).map((f) => [f.key, f]));
  const saleFollowUps = followUps.filter((f) => f.saleId === sale.id);
  const cat = (cid: string | null) => {
    const c = categories.find((x) => x.id === cid);
    if (!c) return null;
    const parent = c.parentId ? categories.find((x) => x.id === c.parentId) : null;
    return [parent && text(parent.nameBn, parent.nameEn), text(c.nameBn, c.nameEn)].filter(Boolean).join(" › ");
  };
  const fmtCtx = { fmt: { money: fmt.money, number: (n: number) => fmt.number(n), date: (d: string) => fmt.date(d) }, text, yes: tc("yes"), no: tc("no") };

  return (
    <section className="space-y-4">
      <PageHeader
        title={sale.saleNumber}
        description={fmt.date(sale.saleDate, "long")}
        backHref={`/customers/${customer.id}`}
        actions={<StatusBadge tone={saleTone(sale.status)}>{te(`saleStatus.${sale.status}`)}</StatusBadge>}
      />

      <Card>
        <CardContent className="space-y-3">
          <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 hover:underline">
            <Thumb url={customer.photoThumbKey ? urls[customer.photoThumbKey] : null} alt={tc("photoOf", { name })} kind="person" />
            <span>
              <span className="block font-semibold">{name}</span>
              <span className="block text-sm text-muted-foreground">{fmt.phone(customer.phone)}</span>
            </span>
          </Link>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">{tc("total")}</dt>
              <dd className="money font-semibold">{fmt.money(sale.totalMinor)}</dd>
            </div>
            <div className="rounded-lg bg-success-soft p-2">
              <dt className="text-xs text-muted-foreground">{t("paid")}</dt>
              <dd className="money font-semibold text-success">{fmt.money(detail.paidMinor)}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">{t("remaining")}</dt>
              <dd className="money font-semibold">{fmt.money(detail.remainingMinor)}</dd>
            </div>
          </dl>
          <div className="no-print flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link href={`/sales/${sale.id}/receipt`}>
                <Printer className="size-5" aria-hidden /> {t("receipt")}
              </Link>
            </Button>
            {sale.status === "open" && detail.remainingMinor > 0 && (
              <Button asChild className="h-11">
                <Link href={`/customers/${customer.id}/pay?sale=${sale.id}`}>
                  <Banknote className="size-5" aria-hidden /> {t("receivePayment")}
                </Link>
              </Button>
            )}
            <FollowUpSheet customerId={customer.id} customerName={name} saleId={sale.id} />
            {detail.editable && (
              <Button asChild variant="outline" className="h-11">
                <Link href={`/sales/${sale.id}/edit`}>
                  <Pencil className="size-5" aria-hidden /> {tc("edit")}
                </Link>
              </Button>
            )}
            {detail.cancellable && <CancelSaleButton saleId={sale.id} />}
          </div>
          {!detail.editable && sale.status === "open" && <p className="text-xs text-muted-foreground">{t("editLocked")}</p>}
          {sale.cancelReason && <p className="text-sm text-muted-foreground">{t("cancelReason", { reason: sale.cancelReason })}</p>}
        </CardContent>
      </Card>

      <SaleGallery
        photos={photos.map((p) => ({ thumbUrl: urls[p.thumbKey] ?? null, fullUrl: urls[p.fileKey] ?? null, alt: p.item }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("items")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="space-y-1 py-3">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[cat(it.categoryId), `${fmt.number(it.quantity)} × ${fmt.money(it.unitPriceMinor)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="money font-semibold">{fmt.money(it.lineTotalMinor)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3">
                {Object.entries(it.customFields).map(([key, value]) => {
                  const f = defsFor(it.categoryId).get(key);
                  const shown = f ? customFieldText(f, value, fmtCtx) : String(value);
                  if (!shown) return null;
                  return (
                    <div key={key}>
                      <dt className="text-xs text-muted-foreground">{f ? text(f.labelBn, f.labelEn) : key}</dt>
                      <dd>{shown}</dd>
                    </div>
                  );
                })}
              </dl>
              {it.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{it.notes}</p>}
            </div>
          ))}
          <dl className="space-y-1 pt-3 text-sm">
            <div className="flex justify-between">
              <dt>{t("subtotal")}</dt>
              <dd className="money">{fmt.money(sale.subtotalMinor)}</dd>
            </div>
            {sale.discountMinor > 0 && (
              <div className="flex justify-between">
                <dt>{t("discount")}</dt>
                <dd className="money">−{fmt.money(sale.discountMinor)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <dt>{tc("total")}</dt>
              <dd className="money">{fmt.money(sale.totalMinor)}</dd>
            </div>
          </dl>
          {sale.notes && <p className="pt-3 text-sm whitespace-pre-line">{sale.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("schedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {detail.installments.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-16 text-sm text-muted-foreground">{i.seq === 0 ? t("upfront") : `#${fmt.number(i.seq)}`}</span>
                <span className="flex-1">{fmt.date(i.dueDate)}</span>
                <StatusBadge tone={installmentTone(i.status)}>
                  {te(`installmentStatus.${i.status}`)}
                  {i.daysOverdue > 0 && ` · ${tc("daysOverdue", { days: fmt.number(i.daysOverdue) })}`}
                </StatusBadge>
                <span className="w-full text-right sm:w-auto">
                  <span className="money font-medium">{fmt.money(i.amountMinor)}</span>
                  {i.paidMinor > 0 && i.remainingMinor > 0 && (
                    <span className="money block text-xs text-muted-foreground">{t("left", { amount: fmt.money(i.remainingMinor) })}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("applied")}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.applied.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <ul className="divide-y">
              {detail.applied.map((a) => {
                const label = a.kind === "payment" ? te(`paymentMethod.${a.method ?? "other"}`) : te(`adjustmentType.${a.adjustmentType ?? "correction"}`);
                const row = (
                  <div className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {a.ref} · {label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {fmt.date(a.at)}
                        {a.isUpfront && ` · ${t("upfront")}`}
                      </span>
                    </span>
                    <span className="money font-medium text-success">{fmt.money(a.amountMinor)}</span>
                  </div>
                );
                return <li key={`${a.kind}-${a.id}`}>{a.kind === "payment" ? <Link href={`/payments/${a.id}`} className="block hover:bg-accent">{row}</Link> : row}</li>;
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {saleFollowUps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("followUps")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {saleFollowUps.map((f) => (
              <div key={f.id} className="space-y-1 py-2">
                <p className="text-sm font-medium">
                  {te(`channel.${f.channel}`)} · {te(`outcome.${f.outcome}`)} · {fmt.date(f.createdAt)}
                </p>
                {f.promiseStatus && <StatusBadge tone={promiseTone(f.promiseStatus)}>{te(`promiseStatus.${f.promiseStatus}`)}</StatusBadge>}
                {f.note && <p className="text-sm">{f.note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export async function EditSaleScreen({ id }: { id: string }) {
  const detail = await container.queries().saleDetail(id);
  if (!detail) notFound();
  if (!detail.editable) redirect(`/sales/${id}`);
  const t = await getTranslations("sales.wizard");
  const [{ categories, fields }, settings] = await Promise.all([catalogData(), container.settings()]);
  const urls = await signPhotos(detail.items.flatMap((i) => i.photos.map((p) => p.thumbKey)));

  const items: ItemDraft[] = detail.items.map((it) => ({
    key: it.id,
    categoryId: it.categoryId,
    name: it.name,
    quantity: String(it.quantity),
    price: String(it.unitPriceMinor / 100),
    custom: Object.fromEntries(
      Object.entries(it.customFields).map(([k, v]) => {
        const f = applicableFields(it.categoryId, categories, fields, { includeArchived: true }).find((x) => x.key === k);
        return [k, f ? customFieldInputValue(f, v) : String(v)];
      }),
    ),
    notes: it.notes ?? "",
    photos: it.photos.map((p) => ({ fileKey: p.fileKey, thumbKey: p.thumbKey, previewUrl: urls[p.thumbKey] ?? "" })),
  }));

  const rest = detail.installments.filter((i) => i.seq >= 1).sort((a, b) => a.seq - b.seq);
  const upfrontMinor = detail.installments.find((i) => i.seq === 0)?.amountMinor ?? 0;
  const saleDate = ShopDate.of(detail.sale.saleDate);
  const plan: PlanDraft =
    rest.length <= 1
      ? {
          kind: "single",
          dueDate: rest[0]?.dueDate ?? saleDate.addDays(settings.defaultCreditDays).iso,
          count: "3",
          frequency: "monthly",
          firstDate: saleDate.addMonths(1).iso,
          amounts: null,
        }
      : {
          kind: "installments",
          dueDate: rest[0]!.dueDate,
          count: String(rest.length),
          frequency: ShopDate.of(rest[1]!.dueDate).daysSince(ShopDate.of(rest[0]!.dueDate)) === 7 ? "weekly" : "monthly",
          firstDate: rest[0]!.dueDate,
          amounts: rest.map((i) => String(i.amountMinor / 100)),
        };

  return (
    <section className="space-y-4">
      <PageHeader title={t("editTitle", { number: detail.sale.saleNumber })} backHref={`/sales/${id}`} />
      <SaleWizard
        categories={categories.filter((c) => !c.archivedAt || items.some((i) => i.categoryId === c.id))}
        fields={fields.filter((f) => !f.archivedAt)}
        todayIso={ShopDate.fromInstant(new Date()).iso}
        defaultCreditDays={settings.defaultCreditDays}
        edit={{
          saleId: id,
          saleDate: detail.sale.saleDate,
          items,
          discount: detail.sale.discountMinor ? String(detail.sale.discountMinor / 100) : "",
          notes: detail.sale.notes ?? "",
          upfrontMinor,
          plan,
        }}
      />
    </section>
  );
}
