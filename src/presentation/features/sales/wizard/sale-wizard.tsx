"use client";

import { Banknote, Check, Loader2, Plus } from "@/presentation/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Category } from "@/domain/catalog/category";
import type { FieldDefinition } from "@/domain/catalog/field-definition";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment/payment";
import { MAX_ITEMS } from "@/domain/sale/sale";
import { ShopDate } from "@/domain/shared/shop-date";
import { createSaleAction, updateSaleAction } from "../../../actions/sales";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { NumericInput } from "../../../components/numeric-input";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useErrorText } from "../../../hooks/use-error-text";
import { useValidationText } from "../../../hooks/use-validation-text";
import { moneyIssue } from "../../../lib/numeric";
import { useZodErrorMap } from "../../../hooks/use-zod-error-map";
import { useFormat } from "../../../lib/format-context";
import { cn } from "../../../lib/utils";
import { CustomerStep, type PickedCustomer } from "./customer-step";
import {
  hasErrors,
  itemPayload,
  lineTotal,
  newItem,
  parseCount,
  parseMoney,
  planPayload,
  previewSchedule,
  validateItem,
  type ItemDraft,
  type ItemErrors,
  type PaymentDraft,
  type PlanDraft,
} from "./draft";
import { ItemEditor } from "./item-editor";
import { ScheduleStep } from "./schedule-step";

type Step = "customer" | "items" | "payment" | "schedule" | "review";

export interface SaleWizardEdit {
  saleId: string;
  saleDate: string;
  items: ItemDraft[];
  discount: string;
  notes: string;
  upfrontMinor: number;
  plan: PlanDraft;
}

export function SaleWizard({
  categories,
  fields,
  todayIso,
  defaultCreditDays,
  initialCustomer,
  edit,
}: {
  categories: Category[];
  fields: FieldDefinition[];
  todayIso: string;
  defaultCreditDays: number;
  initialCustomer?: PickedCustomer | null;
  edit?: SaleWizardEdit;
}) {
  const t = useTranslations("sales.wizard");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const errorText = useErrorText();
  const vt = useValidationText();
  const errorMap = useZodErrorMap();
  const fmt = useFormat();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const steps: Step[] = edit ? ["items", "payment", "schedule", "review"] : ["customer", "items", "payment", "schedule", "review"];
  const [step, setStep] = useState<Step>(edit ? "items" : initialCustomer ? "items" : "customer");
  const [customer, setCustomer] = useState<PickedCustomer | null>(initialCustomer ?? null);
  const [items, setItems] = useState<ItemDraft[]>(edit?.items ?? [newItem()]);
  const [itemErrors, setItemErrors] = useState<Record<string, ItemErrors>>({});
  const saleDate = ShopDate.of(edit?.saleDate ?? todayIso);
  const defaultDue = saleDate.addDays(defaultCreditDays).iso;
  const [payment, setPayment] = useState<PaymentDraft>({ discount: edit?.discount ?? "", upfront: "", method: "cash", reference: "" });
  const [plan, setPlan] = useState<PlanDraft>(
    edit?.plan ?? { kind: "single", dueDate: defaultDue, count: "3", frequency: "monthly", firstDate: saleDate.addMonths(1).iso, amounts: null },
  );
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ blocked: boolean; overLimit: boolean } | null>(null);
  // One key per wizard session: a double tap or retry returns the same sale.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const subtotal = useMemo(() => items.reduce((s, i) => s + lineTotal(i), 0), [items]);
  const discount = parseMoney(payment.discount) ?? 0;
  const total = subtotal - discount;
  const upfront = edit ? edit.upfrontMinor : (parseMoney(payment.upfront) ?? 0);
  const financed = Math.max(0, total - upfront);

  // Field-level messages for the discount / upfront inputs (shown live once touched).
  const [showPaymentErrors, setShowPaymentErrors] = useState(false);
  const discountIssue = moneyIssue(payment.discount, { required: false });
  const discountError = discountIssue
    ? vt(discountIssue === "tooBig" ? "tooBigNumber" : discountIssue)
    : discount > subtotal
      ? vt("discountTooLarge", { max: fmt.money(subtotal) })
      : null;
  const upfrontIssue = edit ? null : moneyIssue(payment.upfront, { required: false });
  const upfrontError = upfrontIssue
    ? vt(upfrontIssue === "tooBig" ? "tooBigNumber" : upfrontIssue)
    : !edit && upfront > Math.max(0, total)
      ? vt("upfrontTooLarge", { max: fmt.money(Math.max(0, total)) })
      : null;

  const index = steps.indexOf(step);
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function validateStep(s: Step): boolean {
    switch (s) {
      case "customer":
        return customer !== null;
      case "items": {
        const errs: Record<string, ItemErrors> = {};
        for (const it of items) {
          const e = validateItem(it, categories, fields, errorMap);
          if (hasErrors(e)) errs[it.key] = e;
        }
        setItemErrors(errs);
        if (Object.keys(errs).length) toast.error(t("fixItems"));
        return Object.keys(errs).length === 0;
      }
      case "payment": {
        setShowPaymentErrors(true);
        if (discountError || upfrontError) return false;
        if (total <= 0) return setPaymentError("INVALID_AMOUNT"), false;
        setPaymentError(null);
        return true;
      }
      case "schedule":
        return financed === 0 || previewSchedule(financed, plan, saleDate).ok;
      default:
        return true;
    }
  }

  function next() {
    if (!validateStep(step)) return;
    const n = steps[index + 1];
    if (n) go(n);
  }

  function submit(confirmWarnings = false) {
    for (const s of steps) if (!validateStep(s)) return go(s);
    const planP = financed === 0 ? { kind: "single" as const, dueDate: saleDate.iso } : planPayload(plan);
    if (!planP) return go("schedule");
    const payloadItems = items.map((i) => itemPayload(i, categories, fields));

    startTransition(async () => {
      if (edit) {
        const r = await updateSaleAction({ saleId: edit.saleId, items: payloadItems, discountMinor: discount, plan: planP, notes: notes.trim() || null });
        if (!r.ok) return void toast.error(errorText(r.code, r.details));
        toast.success(t("updated"));
        router.push(`/sales/${edit.saleId}`);
        router.refresh();
        return;
      }
      const r = await createSaleAction({
        idempotencyKey,
        customerId: customer!.id,
        items: payloadItems,
        discountMinor: discount,
        upfront: upfront > 0 ? { amountMinor: upfront, method: payment.method, reference: payment.reference.trim() || null } : null,
        plan: planP,
        notes: notes.trim() || null,
        confirmWarnings,
      });
      if (!r.ok) {
        if (r.code === "CREDIT_WARNING") return setWarning({ blocked: Boolean(r.details?.blocked), overLimit: Boolean(r.details?.overLimit) });
        return void toast.error(errorText(r.code, r.details));
      }
      toast.success(t("saved"));
      router.push(`/sales/${r.data.saleId}`);
      router.refresh();
    });
  }

  const schedule = financed > 0 ? previewSchedule(financed, plan, saleDate) : null;

  return (
    <div className="space-y-4">
      <ol className="flex items-start rounded-2xl border bg-card px-2 py-3 shadow-card" aria-label={t("progress")}>
        {steps.map((s, i) => {
          const done = i < index;
          const current = s === step;
          return (
            <li key={s} className="relative flex-1">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", i <= index ? "bg-primary" : "bg-border")}
                />
              )}
              <button
                type="button"
                disabled={i > index}
                onClick={() => go(s)}
                aria-current={current ? "step" : undefined}
                className="relative flex w-full flex-col items-center gap-1.5 text-[11px] leading-tight disabled:cursor-default"
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors duration-150",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-brand-gold bg-brand-gold text-brand-gold-foreground",
                    !done && !current && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" weight="bold" aria-hidden /> : fmt.number(i + 1)}
                </span>
                <span className={cn("line-clamp-2 px-0.5 text-center", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {t(`steps.${s}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <h2 className="text-xl font-bold">{t(`steps.${step}`)}</h2>

      {step === "customer" && <CustomerStep value={customer} onChange={setCustomer} />}

      {step === "items" && (
        <div className="space-y-4">
          {items.map((it, i) => (
            <ItemEditor
              key={it.key}
              index={i}
              item={it}
              errors={itemErrors[it.key] ?? {}}
              categories={categories}
              fields={fields}
              onChange={(updated) => {
                setItems(items.map((x) => (x.key === it.key ? updated : x)));
                // After the first "Next", keep this item's messages live so they clear as soon as fixed.
                if (itemErrors[it.key]) {
                  const e = validateItem(updated, categories, fields, errorMap);
                  setItemErrors((prev) => {
                    const next = { ...prev };
                    if (hasErrors(e)) next[it.key] = e;
                    else delete next[it.key];
                    return next;
                  });
                }
              }}
              onRemove={items.length > 1 ? () => setItems(items.filter((x) => x.key !== it.key)) : undefined}
            />
          ))}
          {items.length < MAX_ITEMS && (
            <Button variant="outline" className="h-12 w-full" onClick={() => setItems([...items, newItem()])}>
              <Plus className="size-5" aria-hidden /> {t("addItem")}
            </Button>
          )}
        </div>
      )}

      {step === "payment" && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>{t("subtotal")}</span>
              <span className="money font-semibold">{fmt.money(subtotal)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount">{t("discount")}</Label>
              <NumericInput
                id="discount"
                kind="money"
                value={payment.discount}
                onValueChange={(v) => (setPayment({ ...payment, discount: v }), setShowPaymentErrors(true))}
                error={showPaymentErrors ? discountError : null}
              />
            </div>
            <div className="flex justify-between border-t pt-3 text-lg">
              <span>{tc("total")}</span>
              <span className="money font-semibold">{fmt.money(Math.max(0, total))}</span>
            </div>
            {edit ? (
              edit.upfrontMinor > 0 && (
                <p className="text-sm text-muted-foreground">{t("upfrontFixed", { amount: fmt.money(edit.upfrontMinor) })}</p>
              )
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{t("upfront")}</p>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <NumericInput
                      kind="money"
                      aria-label={t("upfrontAmount")}
                      placeholder={t("upfrontAmount")}
                      className="flex-1"
                      value={payment.upfront}
                      onValueChange={(v) => (setPayment({ ...payment, upfront: v }), setShowPaymentErrors(true))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 shrink-0"
                      disabled={total <= 0}
                      title={t("payFullHint")}
                      onClick={() => (setPayment({ ...payment, upfront: String(total / 100) }), setShowPaymentErrors(true), setPaymentError(null))}
                    >
                      <Banknote className="size-5" aria-hidden /> {t("payFull")}
                    </Button>
                  </div>
                  {showPaymentErrors && upfrontError && (
                    <p className="text-sm font-medium text-destructive" role="alert">
                      {upfrontError}
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v as PaymentMethod })}>
                    <SelectTrigger className="h-12 w-full text-base" aria-label={t("method")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {te(`paymentMethod.${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={t("reference")}
                    placeholder={t("reference")}
                    className="h-12 text-base"
                    value={payment.reference}
                    onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between text-lg">
              <span>{t("onCredit")}</span>
              <span className="money font-semibold text-destructive">{fmt.money(financed)}</span>
            </div>
            {paymentError && (
              <p className="text-sm text-destructive" role="alert">
                {errorText(paymentError)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === "schedule" && <ScheduleStep plan={plan} onChange={setPlan} financedMinor={financed} saleDate={saleDate} />}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer && (
              <p>
                <span className="text-muted-foreground">{t("customer")}: </span>
                <span className="font-medium">{customer.name}</span> · {fmt.phone(customer.phone)}
              </p>
            )}
            <ul className="divide-y rounded-lg border">
              {items.map((it) => (
                <li key={it.key} className="flex items-center gap-3 p-2">
                  {it.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element -- local/presigned preview
                    <img src={it.photos[0].previewUrl} alt={it.name} className="size-12 rounded-md object-cover" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {it.name} × {fmt.number(parseCount(it.quantity) ?? 1)}
                  </span>
                  <span className="money">{fmt.money(lineTotal(it))}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>{t("subtotal")}</dt>
                <dd className="money">{fmt.money(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <dt>{t("discount")}</dt>
                  <dd className="money">−{fmt.money(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <dt>{tc("total")}</dt>
                <dd className="money">{fmt.money(total)}</dd>
              </div>
              {upfront > 0 && (
                <div className="flex justify-between">
                  <dt>{t("upfront")}</dt>
                  <dd className="money">−{fmt.money(upfront)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-destructive">
                <dt>{t("onCredit")}</dt>
                <dd className="money">{fmt.money(financed)}</dd>
              </div>
            </dl>
            {schedule?.ok && (
              <ol className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                {schedule.schedule.map((s) => (
                  <li key={s.seq} className="flex justify-between">
                    <span>{fmt.date(s.dueDate)}</span>
                    <span className="money">{fmt.money(s.amountMinor)}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sale-notes">
                {tc("notes")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
              </Label>
              <Textarea id="sale-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {index > 0 && (
          <Button variant="outline" className="h-12 flex-1" disabled={pending} onClick={() => go(steps[index - 1]!)}>
            {tc("previous")}
          </Button>
        )}
        {step === "review" ? (
          <Button className="h-12 flex-[2]" disabled={pending} onClick={() => submit(false)}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />}
            {pending ? tc("saving") : edit ? t("saveChanges") : t("save")}
          </Button>
        ) : (
          <Button className="h-12 flex-[2]" disabled={step === "customer" && !customer} onClick={next}>
            {tc("next")}
          </Button>
        )}
      </div>

      <AlertDialog open={warning !== null} onOpenChange={(o) => !o && setWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("warningTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                {warning?.blocked && <p>{t("warningBlocked")}</p>}
                {warning?.overLimit && <p>{t("warningOverLimit")}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                setWarning(null);
                submit(true);
              }}
            >
              {t("continueAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
