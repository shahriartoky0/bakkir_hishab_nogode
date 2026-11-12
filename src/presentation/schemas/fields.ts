import { z } from "zod";
import { toLatinDigits } from "@/domain/shared/digits";
import { Money } from "@/domain/shared/money";
import { PhoneNumber } from "@/domain/shared/phone-number";
import { ShopDate } from "@/domain/shared/shop-date";
import { integerIssue, moneyIssue, type NumericIssue } from "../lib/numeric";
import { i18nIssue, type ValidationKey } from "./zod-error-map";

/**
 * Reusable zod fields. Inputs accept Bangla or English digits and are converted
 * before validation (spec 4.4). Each failure names its own `validation.*` message.
 */

const ISSUE_KEY: Record<NumericIssue, ValidationKey> = {
  required: "required",
  notANumber: "notANumber",
  maxTwoDecimals: "maxTwoDecimals",
  wholeNumber: "wholeNumber",
  minValue: "minValue",
  maxValue: "maxValue",
  tooBig: "tooBigNumber",
};

/** Required BD mobile → E.164 string. */
export const phoneField = () =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => PhoneNumber.parse(v).ok, { params: i18nIssue("invalidPhone") })
    .transform((v) => (PhoneNumber.parse(v) as { ok: true; value: PhoneNumber }).value.e164);

const toPaisa = (v: string) => (Money.parse(toLatinDigits(v).replace(/[,\s]/g, "")) as { ok: true; value: Money }).value.minor;

/** Amount in taka text → integer paisa. */
export const moneyField = (opts: { min?: number } = {}) =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const issue = moneyIssue(v, { min: opts.min });
      if (issue) ctx.addIssue({ code: "custom", params: i18nIssue(ISSUE_KEY[issue], { min: opts.min ?? 0 }) });
    })
    .transform(toPaisa);

/** Optional amount: "" → null, otherwise paisa. */
export const optionalMoneyField = () =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const issue = moneyIssue(v, { required: false });
      if (issue) ctx.addIssue({ code: "custom", params: i18nIssue(ISSUE_KEY[issue]) });
    })
    .transform((v) => (v === "" ? null : toPaisa(v)));

/** Whole number (quantity, days, minutes) from Bangla/English digit text. */
export const integerField = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const issue = integerIssue(v, opts);
      if (issue) ctx.addIssue({ code: "custom", params: i18nIssue(ISSUE_KEY[issue], { min: opts.min ?? 0, max: opts.max ?? 0 }) });
    })
    .transform((v) => Number(toLatinDigits(v)));

/** YYYY-MM-DD shop date. */
export const shopDateField = () =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => ShopDate.parse(toLatinDigits(v)).ok, { params: i18nIssue("invalidDate") })
    .transform((v) => toLatinDigits(v));

/** Optional BD mobile: "" → null, otherwise E.164. */
export const optionalPhoneField = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || PhoneNumber.parse(v).ok, { params: i18nIssue("invalidPhone") })
    .transform((v) => (v === "" ? null : (PhoneNumber.parse(v) as { ok: true; value: PhoneNumber }).value.e164));

/** Optional free text: "" → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** Optional Bangladeshi NID: 10, 13 or 17 digits. */
export const optionalNidField = () =>
  z
    .string()
    .trim()
    .transform((v) => toLatinDigits(v).replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d+$/.test(v), { params: i18nIssue("notANumber") })
    .refine((v) => v === "" || [10, 13, 17].includes(v.length), { params: i18nIssue("nidLength") })
    .transform((v) => (v === "" ? null : v));
