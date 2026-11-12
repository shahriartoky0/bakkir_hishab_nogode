"use server";

import { z } from "zod";
import { container } from "@/composition/container";
import { MESSAGE_KEYS } from "../i18n/messages";
import { guarded } from "./guard";
import type { ActionResult } from "./result";

const schema = z.object({
  locale: z.enum(["bn", "en"]),
  key: z.string().min(1).max(200),
  /** null or "" = reset to the file default */
  value: z.string().max(1000).nullable(),
});

/** Change (or reset) the wording of one UI message; applies on the next request (spec 4.3). */
export async function setTranslationOverrideAction(input: unknown): Promise<ActionResult<null>> {
  container.setKnownMessageKeys(MESSAGE_KEYS);
  return guarded(schema, input, async (d) => {
    const r = await container.setTranslationOverride().execute(d);
    container.invalidateTranslations();
    return r;
  });
}
