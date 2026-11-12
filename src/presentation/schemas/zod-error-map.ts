import type { z } from "zod";

/** Keys of the `validation` namespace in messages/*.json. */
export type ValidationKey =
  | "required"
  | "invalid"
  | "invalidEmail"
  | "tooShort"
  | "tooLong"
  | "tooSmall"
  | "tooBig"
  | "invalidPhone"
  | "invalidAmount"
  | "invalidDate"
  | "passwordMismatch"
  | "photoRequired"
  | "notANumber"
  | "wholeNumber"
  | "maxTwoDecimals"
  | "minValue"
  | "maxValue"
  | "tooBigNumber"
  | "discountTooLarge"
  | "upfrontTooLarge"
  | "amountTooLarge"
  | "nidLength";

export type ValidationTranslator = (key: ValidationKey, values?: Record<string, string | number>) => string;

/**
 * Custom refinements don't carry text; they name a validation key in `params`:
 *   .refine(fn, { params: i18nIssue("invalidPhone") })
 * so schemas stay locale-agnostic and the per-locale error map does the wording.
 */
export function i18nIssue(key: ValidationKey, values?: Record<string, string | number>): { i18n: ValidationKey; values?: Record<string, string | number> } {
  return values ? { i18n: key, values } : { i18n: key };
}

/**
 * Build a zod error map for one locale (pass `useTranslations("validation")` on
 * the client or `getTranslations("validation")` on the server).
 * Use with `schema.safeParse(data, { error: map })` or `zodResolver(schema, { error: map })`.
 */
export function createZodErrorMap(t: ValidationTranslator): z.core.$ZodErrorMap {
  return (issue) => {
    switch (issue.code) {
      case "invalid_type":
        return t(issue.input === undefined || issue.input === null ? "required" : "invalid");
      case "too_small": {
        const min = Number(issue.minimum);
        if (issue.origin === "string") return min <= 1 ? t("required") : t("tooShort", { min });
        if (issue.origin === "array" || issue.origin === "set") return t("required");
        return t("tooSmall", { min });
      }
      case "too_big": {
        const max = Number(issue.maximum);
        return issue.origin === "string" ? t("tooLong", { max }) : t("tooBig", { max });
      }
      case "invalid_format":
        return issue.format === "email" ? t("invalidEmail") : t("invalid");
      case "custom": {
        const params = issue.params as { i18n?: ValidationKey; values?: Record<string, string | number> } | undefined;
        return t(params?.i18n ?? "invalid", params?.values);
      }
      default:
        return t("invalid");
    }
  };
}
