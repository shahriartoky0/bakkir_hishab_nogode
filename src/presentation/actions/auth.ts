"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { container } from "@/composition/container";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "../i18n/config";
import { signInSchema } from "../schemas/auth";
import { actionErr, type ActionResult } from "./result";

export async function signInAction(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return actionErr("VALIDATION");

  let result;
  try {
    result = await container.signIn().execute(parsed.data);
  } catch {
    return actionErr("UNKNOWN"); // already logged by the gateway
  }
  if (!result.ok) return actionErr(result.error);

  // The user's saved language becomes the UI language on this device.
  const locale = isLocale(result.value.locale) ? result.value.locale : DEFAULT_LOCALE;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await container.session().signOut();
  redirect("/login");
}
