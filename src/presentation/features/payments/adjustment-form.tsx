"use client";

import { Loader2 } from "@/presentation/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ADJUSTMENT_TYPES, directionFor, type AdjustmentType, type Direction } from "@/domain/payment/payment";
import { toLatinDigits } from "@/domain/shared/digits";
import { createAdjustmentAction } from "../../actions/payments";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useErrorText } from "../../hooks/use-error-text";
import { useValidationText } from "../../hooks/use-validation-text";
import { issueKey, moneyIssue, toMinor } from "../../lib/numeric";
import { NumericInput } from "../../components/numeric-input";
import { useFormat } from "../../lib/format-context";
import type { PayableSale } from "./payment-form";
import { optionClass } from "../../components/chip";

const ALL = "__all__";

/** Opening balance (old khata), return, discount/waiver, write-off, correction — reason required (spec 6.4). */
export function AdjustmentForm({
  customerId,
  balanceMinor,
  sales,
  todayIso,
}: {
  customerId: string;
  balanceMinor: number;
  sales: PayableSale[];
  todayIso: string;
}) {
  const t = useTranslations("payments.adjust");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const fmt = useFormat();
  const errorText = useErrorText();
  const vt = useValidationText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<AdjustmentType>(balanceMinor > 0 ? "discount" : "opening_balance");
  const [direction, setDirection] = useState<Direction>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saleId, setSaleId] = useState<string>(ALL);
  const [dueDate, setDueDate] = useState(todayIso);
  // Error *code* (translated at render, so it follows a language switch).
  const [error, setError] = useState<{ code: string; details?: Record<string, string | number | boolean | null> } | null>(null);

  const effective = directionFor(type, direction);
  const [touched, setTouched] = useState(false);
  const amountIssue = moneyIssue(amount);
  const amountMinorLive = toMinor(amount);
  const amountError = amountIssue
    ? vt(issueKey(amountIssue))
    : amountMinorLive !== null && amountMinorLive <= 0
      ? vt("minValue", { min: fmt.money(1) })
      : effective === "credit" && amountMinorLive !== null && amountMinorLive > balanceMinor
        ? vt("amountTooLarge", { max: fmt.money(balanceMinor) })
        : null;

  function submit() {
    setTouched(true);
    const minorAmount = toMinor(amount);
    if (amountError || minorAmount === null) return;
    if (reason.trim().length < 3) return setError({ code: "REASON_REQUIRED" });
    setError(null);
    startTransition(async () => {
      const r = await createAdjustmentAction({
        customerId,
        type,
        direction: type === "correction" ? direction : undefined,
        amountMinor: minorAmount,
        reason: reason.trim(),
        saleId: effective === "credit" && saleId !== ALL ? saleId : null,
        dueDate: effective === "debit" ? toLatinDigits(dueDate) : null,
      });
      if (!r.ok) return setError({ code: r.code, details: r.details });
      toast.success(t("saved"));
      router.push(`/customers/${customerId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-muted p-3 text-sm">
          {t("currentBalance")} <span className="money font-semibold">{fmt.money(balanceMinor)}</span>
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("type")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ADJUSTMENT_TYPES.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={type === a}
                onClick={() => setType(a)}
                className={optionClass(type === a, "text-left")}
              >
                <span className="block font-medium">{te(`adjustmentType.${a}`)}</span>
                <span className="block text-xs opacity-80">{t(`hint.${a}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {type === "correction" && (
          <div className="grid grid-cols-2 gap-2">
            {(["credit", "debit"] as const).map((d) => (
              <Button key={d} type="button" variant={direction === d ? "default" : "outline"} className="h-12" onClick={() => setDirection(d)}>
                {te(`direction.${d}`)}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="adj-amount">{t("amount")}</Label>
          <NumericInput id="adj-amount" kind="money" value={amount} onValueChange={(v) => (setAmount(v), setTouched(true))} error={touched ? amountError : null} />
        </div>

        {effective === "debit" ? (
          <div className="space-y-1.5">
            <Label htmlFor="adj-due">{t("dueDate")}</Label>
            <Input id="adj-due" type="date" className="h-12 text-base" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("dueDateHint")}</p>
          </div>
        ) : (
          sales.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-sale">{t("sale")}</Label>
              <Select value={saleId} onValueChange={setSaleId}>
                <SelectTrigger id="adj-sale" className="h-12 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("oldestFirst")}</SelectItem>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.saleNumber} · {s.label} · {fmt.money(s.remainingMinor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        )}

        <div className="space-y-1.5">
          <Label htmlFor="adj-reason">{tc("reason")}</Label>
          <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {errorText(error.code, error.details)}
          </p>
        )}

        <Button className="h-12 w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
