"use client";

import { Trash2 } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";
import { buildTree, type Category } from "@/domain/catalog/category";
import type { FieldDefinition } from "@/domain/catalog/field-definition";
import { MAX_PHOTOS_PER_ITEM } from "@/domain/sale/sale";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { NumericInput } from "../../../components/numeric-input";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useValidationText } from "../../../hooks/use-validation-text";
import { useFormat } from "../../../lib/format-context";
import { issueKey } from "../../../lib/numeric";
import { useText } from "../../../lib/use-text";
import { CustomFieldInputs } from "../../catalog/custom-field-inputs";
import { PhotoUpload } from "../../photos/photo-upload";
import { fieldsFor, lineTotal, type ItemDraft, type ItemErrors } from "./draft";

const NONE = "__none__";


export function ItemEditor({
  index,
  item,
  errors,
  categories,
  fields,
  onChange,
  onRemove,
}: {
  index: number;
  item: ItemDraft;
  errors: ItemErrors;
  categories: Category[];
  fields: FieldDefinition[];
  onChange: (item: ItemDraft) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("sales.item");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const vt = useValidationText();
  const text = useText();
  const fmt = useFormat();
  const id = useId();

  const options = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const p of buildTree(categories.filter((c) => !c.archivedAt))) {
      out.push({ id: p.id, label: text(p.nameBn, p.nameEn) });
      for (const ch of p.children) out.push({ id: ch.id, label: `${text(p.nameBn, p.nameEn)} › ${text(ch.nameBn, ch.nameEn)}` });
    }
    return out;
  }, [categories, text]);

  const defs = fieldsFor(item, categories, fields);
  const set = (patch: Partial<ItemDraft>) => onChange({ ...item, ...patch });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t("title", { n: fmt.number(index + 1) })}</CardTitle>
        {onRemove && (
          <Button variant="ghost" size="icon" className="size-10" aria-label={t("remove")} onClick={onRemove}>
            <Trash2 className="size-5" aria-hidden />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("photos")}</p>
          <PhotoUpload purpose="item" value={item.photos} onChange={(photos) => set({ photos })} max={MAX_PHOTOS_PER_ITEM} />
          {errors.photos && <p className="text-sm text-destructive">{tv("photoRequired")}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cat`}>{t("category")}</Label>
            <Select value={item.categoryId ?? NONE} onValueChange={(v) => set({ categoryId: v === NONE ? null : v })}>
              <SelectTrigger id={`${id}-cat`} className="h-12 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noCategory")}</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>{t("name")}</Label>
            <Input id={`${id}-name`} className="h-12 text-base" value={item.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={errors.name} />
            {errors.name && <p className="text-sm text-destructive">{tv("required")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-qty`}>{t("quantity")}</Label>
            <NumericInput
              id={`${id}-qty`}
              kind="integer"
              value={item.quantity}
              onValueChange={(v) => set({ quantity: v })}
              error={errors.quantity ? vt(issueKey(errors.quantity), { min: fmt.number(1), max: fmt.number(10_000) }) : null}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-price`}>{t("price")}</Label>
            <NumericInput
              id={`${id}-price`}
              kind="money"
              value={item.price}
              onValueChange={(v) => set({ price: v })}
              error={errors.price ? vt(issueKey(errors.price)) : null}
            />
          </div>
        </div>

        {defs.length > 0 && (
          <CustomFieldInputs fields={defs} values={item.custom} errors={errors.custom ?? {}} onChange={(custom) => set({ custom })} />
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-notes`}>
            {tc("notes")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
          </Label>
          <Textarea id={`${id}-notes`} rows={2} value={item.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>

        <p className="text-right text-sm">
          {t("lineTotal")} <span className="money font-semibold">{fmt.money(lineTotal(item))}</span>
        </p>
      </CardContent>
    </Card>
  );
}
