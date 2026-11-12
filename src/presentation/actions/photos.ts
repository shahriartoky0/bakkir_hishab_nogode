"use server";

import { z } from "zod";
import {
  PHOTO_PURPOSES,
  type PresignedPhotoUpload,
} from "@/application/use-cases/photos/create-photo-upload";
import { container } from "@/composition/container";
import { getCurrentUser } from "../auth/session";
import { actionErr, actionOk, type ActionResult } from "./result";

const presignSchema = z.object({
  purpose: z.enum(PHOTO_PURPOSES),
  contentType: z.string().min(1).max(100),
  displaySize: z.number().int().positive(),
  thumbSize: z.number().int().positive(),
});

export async function createPhotoUploadAction(input: unknown): Promise<ActionResult<PresignedPhotoUpload>> {
  if (!(await getCurrentUser())) return actionErr("UNAUTHORIZED");
  const parsed = presignSchema.safeParse(input);
  if (!parsed.success) return actionErr("VALIDATION");

  const result = await container.createPhotoUpload().execute(parsed.data);
  return result.ok ? actionOk(result.value) : actionErr(result.error);
}

const keysSchema = z.array(z.string().max(200)).max(100);

export async function getPhotoUrlsAction(keys: unknown): Promise<ActionResult<Record<string, string>>> {
  if (!(await getCurrentUser())) return actionErr("UNAUTHORIZED");
  const parsed = keysSchema.safeParse(keys);
  if (!parsed.success) return actionErr("VALIDATION");
  return actionOk(await container.getPhotoUrls().execute(parsed.data));
}
