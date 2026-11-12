import type { z } from "zod";
import { applicableFields, type FieldDefinition } from "@/domain/catalog/field-definition";
import type { Category } from "@/domain/catalog/category";
import type { PaymentMethod } from "@/domain/payment/payment";
import { buildSchedule, type RepaymentPlan, type ScheduledInstallment } from "@/domain/sale/installment-plan";
import { toLatinDigits } from "@/domain/shared/digits";
import { Money } from "@/domain/shared/money";
import { ShopDate } from "@/domain/shared/shop-date";
import type { UploadedPhoto } from "../../photos/photo-upload";
import { checkCustomFields, type CustomFieldInput } from "../../../schemas/custom-fields";
import { integerIssue, moneyIssue, type NumericIssue } from "../../../lib/numeric";

export interface ItemDraft {
  /** Local key for React lists. */
  key: string;
  categoryId: string | null;
  name: string;
  quantity: string;
  price: string;
  custom: CustomFieldInput;
  notes: string;
  photos: UploadedPhoto[];
}

export type ItemErrors = {
  name?: true;
  photos?: true;
  /** which numeric rule failed (drives the exact message) */
  quantity?: NumericIssue;
  price?: NumericIssue;
  custom?: Record<string, string>;
};

export interface PlanDraft {
  kind: "single" | "installments";
  dueDate: string;
  count: string;
  frequency: "monthly" | "weekly";
  firstDate: string;
  /** Edited amounts (taka text) when the owner changes the equal split. */
  amounts: string[] | null;
}

export interface PaymentDraft {
  discount: string;
  upfront: string;
  method: PaymentMethod;
  reference: string;
}

export const newItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  categoryId: null,
  name: "",
  quantity: "1",
  price: "",
  custom: {},
  notes: "",
  photos: [],
});

/** Taka text → paisa, or null when blank/invalid. */
export function parseMoney(text: string): number | null {
  if (!text.trim()) return null;
  const m = Money.parse(toLatinDigits(text).replace(/[,\s]/g, ""));
  return m.ok ? m.value.minor : null;
}

export function parseCount(text: string): number | null {
  const v = toLatinDigits(text).trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

export function lineTotal(item: ItemDraft): number {
  const q = parseCount(item.quantity) ?? 0;
  const p = parseMoney(item.price) ?? 0;
  return q * p;
}

export function fieldsFor(item: ItemDraft, categories: readonly Category[], fields: readonly FieldDefinition[]) {
  return applicableFields(item.categoryId, categories, fields);
}

export function validateItem(
  item: ItemDraft,
  categories: readonly Category[],
  fields: readonly FieldDefinition[],
  errorMap: z.core.$ZodErrorMap,
): ItemErrors {
  const e: ItemErrors = {};
  if (!item.name.trim()) e.name = true;
  const qIssue = integerIssue(item.quantity, { min: 1, max: 10_000 });
  if (qIssue) e.quantity = qIssue;
  const pIssue = moneyIssue(item.price);
  if (pIssue) e.price = pIssue;
  if (item.photos.length === 0) e.photos = true;
  const custom = checkCustomFields(fieldsFor(item, categories, fields), item.custom, errorMap);
  if (Object.keys(custom).length) e.custom = custom;
  return e;
}

export const hasErrors = (e: ItemErrors) => Object.keys(e).length > 0;

export function itemPayload(item: ItemDraft, categories: readonly Category[], fields: readonly FieldDefinition[]) {
  const defs = fieldsFor(item, categories, fields);
  const customFields: Record<string, string | boolean> = {};
  for (const f of defs) {
    const v = item.custom[f.key];
    if (v !== undefined && v !== "") customFields[f.key] = typeof v === "string" ? toLatinDigits(v).trim() : v;
  }
  return {
    categoryId: item.categoryId,
    name: item.name.trim(),
    quantity: parseCount(item.quantity) ?? 1,
    unitPriceMinor: parseMoney(item.price) ?? 0,
    customFields,
    notes: item.notes.trim() || null,
    photos: item.photos.map((p) => ({ fileKey: p.fileKey, thumbKey: p.thumbKey })),
  };
}

export function planPayload(plan: PlanDraft): RepaymentPlan | null {
  if (plan.kind === "single") return ShopDate.parse(toLatinDigits(plan.dueDate)).ok ? { kind: "single", dueDate: toLatinDigits(plan.dueDate) } : null;
  const count = parseCount(plan.count);
  if (!count) return null;
  const base = { kind: "installments" as const, count, frequency: plan.frequency, firstDate: toLatinDigits(plan.firstDate) };
  if (!plan.amounts) return base;
  const amounts = plan.amounts.map(parseMoney);
  if (amounts.some((a) => a === null)) return null;
  return { ...base, amounts: amounts as number[] };
}

/** Live schedule preview from the same domain rule the server uses. */
export function previewSchedule(financedMinor: number, plan: PlanDraft, saleDate: ShopDate) {
  const p = planPayload(plan);
  if (!p) return { ok: false as const, code: "INVALID_SCHEDULE" };
  const r = buildSchedule(financedMinor, p, saleDate);
  return r.ok ? { ok: true as const, schedule: r.value as ScheduledInstallment[] } : { ok: false as const, code: r.error.code };
}
