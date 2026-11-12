"use client";

import { RotateCcw, Search } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { setTranslationOverrideAction } from "../../actions/translations";
import { updateSettingsAction } from "../../actions/settings";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { useAction } from "../../hooks/use-action";
import { cn } from "../../lib/utils";

/** Default language and Bangla digits (spec 4.2 settings). */
export function LanguagePrefsForm({ defaultLocale, useBanglaDigits }: { defaultLocale: "bn" | "en"; useBanglaDigits: boolean }) {
  const t = useTranslations("settings.language");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("prefs")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("defaultLocale")}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["bn", "en"] as const).map((l) => (
              <Button
                key={l}
                variant={defaultLocale === l ? "default" : "outline"}
                className="h-12"
                disabled={pending}
                onClick={() => run(() => updateSettingsAction({ defaultLocale: l }), { success: tc("saved") })}
              >
                {t(`locale.${l}`)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("defaultLocaleHint")}</p>
        </div>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3">
          <span>
            <span className="block font-medium">{t("banglaDigits")}</span>
            <span className="block text-xs text-muted-foreground">{t("banglaDigitsHint")}</span>
          </span>
          <Switch
            checked={useBanglaDigits}
            disabled={pending}
            onCheckedChange={(c) => run(() => updateSettingsAction({ useBanglaDigits: c }), { success: tc("saved") })}
          />
        </label>
      </CardContent>
    </Card>
  );
}

export interface WordingEntry {
  key: string;
  bn: string;
  en: string;
  bnOverride: string | null;
  enOverride: string | null;
}

const SHOW = 40;

/** Searchable list of every UI message: defaults side by side, edit or reset (spec 4.3). */
export function WordingEditor({ entries }: { entries: WordingEntry[] }) {
  const t = useTranslations("settings.language");
  const tc = useTranslations("common");
  const { pending, run } = useAction();
  const [q, setQ] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [limit, setLimit] = useState(SHOW);
  const [editing, setEditing] = useState<{ entry: WordingEntry; bn: string; en: string } | null>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!onlyChanged || e.bnOverride !== null || e.enOverride !== null) &&
        (!s || e.key.toLowerCase().includes(s) || e.bn.toLowerCase().includes(s) || e.en.toLowerCase().includes(s) || (e.bnOverride ?? "").toLowerCase().includes(s)),
    );
  }, [entries, q, onlyChanged]);

  function save() {
    if (!editing) return;
    const { entry, bn, en } = editing;
    const changes: { locale: "bn" | "en"; value: string | null }[] = [];
    const norm = (v: string, def: string) => (v.trim() === "" || v.trim() === def ? null : v.trim());
    if (norm(bn, entry.bn) !== entry.bnOverride) changes.push({ locale: "bn", value: norm(bn, entry.bn) });
    if (norm(en, entry.en) !== entry.enOverride) changes.push({ locale: "en", value: norm(en, entry.en) });
    if (changes.length === 0) return setEditing(null);
    run(
      async () => {
        for (const c of changes) {
          const r = await setTranslationOverrideAction({ key: entry.key, ...c });
          if (!r.ok) return r;
        }
        return { ok: true as const, data: null };
      },
      { success: tc("saved"), onSuccess: () => setEditing(null) },
    );
  }

  function reset(entry: WordingEntry) {
    run(
      async () => {
        for (const locale of ["bn", "en"] as const) {
          const r = await setTranslationOverrideAction({ key: entry.key, locale, value: null });
          if (!r.ok) return r;
        }
        return { ok: true as const, data: null };
      },
      { success: t("resetDone") },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("wording")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("wordingHint")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={q}
            onChange={(e) => (setQ(e.target.value), setLimit(SHOW))}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-12 pl-10 text-base"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyChanged} onCheckedChange={setOnlyChanged} />
          {t("onlyChanged")}
        </label>
        <ul className="divide-y rounded-lg border">
          {matches.slice(0, limit).map((e) => {
            const changed = e.bnOverride !== null || e.enOverride !== null;
            return (
              <li key={e.key} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs break-all text-muted-foreground">{e.key}</span>
                  {changed && <StatusBadge tone="info">{t("changed")}</StatusBadge>}
                </div>
                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  <p lang="bn" className={cn(e.bnOverride !== null && "font-medium")}>
                    {e.bnOverride ?? e.bn}
                  </p>
                  <p lang="en" className={cn(e.enOverride !== null && "font-medium")}>
                    {e.enOverride ?? e.en}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing({ entry: e, bn: e.bnOverride ?? e.bn, en: e.enOverride ?? e.en })}>
                    {tc("edit")}
                  </Button>
                  {changed && (
                    <Button variant="ghost" size="sm" className="h-9" disabled={pending} onClick={() => reset(e)}>
                      <RotateCcw className="size-4" aria-hidden /> {t("reset")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {matches.length > limit && (
          <Button variant="outline" className="h-11 w-full" onClick={() => setLimit(limit + SHOW)}>
            {tc("loadMore")}
          </Button>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription className="font-mono break-all">{editing?.entry.key}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="w-bn">{t("locale.bn")}</Label>
                <Textarea id="w-bn" lang="bn" rows={2} value={editing.bn} onChange={(e) => setEditing({ ...editing, bn: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t("default", { text: editing.entry.bn })}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-en">{t("locale.en")}</Label>
                <Textarea id="w-en" lang="en" rows={2} value={editing.en} onChange={(e) => setEditing({ ...editing, en: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t("default", { text: editing.entry.en })}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("placeholderHint")}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setEditing(null)}>
              {tc("cancel")}
            </Button>
            <Button className="h-11" disabled={pending} onClick={save}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
