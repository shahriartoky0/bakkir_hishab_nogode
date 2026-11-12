"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { inputModeFor, sanitizeNumeric, type NumericKind } from "../lib/numeric";

/** A labelled text input bound to react-hook-form (large touch target). */
export function TextField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  optional,
  description,
  multiline,
  numeric,
  className,
  ...input
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  optional?: boolean;
  description?: ReactNode;
  multiline?: boolean;
  /** Only allow numbers of this kind (letters are dropped as typed). */
  numeric?: NumericKind;
  className?: string;
} & Omit<ComponentProps<"input">, "name" | "defaultValue" | "value" | "onChange">) {
  const t = useTranslations("common");
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {optional && <span className="text-xs font-normal text-muted-foreground"> · {t("optional")}</span>}
          </FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea {...field} value={field.value ?? ""} rows={3} className="text-base" />
            ) : (
              <Input
                {...input}
                {...field}
                {...(numeric ? { inputMode: inputModeFor(numeric), autoComplete: input.autoComplete ?? "off" } : {})}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(numeric ? sanitizeNumeric(e.target.value, numeric) : e.target.value)}
                className="h-12 text-base"
              />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
