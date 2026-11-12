"use client";

import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { FOLLOW_UP_CHANNELS, FOLLOW_UP_OUTCOMES, type FollowUpChannel, type FollowUpOutcome } from "@/domain/followup/follow-up";
import { toLatinDigits } from "@/domain/shared/digits";
import { Money } from "@/domain/shared/money";
import { ShopDate } from "@/domain/shared/shop-date";
import { logFollowUpAction } from "../../actions/follow-ups";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { NumericInput } from "../../components/numeric-input";
import { useValidationText } from "../../hooks/use-validation-text";
import { moneyIssue } from "../../lib/numeric";
import { Textarea } from "../../components/ui/textarea";
import { useAction } from "../../hooks/use-action";
import { optionClass } from "../../components/chip";

const QUICK_PROMISE_DAYS = [1, 3, 7, 15] as const;

function Choice<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={optionClass(value === o, "")}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

/** Log a follow-up in two taps: channel, outcome. "Promised" asks for date and amount (spec 6.5). */
export function FollowUpSheet({
  customerId,
  customerName,
  saleId,
  trigger,
}: {
  customerId: string;
  customerName: string;
  saleId?: string | null;
  trigger?: ReactNode;
}) {
  const t = useTranslations("followUps");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const { pending, run } = useAction();
  const vt = useValidationText();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<FollowUpChannel | null>("call");
  const [outcome, setOutcome] = useState<FollowUpOutcome | null>(null);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = ShopDate.fromInstant(new Date());

  function reset() {
    setChannel("call");
    setOutcome(null);
    setDate("");
    setAmount("");
    setNote("");
    setError(null);
  }

  function submit() {
    if (!channel || !outcome) return;
    let promisedAmountMinor: number | null = null;
    if (outcome === "promised") {
      const d = ShopDate.parse(toLatinDigits(date));
      if (!d.ok || d.value.isBefore(today)) return setError("date");
      if (amount.trim()) {
        const m = Money.parse(toLatinDigits(amount).replace(/[,\s]/g, ""));
        if (moneyIssue(amount, { required: false, min: 1 }) || !m.ok || m.value.minor <= 0) return setError("amount");
        promisedAmountMinor = m.value.minor;
      }
    }
    setError(null);
    run(
      () =>
        logFollowUpAction({
          customerId,
          saleId: saleId ?? null,
          channel,
          outcome,
          note: note.trim() || null,
          promisedDate: outcome === "promised" ? toLatinDigits(date) : null,
          promisedAmountMinor,
        }),
      {
        success: t("saved"),
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="h-11">
            <MessageSquarePlus className="size-5" aria-hidden /> {t("log")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("log")}</DialogTitle>
          <DialogDescription>{customerName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("channel")}</legend>
            <Choice options={FOLLOW_UP_CHANNELS} value={channel} onChange={setChannel} label={(v) => te(`channel.${v}`)} />
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("outcome")}</legend>
            <Choice options={FOLLOW_UP_OUTCOMES} value={outcome} onChange={setOutcome} label={(v) => te(`outcome.${v}`)} />
          </fieldset>

          {outcome === "promised" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="fu-date">{t("promisedDate")}</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMISE_DAYS.map((d) => (
                    <Button key={d} type="button" variant="outline" size="sm" className="h-10" onClick={() => setDate(today.addDays(d).iso)}>
                      {t("inDays", { days: d })}
                    </Button>
                  ))}
                </div>
                <Input id="fu-date" type="date" min={today.iso} className="h-12 text-base" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={error === "date"} />
                {error === "date" && <p className="text-sm text-destructive">{t("dateError")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fu-amount">
                  {t("promisedAmount")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
                </Label>
                <NumericInput id="fu-amount" kind="money" value={amount} onValueChange={setAmount} error={error === "amount" ? vt(moneyIssue(amount, { required: false, min: 1 }) ?? "invalidAmount", { min: 1 }) : null} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fu-note">
              {tc("notes")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
            </Label>
            <Textarea id="fu-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button className="h-12 w-full" disabled={pending || !channel || !outcome} onClick={submit}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
