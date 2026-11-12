"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "../auth/session";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "../i18n/config";
import { actionErr, actionOk, type ActionResult } from "./result";
import { container } from "@/composition/container";

/** Switch UI language: cookie for this device + saved on the user row when signed in. */
export async function setLocaleAction(locale: unknown): Promise<ActionResult> {
  if (!isLocale(locale)) return actionErr("VALIDATION");

  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });

  const user = await getCurrentUser();
  if (user) await container.session().setLocale(user.id, locale);
  return actionOk(null);
}
