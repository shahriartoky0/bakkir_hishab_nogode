"use client";

import { AlertTriangle, Eye, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ClearCounts } from "@/application/ports/repositories";
import { ShopDate } from "@/domain/shared/shop-date";
import { clearDataAction, previewClearAction } from "../../actions/admin";
import { chipClass } from "../../components/chip";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { useErrorText } from "../../hooks/use-error-text";
import { useFormat } from "../../lib/format-context";

/** Accepted confirmation words (Bangla or English). The server only accepts DELETE. */
const CONFIRM_WORDS = ["DELETE", "মুছুন"];

async function downloadBackup(from: string, to: string, customers: boolean) {
  const res = await fetch(`/settings/clear-data/backup?from=${from}&to=${to}&customers=${customers ? 1 : 0}`);
  if (!res.ok) throw new Error(`backup ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `baki-backup-${from}_${to}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ClearDataPanel({ todayIso }: { todayIso: string }) {
  const t = useTranslations("settings.clearData");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const errorText = useErrorText();
  const router = useRouter();
  // Separate states so the preview spinner never shows during a delete (and vice versa).
  const [previewing, startPreview] = useTransition();
  const [erasing, startErase] = useTransition();
  const pending = previewing || erasing;
  const today = ShopDate.of(todayIso);
  const monthStart = `${todayIso.slice(0, 8)}01`;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayIso);
  const [customers, setCustomers] = useState(true);
  const [counts, setCounts] = useState<ClearCounts | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [word, setWord] = useState("");
  /** Store codes, not text: the message is translated at render so it follows a language switch. */
  type PanelError = { code: string; details?: Record<string, string | number | boolean | null> } | "range";
  const [error, setError] = useState<PanelError | null>(null);
  const errorMessage = error === null ? null : error === "range" ? t("rangeError") : errorText(error.code, error.details);

  const presets: { id: string; from: string; to: string }[] = [
    { id: "today", from: todayIso, to: todayIso },
    { id: "last7", from: today.addDays(-6).iso, to: todayIso },
    { id: "thisMonth", from: monthStart, to: todayIso },
    { id: "allTime", from: "2000-01-01", to: todayIso },
  ];

  const setRange = (f: string, tt: string) => {
    setFrom(f);
    setTo(tt);
    setCounts(null);
    setError(null);
  };

  function preview() {
    setError(null);
    if (!from || !to || from > to) return setError("range");
    startPreview(async () => {
      const r = await previewClearAction({ from, to, removeEmptyCustomers: customers });
      if (!r.ok) return setError({ code: r.code, details: r.details });
      setCounts(r.data);
    });
  }

  function erase() {
    startErase(async () => {
      try {
        await downloadBackup(from, to, customers);
      } catch {
        toast.error(t("backupFailed"));
        return;
      }
      const r = await clearDataAction({ from, to, removeEmptyCustomers: customers, confirm: "DELETE" });
      if (!r.ok) return void toast.error(errorText(r.code, r.details));
      toast.success(t("done", { sales: fmt.number(r.data.sales), payments: fmt.number(r.data.payments) }));
      setConfirmOpen(false);
      setWord("");
      setCounts(null);
      router.refresh();
    });
  }

  const total = counts ? counts.sales + counts.payments + counts.adjustments + counts.followUps + counts.customers : 0;
  const rows: [string, number][] = counts
    ? [
        [t("count.sales"), counts.sales],
        [t("count.payments"), counts.payments],
        [t("count.adjustments"), counts.adjustments],
        [t("count.followUps"), counts.followUps],
        [t("count.customers"), counts.customers],
        [t("count.photos"), counts.photos],
      ]
    : [];

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertDescription>{t("warning")}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("rangeTitle")}</CardTitle>
          <CardDescription>{t("rangeHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.id} type="button" className={chipClass(from === p.from && to === p.to)} onClick={() => setRange(p.from, p.to)}>
                {t(`preset.${p.id}` as "preset.today")}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="clr-from">{tc("from")}</Label>
              <Input id="clr-from" type="date" max={to && to < todayIso ? to : todayIso} value={from} onChange={(e) => setRange(e.target.value, to)} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clr-to">{tc("to")}</Label>
              <Input id="clr-to" type="date" min={from || undefined} max={todayIso} value={to} onChange={(e) => setRange(from, e.target.value)} className="h-12" />
            </div>
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3">
            <span className="text-sm">{t("removeCustomers")}</span>
            <Switch checked={customers} onCheckedChange={(c) => (setCustomers(c), setCounts(null))} />
          </label>
          {errorMessage && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <Button variant="outline" className="h-12 w-full sm:w-auto" disabled={pending} onClick={preview}>
            {previewing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            {previewing ? t("checking") : counts ? t("previewAgain") : t("preview")}
          </Button>
        </CardContent>
      </Card>

      {counts && (
        <Card className={total > 0 ? "border-destructive/40" : undefined}>
          <CardHeader>
            <CardTitle>{t("previewTitle", { from: fmt.date(from), to: fmt.date(to) })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {total === 0 ? (
              <p className="text-muted-foreground">{t("nothing")}</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {rows.map(([label, n]) => (
                    <div key={label} className="rounded-xl bg-muted p-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-heading text-xl font-bold">{fmt.number(n)}</dd>
                    </div>
                  ))}
                </dl>
                {(counts.linkedPayments > 0 || counts.linkedAdjustments > 0) && (
                  <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
                    {t("linked", { payments: fmt.number(counts.linkedPayments), adjustments: fmt.number(counts.linkedAdjustments) })}
                  </p>
                )}
                <Button variant="destructive" className="h-12 w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="size-5" aria-hidden /> {t("deleteButton")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={(o) => !erasing && (setConfirmOpen(o), setWord(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="clr-word">{t("typeToConfirm")}</Label>
            <Input id="clr-word" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} className="h-12 text-base" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11" disabled={erasing} onClick={() => setConfirmOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={erasing || (!CONFIRM_WORDS.includes(word.trim().toUpperCase()) && !CONFIRM_WORDS.includes(word.trim()))}
              onClick={erase}
            >
              {erasing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Trash2 className="size-5" aria-hidden />}
              {t("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
