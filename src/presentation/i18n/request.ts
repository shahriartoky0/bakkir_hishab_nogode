import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { SHOP_TIME_ZONE } from "@/domain/shared/shop-date";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";
import { loadMessages } from "./messages";

/**
 * No /bn or /en URL prefix: the locale lives in a cookie (and on the user row,
 * copied to the cookie at sign-in).
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(explicit) ? explicit : isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: SHOP_TIME_ZONE,
  };
});
