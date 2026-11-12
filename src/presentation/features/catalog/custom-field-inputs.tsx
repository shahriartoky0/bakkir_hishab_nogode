"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { FieldDefinition } from "@/domain/catalog/field-definition";
import { NumericInput } from "../../components/numeric-input";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { useText } from "../../lib/use-text";
import type { CustomFieldInput } from "../../schemas/custom-fields";

/** Renders a category's custom fields (spec 6.1) as controlled inputs. */
export function CustomFieldInputs({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: readonly FieldDefinition[];
  values: CustomFieldInput;
  errors: Record<string, string>;
  onChange: (values: CustomFieldInput) => void;
}) {
  const text = useText();
  const t = useTranslations("common");
  const baseId = useId();
  if (fields.length === 0) return null;

  const set = (key: string, v: string | boolean) => onChange({ ...values, [key]: v });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `${baseId}-${f.key}`;
        const unit = text(f.unitBn, f.unitEn);
        const label = text(f.labelBn, f.labelEn);
        const error = errors[f.key];
        const v = values[f.key];

        if (f.type === "boolean") {
          return (
            <div key={f.key} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3">
              <Label htmlFor={id}>{label}</Label>
              <Switch id={id} checked={v === true} onCheckedChange={(c) => set(f.key, c)} />
            </div>
          );
        }

        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={id}>
              {label}
              {unit && <span className="text-muted-foreground"> ({unit})</span>}
              {!f.isRequired && <span className="text-xs font-normal text-muted-foreground"> · {t("optional")}</span>}
            </Label>
            {f.type === "select" ? (
              <Select value={typeof v === "string" && v ? v : undefined} onValueChange={(x) => set(f.key, x)}>
                <SelectTrigger id={id} className="h-12 w-full text-base" aria-invalid={Boolean(error)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {text(o.labelBn, o.labelEn) || o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === "number" || f.type === "decimal" || f.type === "money" ? (
              <NumericInput
                id={id}
                kind={f.type === "number" ? "integer" : f.type}
                value={typeof v === "string" ? v : ""}
                onValueChange={(x) => set(f.key, x)}
                error={error}
              />
            ) : (
              <Input
                id={id}
                className="h-12 text-base"
                value={typeof v === "string" ? v : ""}
                onChange={(e) => set(f.key, e.target.value)}
                type={f.type === "date" ? "date" : "text"}
                aria-invalid={Boolean(error)}
              />
            )}
            {error && f.type !== "number" && f.type !== "decimal" && f.type !== "money" && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
