"use server";

import { z } from "zod";
import { container } from "@/composition/container";
import { FIELD_TYPES } from "@/domain/catalog/field-definition";
import { ok } from "@/domain/shared/result";
import { guarded } from "./guard";
import type { ActionResult } from "./result";

const text = (max = 500) => z.string().max(max).nullable().optional();

const settingsSchema = z
  .object({
    shopNameBn: text(120),
    shopNameEn: text(120),
    addressBn: text(),
    addressEn: text(),
    phone: text(30),
    logoKey: text(200),
    receiptFooterBn: text(),
    receiptFooterEn: text(),
    defaultLocale: z.enum(["bn", "en"]).optional(),
    useBanglaDigits: z.boolean().optional(),
    defaultCreditDays: z.number().int().optional(),
    salePrefix: z.string().max(10).optional(),
    receiptPrefix: z.string().max(10).optional(),
    autoLogoutMinutes: z.number().int().optional(),
  })
  .strict();

export async function updateSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(settingsSchema, input, async (patch) => {
    const r = await container.updateSettings().execute(patch);
    container.invalidateSettings();
    return r.ok ? ok(null) : r;
  });
}

export async function applyStarterSetAction(input: unknown): Promise<ActionResult<{ categories: number; fields: number }>> {
  return guarded(z.object({ apply: z.boolean() }), input, async (d) => {
    const r = await container.applyStarterSet().execute(d);
    container.invalidateSettings();
    return r;
  });
}

/* ---------- categories ---------- */

const id = z.string().min(1).max(64);

const categorySchema = z.object({
  id: id.optional(),
  parentId: id.nullable(),
  nameBn: z.string().max(80).nullable().optional(),
  nameEn: z.string().max(80).nullable().optional(),
});

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(categorySchema, input, async (d) => {
    const r = await container.saveCategory().execute(d);
    return r.ok ? ok({ id: r.value.id }) : r;
  });
}

export async function archiveCategoryAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.object({ id, archived: z.boolean() }), input, (d) => container.archiveCategory().execute(d));
}

export async function reorderCategoriesAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.array(id).min(1).max(200), input, (ids) => container.reorderCategories().execute(ids));
}

/* ---------- fields ---------- */

const optionSchema = z.object({
  value: z.string().max(60),
  labelBn: z.string().max(80).nullable(),
  labelEn: z.string().max(80).nullable(),
});

const fieldSchema = z.object({
  id: id.optional(),
  categoryId: id.nullable(),
  key: z.string().max(40),
  labelBn: z.string().max(80).nullable().optional(),
  labelEn: z.string().max(80).nullable().optional(),
  type: z.enum(FIELD_TYPES),
  options: z.array(optionSchema).max(50).optional(),
  unitBn: z.string().max(20).nullable().optional(),
  unitEn: z.string().max(20).nullable().optional(),
  isRequired: z.boolean().optional(),
  showOnReceipt: z.boolean().optional(),
});

export async function saveFieldAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(fieldSchema, input, async (d) => {
    const r = await container.saveField().execute(d);
    return r.ok ? ok({ id: r.value.id }) : r;
  });
}

export async function archiveFieldAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.object({ id, archived: z.boolean() }), input, (d) => container.archiveField().execute(d));
}

export async function reorderFieldsAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.array(id).min(1).max(200), input, (ids) => container.reorderFields().execute(ids));
}
