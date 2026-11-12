"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  FIELD_TYPES,
  isValidFieldKey,
  suggestFieldKey,
  type FieldDefinition,
  type FieldType,
  type SelectOption,
} from "@/domain/catalog/field-definition";
import { archiveFieldAction, reorderFieldsAction, saveFieldAction } from "../../actions/settings";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { useAction } from "../../hooks/use-action";
import { useText } from "../../lib/use-text";

interface Draft {
  id?: string;
  key: string;
  keyTouched: boolean;
  labelBn: string;
  labelEn: string;
  type: FieldType;
  unitBn: string;
  unitEn: string;
  options: SelectOption[];
  isRequired: boolean;
  showOnReceipt: boolean;
}

const emptyDraft = (): Draft => ({
  key: "",
  keyTouched: false,
  labelBn: "",
  labelEn: "",
  type: "text",
  unitBn: "",
  unitEn: "",
  options: [],
  isRequired: false,
  showOnReceipt: true,
});

export function FieldManager({
  categoryId,
  fields,
  inherited,
}: {
  categoryId: string | null;
  fields: FieldDefinition[];
  inherited: FieldDefinition[];
}) {
  const t = useTranslations("settings.fields");
  const tc = useTranslations("common");
  const te = useTranslations("enums.fieldType");
  const text = useText();
  const { pending, run } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const list = fields.filter((f) => showArchived || !f.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const active = fields.filter((f) => !f.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);

  function move(id: string, delta: number) {
    const ids = active.map((f) => f.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    run(() => reorderFieldsAction(ids));
  }

  function save() {
    if (!draft) return;
    const payload = {
      id: draft.id,
      categoryId,
      key: draft.key,
      labelBn: draft.labelBn || null,
      labelEn: draft.labelEn || null,
      type: draft.type,
      unitBn: draft.unitBn || null,
      unitEn: draft.unitEn || null,
      options: draft.type === "select" ? draft.options : [],
      isRequired: draft.isRequired,
      showOnReceipt: draft.showOnReceipt,
    };
    run(() => saveFieldAction(payload), { success: tc("saved"), onSuccess: () => setDraft(null) });
  }

  const describe = (f: FieldDefinition) =>
    [te(f.type), text(f.unitBn, f.unitEn), f.isRequired ? t("required") : null, f.showOnReceipt ? t("onReceipt") : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11" onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-5" aria-hidden /> {t("add")}
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          {t("showArchived")}
        </label>
      </div>

      <Card>
        <CardContent className="divide-y py-2">
          {list.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("empty")}</p>}
          {list.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {text(f.labelBn, f.labelEn)} <span className="font-mono text-xs text-muted-foreground">{f.key}</span>
                </p>
                <p className="text-xs text-muted-foreground">{describe(f)}</p>
                {f.archivedAt && <StatusBadge tone="neutral">{tc("archived")}</StatusBadge>}
              </div>
              <div className="flex gap-1">
                {!f.archivedAt && (
                  <>
                    <Button variant="ghost" size="icon" className="size-10" aria-label={tc("moveUp")} disabled={pending} onClick={() => move(f.id, -1)}>
                      <ChevronUp className="size-5" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-10" aria-label={tc("moveDown")} disabled={pending} onClick={() => move(f.id, 1)}>
                      <ChevronDown className="size-5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label={tc("edit")}
                      onClick={() =>
                        setDraft({
                          id: f.id,
                          key: f.key,
                          keyTouched: true,
                          labelBn: f.labelBn ?? "",
                          labelEn: f.labelEn ?? "",
                          type: f.type,
                          unitBn: f.unitBn ?? "",
                          unitEn: f.unitEn ?? "",
                          options: f.options,
                          isRequired: f.isRequired,
                          showOnReceipt: f.showOnReceipt,
                        })
                      }
                    >
                      <Pencil className="size-5" aria-hidden />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={f.archivedAt ? tc("restore") : tc("archive")}
                  disabled={pending}
                  onClick={() => run(() => archiveFieldAction({ id: f.id, archived: !f.archivedAt }))}
                >
                  {f.archivedAt ? <ArchiveRestore className="size-5" aria-hidden /> : <Archive className="size-5" aria-hidden />}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {inherited.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inherited")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {inherited.map((f) => (
              <div key={f.id} className="py-2">
                <p className="font-medium">{text(f.labelBn, f.labelEn)}</p>
                <p className="text-xs text-muted-foreground">{describe(f)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="f-bn">{t("labelBn")}</Label>
                  <Input id="f-bn" className="h-12 text-base" value={draft.labelBn} onChange={(e) => setDraft({ ...draft, labelBn: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-en">{t("labelEn")}</Label>
                  <Input
                    id="f-en"
                    className="h-12 text-base"
                    value={draft.labelEn}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        labelEn: e.target.value,
                        key: draft.id || draft.keyTouched ? draft.key : suggestFieldKey(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="f-key">{t("key")}</Label>
                <Input
                  id="f-key"
                  className="h-12 font-mono text-base"
                  value={draft.key}
                  disabled={Boolean(draft.id)}
                  aria-invalid={draft.key !== "" && !isValidFieldKey(draft.key)}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase(), keyTouched: true })}
                />
                <p className="text-xs text-muted-foreground">{draft.id ? t("keyLocked") : t("keyHint")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="f-type">{t("type")}</Label>
                <Select value={draft.type} disabled={Boolean(draft.id)} onValueChange={(v) => setDraft({ ...draft, type: v as FieldType })}>
                  <SelectTrigger id="f-type" className="h-12 w-full text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft}>
                        {te(ft)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(draft.type === "number" || draft.type === "decimal" || draft.type === "text") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="f-ubn">{t("unitBn")}</Label>
                    <Input id="f-ubn" className="h-12 text-base" value={draft.unitBn} onChange={(e) => setDraft({ ...draft, unitBn: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-uen">{t("unitEn")}</Label>
                    <Input id="f-uen" className="h-12 text-base" value={draft.unitEn} onChange={(e) => setDraft({ ...draft, unitEn: e.target.value })} />
                  </div>
                </div>
              )}

              {draft.type === "select" && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t("options")}</legend>
                  {draft.options.map((o, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                      <Input
                        aria-label={t("optionValue")}
                        placeholder={t("optionValue")}
                        className="h-11"
                        value={o.value}
                        onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                      />
                      <Input
                        aria-label={t("labelBn")}
                        placeholder={t("labelBn")}
                        className="h-11"
                        value={o.labelBn ?? ""}
                        onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, labelBn: e.target.value } : x)) })}
                      />
                      <Input
                        aria-label={t("labelEn")}
                        placeholder={t("labelEn")}
                        className="h-11"
                        value={o.labelEn ?? ""}
                        onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, labelEn: e.target.value } : x)) })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={tc("delete")}
                        onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => setDraft({ ...draft, options: [...draft.options, { value: "", labelBn: "", labelEn: "" }] })}
                  >
                    <Plus className="size-4" aria-hidden /> {t("addOption")}
                  </Button>
                </fieldset>
              )}

              <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3">
                <Label htmlFor="f-req">{t("required")}</Label>
                <Switch id="f-req" checked={draft.isRequired} onCheckedChange={(c) => setDraft({ ...draft, isRequired: c })} />
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3">
                <Label htmlFor="f-rcpt">{t("onReceipt")}</Label>
                <Switch id="f-rcpt" checked={draft.showOnReceipt} onCheckedChange={(c) => setDraft({ ...draft, showOnReceipt: c })} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setDraft(null)}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" className="h-11" disabled={pending}>
                  {tc("save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
