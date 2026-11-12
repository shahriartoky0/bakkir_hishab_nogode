"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment/payment";
import { toLatinDigits } from "@/domain/shared/digits";
import { ShopDate } from "@/domain/shared/shop-date";
import { receivePaymentAction } from "../../actions/payments";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { useErrorText } from "../../hooks/use-error-text";
import { useValidationText } from "../../hooks/use-validation-text";
import { issueKey, moneyIssue, toMinor } from "../../lib/numeric";
import { NumericInput } from "../../components/numeric-input";
import { useFormat } from "../../lib/format-context";
import { optionClass } from "../../components/chip";

export interface PayableSale {
  id: string;
  saleNumber: string;
  label: string;
  remainingMinor: number;
}

/** Receive a payment: oldest due first by default, or applied to one sale (spec 6.4). */
export function PaymentForm({
  customerId,
  balanceMinor,
  sales,
  initialSaleId,
  todayIso,
}: {
  customerId: string;
  balanceMinor: number;
  sales: PayableSale[];
  initialSaleId?: string | null;
  todayIso: string;
}) {
  const t = useTranslations("payments.form");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const fmt = useFormat();
  const errorText = useErrorText();
  const vt = useValidationText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState("");
  const [saleId, setSaleId] = useState<string | null>(initialSaleId && sales.some((s) => s.id === initialSaleId) ? initialSaleId : null);
  // Error *code* (translated at render, so it follows a language switch).
  const [error, setError] = useState<{ code: string; details?: Record<string, string | number | boolean | null> } | null>(null);

  const max = saleId ? (sales.find((s) => s.id === saleId)?.remainingMinor ?? 0) : balanceMinor;
  const [touched, setTouched] = useState(false);
  const minor = toMinor(amount);
  const issue = moneyIssue(amount);
  const amountError = issue
    ? vt(issueKey(issue))
    : minor !== null && minor <= 0
      ? vt("minValue", { min: fmt.money(1) })
      : minor !== null && minor > max
        ? vt("amountTooLarge", { max: fmt.money(max) })
        : null;

  function submit() {
    setTouched(true);
    if (amountError || minor === null) return;
    const d = ShopDate.parse(toLatinDigits(date));
    if (!d.ok || d.value.isAfter(ShopDate.of(todayIso))) return setError({ code: "INVALID_DATE" });
    setError(null);
    startTransition(async () => {
      const r = await receivePaymentAction({
        idempotencyKey,
        customerId,
        amountMinor: minor,
        method,
        reference: reference.trim() || null,
        date: d.value.iso,
        note: note.trim() || null,
        saleId,
      });
      if (!r.ok) return setError({ code: r.code, details: r.details });
      toast.success(t("saved"));
      router.push(`/payments/${r.data.paymentId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between rounded-lg bg-muted p-3">
          <span className="text-sm">{saleId ? t("saleDue") : t("totalDue")}</span>
          <span className="money text-xl font-semibold">{fmt.money(max)}</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">{t("amount")}</Label>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <NumericInput
                id="pay-amount"
                autoFocus
                kind="money"
                className="h-14 text-xl"
                value={amount}
                onValueChange={(v) => (setAmount(v), setTouched(true), setError(null))}
                error={touched ? amountError : null}
              />
            </div>
            <Button type="button" variant="outline" className="h-14 shrink-0" onClick={() => (setAmount(String(max / 100)), setTouched(true))}>
              {t("full")}
            </Button>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("method")}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
                className={optionClass(method === m, "px-2")}
              >
                {te(`paymentMethod.${m}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {method !== "cash" && (
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">{t("reference")}</Label>
            <Input id="pay-ref" className="h-12 text-base" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        )}

        {sales.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("applyTo")}</legend>
            <div className="space-y-2">
              <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3">
                <input type="radio" name="apply" className="size-4" checked={saleId === null} onChange={() => setSaleId(null)} />
                <span>{t("oldestFirst")}</span>
              </label>
              {sales.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3">
                  <input type="radio" name="apply" className="size-4" checked={saleId === s.id} onChange={() => setSaleId(s.id)} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.saleNumber} · {s.label}
                  </span>
                  <span className="money text-sm">{fmt.money(s.remainingMinor)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">{tc("date")}</Label>
            <Input id="pay-date" type="date" max={todayIso} className="h-12 text-base" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-note">
              {tc("notes")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
            </Label>
            <Textarea id="pay-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {errorText(error.code, error.details)}
          </p>
        )}

        <Button className="h-12 w-full" disabled={pending || max <= 0} onClick={submit}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {pending ? tc("saving") : t("submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
