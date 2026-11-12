export const LOCALES = ["bn", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];

/** Bangla is the default UI language (spec 4.1). */
export const DEFAULT_LOCALE: AppLocale = "bn";
export const LOCALE_COOKIE = "BAKI_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: AppLocale): AppLocale {
  return locale === "bn" ? "en" : "bn";
}
