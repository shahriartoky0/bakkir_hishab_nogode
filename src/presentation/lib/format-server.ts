import "server-only";
import { getLocale } from "next-intl/server";
import { container } from "@/composition/container";
import { isLocale } from "../i18n/config";
import { bindFormat, type FormatPrefs } from "./format";

/** Format preferences for this request: UI language + the shop's use_bangla_digits. */
export async function getFormatPrefs(localeOverride?: string): Promise<FormatPrefs> {
  const locale = isLocale(localeOverride) ? localeOverride : await getLocale();
  let banglaDigits = true;
  try {
    banglaDigits = (await container.settings()).useBanglaDigits;
  } catch {
    // settings unavailable (e.g. DB down on the login page): keep the default
  }
  return { locale: locale as FormatPrefs["locale"], banglaDigits };
}

export async function getFormat(localeOverride?: string) {
  return bindFormat(await getFormatPrefs(localeOverride));
}
