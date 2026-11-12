"use server";

import { z } from "zod";
import { container } from "@/composition/container";
import { ADJUSTMENT_TYPES, PAYMENT_METHODS } from "@/domain/payment/payment";
import { guarded, retryOnce } from "./guard";
import type { ActionResult } from "./result";

const id = z.string().min(1).max(64);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const receiveSchema = z.object({
  idempotencyKey: z.uuid(),
  customerId: id,
  amountMinor: z.number().int().positive(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(100).nullable().optional(),
  date: isoDate.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  saleId: id.nullable().optional(),
});

/** Double-tap safe: the idempotency key returns the same payment on repeat. */
export async function receivePaymentAction(input: unknown): Promise<ActionResult<{ paymentId: string }>> {
  return guarded(receiveSchema, input, async (d) => {
    const r = await retryOnce(() => container.receivePayment().execute(d));
    return r.ok ? { ok: true as const, value: { paymentId: r.value.paymentId } } : r;
  });
}

export async function voidPaymentAction(input: unknown): Promise<ActionResult<null>> {
  return guarded(z.object({ paymentId: id, reason: z.string().max(500) }), input, (d) => container.voidPayment().execute(d));
}

const adjustmentSchema = z.object({
  customerId: id,
  saleId: id.nullable().optional(),
  type: z.enum(ADJUSTMENT_TYPES),
  direction: z.enum(["debit", "credit"]).optional(),
  amountMinor: z.number().int().positive(),
  reason: z.string().max(500),
  dueDate: isoDate.nullable().optional(),
});

export async function createAdjustmentAction(input: unknown): Promise<ActionResult<{ adjustmentId: string }>> {
  return guarded(adjustmentSchema, input, (d) => container.createAdjustment().execute(d));
}
