"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { container } from "@/composition/container";
import { getCurrentUser } from "../auth/session";
import { guarded } from "./guard";
import { actionErr, type ActionResult } from "./result";

export async function changePasswordAction(input: unknown): Promise<ActionResult<null>> {
  const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) });
  return guarded(schema, input, (d) => container.changePassword().execute(d));
}

/** Revoke every session (all devices), then go to the login page. */
export async function signOutEverywhereAction(): Promise<ActionResult<null>> {
  if (!(await getCurrentUser())) return actionErr("UNAUTHORIZED");
  await container.signOutEverywhere().execute();
  redirect("/login");
}
