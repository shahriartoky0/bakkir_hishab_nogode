import { z } from "zod";
import type { FieldDefinition } from "@/domain/catalog/field-definition";
import { toLatinDigits } from "@/domain/shared/digits";
import { ShopDate } from "@/domain/shared/shop-date";
import { integerIssue, moneyIssue, type NumericIssue } from "../lib/numeric";
import { i18nIssue } from "./zod-error-map";

/** Raw form values for custom fields: text inputs give strings, switches booleans. */
export type CustomFieldInput = Record<string, string | boolean>;

function fieldSchema(f: FieldDefinition): z.ZodType {
  if (f.type === "boolean") return z.boolean().optional();

  const check = (ok: (v: string) => boolean, key: Parameters<typeof i18nIssue>[0] = "invalid") =>
    z
      .string()
      .optional()
      .transform((v) => toLatinDigits(v ?? "").trim())
      .refine((v) => v === "" || ok(v), { params: i18nIssue(key) });

  /** Like check(), but the failing rule picks the exact message (numbers only, whole number, 2 decimals…). */
  const issueCheck = (issueOf: (v: string) => NumericIssue | null) =>
    z
      .string()
      .optional()
      .transform((v) => toLatinDigits(v ?? "").trim())
      .superRefine((v, ctx) => {
        const issue = v === "" ? null : issueOf(v);
        if (issue) ctx.addIssue({ code: "custom", params: i18nIssue(issue === "tooBig" ? "tooBigNumber" : issue) });
      });

  let s;
  switch (f.type) {
    case "number":
      s = issueCheck((v) => integerIssue(v, { required: false }));
      break;
    case "decimal":
      s = check((v) => /^\d+(\.\d{1,3})?$/.test(v.replace(/,/g, "")), "notANumber");
      break;
    case "money":
      s = issueCheck((v) => moneyIssue(v, { required: false }));
      break;
    case "date":
      s = check((v) => ShopDate.parse(v).ok, "invalidDate");
      break;
    case "select":
      s = check((v) => f.options.some((o) => o.value === v));
      break;
    default:
      s = z
        .string()
        .optional()
        .transform((v) => (v ?? "").trim())
        .refine((v) => v.length <= 500, { params: i18nIssue("tooLong") });
  }
  return f.isRequired ? s.refine((v) => v !== "", { params: i18nIssue("required") }) : s;
}

/**
 * Build the zod schema for a category's custom fields at runtime (spec 6.1).
 * The domain validates the same values again (validateCustomFields) on save.
 */
export function buildCustomFieldsSchema(fields: readonly FieldDefinition[]) {
  return z.object(Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)])));
}

/** Validate and return { errors } keyed by field key (messages from the zod error map). */
export function checkCustomFields(
  fields: readonly FieldDefinition[],
  values: CustomFieldInput,
  errorMap: z.core.$ZodErrorMap,
): Record<string, string> {
  const r = buildCustomFieldsSchema(fields).safeParse(values, { error: errorMap });
  if (r.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
