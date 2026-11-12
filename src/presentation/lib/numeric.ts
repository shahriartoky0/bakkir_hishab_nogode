import { toLatinDigits } from "@/domain/shared/digits";
import { Money } from "@/domain/shared/money";

/**
 * Numeric input rules (spec 4.4: Bangla ০-৯ and English 0-9 digits both work).
 * `sanitizeNumeric` runs on every keystroke/paste so letters can't get in at all;
 * the `*Issue` functions name the exact validation message to show.
 */
export type NumericKind = "integer" | "decimal" | "money" | "phone";

const NOT_DIGIT = /[^0-9০-৯]/g;

function keepDecimal(value: string, maxFraction: number): string {
  const cleaned = value.replace(/[^0-9০-৯.,]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/[.,]/g, "")
    .slice(0, maxFraction);
  return `${whole}.${fraction}`;
}

export function sanitizeNumeric(value: string, kind: NumericKind): string {
  switch (kind) {
    case "integer":
      return value.replace(NOT_DIGIT, "");
    case "money":
      return keepDecimal(value, 2);
    case "decimal":
      return keepDecimal(value, 3);
    case "phone": {
      const v = value.replace(/[^0-9০-৯+\s-]/g, "");
      // "+" only as the first character
      return v.replace(/(?!^)\+/g, "");
    }
  }
}

export const inputModeFor = (kind: NumericKind) => (kind === "integer" ? "numeric" : kind === "phone" ? "tel" : "decimal");

/** Keys of `validation.*` in messages/*.json that numeric checks can return. */
export type NumericIssue = "required" | "notANumber" | "maxTwoDecimals" | "wholeNumber" | "minValue" | "maxValue" | "tooBig";

const plain = (text: string) => toLatinDigits(text).trim().replace(/[,\s]/g, "");

/** Taka amount: empty / not a number / too many decimals / too big / below min. */
export function moneyIssue(text: string, opts: { required?: boolean; min?: number } = {}): NumericIssue | null {
  const v = plain(text);
  if (v === "") return opts.required === false ? null : "required";
  if (!/^\d*\.?\d*$/.test(v) || v === ".") return "notANumber";
  if ((v.split(".")[1] ?? "").length > 2) return "maxTwoDecimals";
  const m = Money.parse(v);
  if (!m.ok) return "tooBig";
  if (opts.min !== undefined && m.value.minor < opts.min * 100) return "minValue";
  return null;
}

/** Whole number in [min, max]. */
export function integerIssue(text: string, opts: { required?: boolean; min?: number; max?: number } = {}): NumericIssue | null {
  const v = plain(text);
  if (v === "") return opts.required === false ? null : "required";
  if (!/^\d+$/.test(v)) return /^\d*\.\d*$/.test(v) ? "wholeNumber" : "notANumber";
  const n = Number(v);
  if (!Number.isSafeInteger(n)) return "tooBig";
  if (opts.min !== undefined && n < opts.min) return "minValue";
  if (opts.max !== undefined && n > opts.max) return "maxValue";
  return null;
}

/** Paisa from taka text, or null. */
export function toMinor(text: string): number | null {
  const v = plain(text);
  if (!v) return null;
  const m = Money.parse(v);
  return m.ok ? m.value.minor : null;
}

/** NumericIssue → `validation.*` message key. */
export const issueKey = (i: NumericIssue) => (i === "tooBig" ? ("tooBigNumber" as const) : i);
