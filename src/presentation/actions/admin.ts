"use server";

import { z } from "zod";
import type { ClearCounts } from "@/application/ports/repositories";
import { container } from "@/composition/container";
import { guarded } from "./guard";
import type { ActionResult } from "./result";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rangeSchema = z.object({ from: isoDate, to: isoDate, removeEmptyCustomers: z.boolean() });

/** What "clear data" would delete for this range (nothing is changed). */
export async function previewClearAction(input: unknown): Promise<ActionResult<ClearCounts>> {
  return guarded(rangeSchema, input, (d) => container.clearDateRange().preview(d));
}

/** Permanently delete everything dated in the range (requires the typed confirmation). */
export async function clearDataAction(input: unknown): Promise<ActionResult<ClearCounts>> {
  return guarded(rangeSchema.extend({ confirm: z.string().max(20) }), input, async (d) => {
    const r = await container.clearDateRange().execute(d);
    container.invalidateSettings();
    return r;
  });
}
