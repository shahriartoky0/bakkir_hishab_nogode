"use server";

import { z } from "zod";
import { container } from "@/composition/container";
import { FOLLOW_UP_CHANNELS, FOLLOW_UP_OUTCOMES } from "@/domain/followup/follow-up";
import { guarded } from "./guard";
import type { ActionResult } from "./result";

const schema = z.object({
  customerId: z.string().min(1).max(64),
  saleId: z.string().min(1).max(64).nullable().optional(),
  channel: z.enum(FOLLOW_UP_CHANNELS),
  outcome: z.enum(FOLLOW_UP_OUTCOMES),
  note: z.string().max(1000).nullable().optional(),
  promisedAmountMinor: z.number().int().positive().nullable().optional(),
  promisedDate: z.string().max(10).nullable().optional(),
});

export async function logFollowUpAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(schema, input, (d) => container.logFollowUp().execute(d));
}
