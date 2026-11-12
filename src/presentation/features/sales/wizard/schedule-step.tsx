"use client";

import { useTranslations } from "next-intl";
import { MAX_INSTALLMENTS, QUICK_DUE_DAYS } from "@/domain/sale/installment-plan";
import { ShopDate } from "@/domain/shared/shop-date";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { NumericInput } from "../../../components/numeric-input";
import { useErrorText } from "../../../hooks/use-error-text";
import { useValidationText } from "../../../hooks/use-validation-text";
import { integerIssue, issueKey } from "../../../lib/numeric";
import { useFormat } from "../../../lib/format-context";
import { parseMoney, previewSchedule, type PlanDraft } from "./draft";
import { optionClass } from "../../../components/chip";

/** Step 4: a single due date (quick picks) or installments with a live preview. */
export function ScheduleStep({
  plan,
  onChange,
  financedMinor,
  saleDate,
}: {
  plan: PlanDraft;
  onChange: (p: PlanDraft) => void;
  financedMinor: number;
  saleDate: ShopDate;
}) {
  const t = useTranslations("sales.schedule");
  const errorText = useErrorText();
  const vt = useValidationText();
  const fmt = useFormat();
  const set = (patch: Partial<PlanDraft>) => onChange({ ...plan, ...patch });
  const preview = previewSchedule(financedMinor, plan, saleDate);
  const countIssue = plan.kind === "installments" ? integerIssue(plan.count, { min: 1, max: MAX_INSTALLMENTS }) : null;
  const amounts = plan.amounts?.map(parseMoney) ?? null;
  const amountsSum = amounts && amounts.every((a) => a !== null) ? (amounts as number[]).reduce((x, y) => x + y, 0) : null;

  if (financedMinor === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{t("fullyPaid")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("mode")}>
        {(["single", "installments"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={plan.kind === k}
            onClick={() => set({ kind: k, amounts: null })}
            className={optionClass(plan.kind === k, "")}
          >
            {t(k)}
          </button>
        ))}
      </div>

      {plan.kind === "single" ? (
        <div className="space-y-2">
          <Label htmlFor="due-date">{t("dueDate")}</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_DUE_DAYS.map((d) => {
              const iso = saleDate.addDays(d).iso;
              return (
                <Button key={d} type="button" variant={plan.dueDate === iso ? "default" : "outline"} className="h-11" onClick={() => set({ dueDate: iso })}>
                  {t("plusDays", { days: fmt.number(d) })}
                </Button>
              );
            })}
          </div>
          <Input id="due-date" type="date" min={saleDate.iso} className="h-12 text-base" value={plan.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inst-count">{t("count")}</Label>
              <NumericInput
                id="inst-count"
                kind="integer"
                value={plan.count}
                onValueChange={(v) => set({ count: v, amounts: null })}
                error={countIssue ? vt(issueKey(countIssue), { min: fmt.number(1), max: fmt.number(MAX_INSTALLMENTS) }) : null}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("frequency")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["monthly", "weekly"] as const).map((f) => (
                  <Button key={f} type="button" variant={plan.frequency === f ? "default" : "outline"} className="h-12" onClick={() => set({ frequency: f })}>
                    {t(f)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inst-first">{t("firstDate")}</Label>
              <Input id="inst-first" type="date" min={saleDate.iso} className="h-12 text-base" value={plan.firstDate} onChange={(e) => set({ firstDate: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={plan.amounts !== null}
              onCheckedChange={(on) =>
                set({ amounts: on && preview.ok ? preview.schedule.map((s) => String(s.amountMinor / 100)) : null })
              }
            />
            {t("editAmounts")}
          </label>
        </div>
      )}

      <div className="rounded-xl border">
        <p className="border-b px-3 py-2 text-sm font-medium">{t("preview")}</p>
        {preview.ok ? (
          <ol className="divide-y">
            {preview.schedule.map((s, i) => (
              <li key={s.seq} className="flex items-center gap-3 px-3 py-2">
                <span className="w-8 text-sm text-muted-foreground">{fmt.number(s.seq)}</span>
                <span className="flex-1">{fmt.date(s.dueDate)}</span>
                {plan.kind === "installments" && plan.amounts ? (
                  <NumericInput
                    kind="money"
                    aria-label={t("amountFor", { n: fmt.number(s.seq) })}
                    className="h-10 w-32 text-right"
                    value={plan.amounts[i] ?? ""}
                    onValueChange={(v) => set({ amounts: plan.amounts!.map((a, j) => (j === i ? v : a)) })}
                  />
                ) : (
                  <span className="money font-medium">{fmt.money(s.amountMinor)}</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-2 p-3">
            {plan.kind === "installments" && plan.amounts && (
              <ol className="space-y-2">
                {plan.amounts.map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-8 text-sm text-muted-foreground">{fmt.number(i + 1)}</span>
                    <NumericInput
                      kind="money"
                      aria-label={t("amountFor", { n: fmt.number(i + 1) })}
                      className="h-10 flex-1 text-right"
                      value={a}
                      onValueChange={(v) => set({ amounts: plan.amounts!.map((x, j) => (j === i ? v : x)) })}
                    />
                  </li>
                ))}
              </ol>
            )}
            <p className="text-sm font-medium text-destructive" role="alert">
              {preview.code === "SCHEDULE_MISMATCH" && amountsSum !== null
                ? t("sumMismatch", { sum: fmt.money(amountsSum), expected: fmt.money(financedMinor) })
                : countIssue
                  ? vt(issueKey(countIssue), { min: fmt.number(1), max: fmt.number(MAX_INSTALLMENTS) })
                  : errorText(preview.code)}
            </p>
          </div>
        )}
        <p className="border-t px-3 py-2 text-right text-sm">
          {t("financed")} <span className="money font-semibold">{fmt.money(financedMinor)}</span>
        </p>
      </div>
    </div>
  );
}
