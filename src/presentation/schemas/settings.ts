import { z } from "zod";
import { integerField } from "./fields";
import { i18nIssue } from "./zod-error-map";

const opt = (max: number) => z.string().trim().max(max);
const prefix = () =>
  z
    .string()
    .trim()
    .min(1)
    .max(10)
    .refine((v) => /^[A-Za-z0-9\-/_]+$/.test(v), { params: i18nIssue("invalid") });

export const shopSettingsSchema = z.object({
  shopNameBn: opt(120),
  shopNameEn: opt(120),
  phone: opt(30),
  addressBn: opt(500),
  addressEn: opt(500),
  receiptFooterBn: opt(500),
  receiptFooterEn: opt(500),
  defaultCreditDays: integerField({ min: 0, max: 365 }),
  salePrefix: prefix(),
  receiptPrefix: prefix(),
});
export type ShopSettingsInput = z.input<typeof shopSettingsSchema>;
export type ShopSettingsValues = z.output<typeof shopSettingsSchema>;

export const securitySettingsSchema = z.object({
  autoLogoutMinutes: integerField({ min: 5, max: 240 }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], params: i18nIssue("passwordMismatch") });
