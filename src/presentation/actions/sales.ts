"use server";

import { z } from "zod";
import { container } from "@/composition/container";
import { PAYMENT_METHODS } from "@/domain/payment/payment";
import { MAX_INSTALLMENTS } from "@/domain/sale/installment-plan";
import { MAX_ITEMS, MAX_PHOTOS_PER_ITEM } from "@/domain/sale/sale";
import { guarded, retryOnce } from "./guard";
import type { ActionResult } from "./result";

const id = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minor = z.number().int().nonnegative();

const itemSchema = z.object({
  categoryId: id.nullable(),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(10_000),
  unitPriceMinor: minor,
  customFields: z.record(z.string().max(40), z.union([z.string().max(500), z.number(), z.boolean()])),
  notes: z.string().max(1000).nullable().optional(),
  photos: z
    .array(z.object({ fileKey: z.string().min(1).max(200), thumbKey: z.string().min(1).max(200) }))
    .min(1)
    .max(MAX_PHOTOS_PER_ITEM),
});

const planSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("single"), dueDate: isoDate }),
  z.object({
    kind: z.literal("installments"),
    count: z.number().int().min(1).max(MAX_INSTALLMENTS),
    frequency: z.enum(["monthly", "weekly"]),
    firstDate: isoDate,
    amounts: z.array(minor).max(MAX_INSTALLMENTS).optional(),
    dates: z.array(isoDate).max(MAX_INSTALLMENTS).optional(),
  }),
]);

const createSchema = z.object({
  idempotencyKey: z.uuid(),
  customerId: id,
  saleDate: isoDate.optional(),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  discountMinor: minor,
  upfront: z
    .object({ amountMinor: minor, method: z.enum(PAYMENT_METHODS), reference: z.string().max(100).nullable().optional() })
    .nullable()
    .optional(),
  plan: planSchema,
  notes: z.string().max(2000).nullable().optional(),
  confirmWarnings: z.boolean().optional(),
});

/** Double-tap safe: the idempotency key returns the same sale on repeat. */
export async function createSaleAction(input: unknown): Promise<ActionResult<{ saleId: string }>> {
  return guarded(createSchema, input, async (d) => {
    const r = await retryOnce(() => container.createSale().execute(d));
    return r.ok ? { ok: true as const, value: { saleId: r.value.saleId } } : r;
  });
}

const updateSchema = z.object({
  saleId: id,
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  discountMinor: minor,
  plan: planSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export async function updateSaleAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(updateSchema, input, (d) => container.updateSale().execute(d));
}

export async function cancelSaleAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.object({ saleId: id, reason: z.string().max(500) }), input, (d) => container.cancelSale().execute(d));
}
