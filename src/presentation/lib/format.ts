import { bn as bnLocale } from "date-fns/locale/bn";
import { enUS } from "date-fns/locale/en-US";
import { formatInTimeZone } from "date-fns-tz";
import { toBanglaDigits } from "@/domain/shared/digits";
import { PhoneNumber } from "@/domain/shared/phone-number";
import { SHOP_TIME_ZONE, ShopDate } from "@/domain/shared/shop-date";
import type { AppLocale } from "../i18n/config";

/**
 * The one place that turns numbers, money, dates and phones into display text
 * (spec 4.4). Grouping is always lakh/crore (en-IN pattern); Bangla digits are
 * applied when the UI is Bangla and the shop's `use_bangla_digits` is on.
 */
export interface FormatPrefs {
  locale: AppLocale;
  banglaDigits: boolean;
}

export const TAKA = "৳";

function digits(text: string, p: FormatPrefs): string {
  return p.locale === "bn" && p.banglaDigits ? toBanglaDigits(text) : text;
}

const groupFormatters = new Map<string, Intl.NumberFormat>();
function grouped(value: number, minFrac: number, maxFrac: number): string {
  const key = `${minFrac}:${maxFrac}`;
  let f = groupFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
      useGrouping: true,
    });
    groupFormatters.set(key, f);
  }
  return f.format(value);
}

/** 125000 → "1,25,000" / "১,২৫,০০০" */
export function formatNumber(value: number, p: FormatPrefs, maxFractionDigits = 3): string {
  return digits(grouped(value, 0, maxFractionDigits), p);
}

/**
 * Paisa → "৳ 1,25,000" (whole taka) or "৳ 1,250.50" (with paisa).
 * Negative amounts render as "-৳ 500".
 */
export function formatMoney(minor: number, p: FormatPrefs, opts: { alwaysShowPaisa?: boolean } = {}): string {
  const abs = Math.abs(minor);
  const hasPaisa = abs % 100 !== 0;
  const frac = hasPaisa || opts.alwaysShowPaisa ? 2 : 0;
  const body = grouped(abs / 100, frac, frac);
  return `${minor < 0 ? "-" : ""}${TAKA} ${digits(body, p)}`;
}

export type DateStyle = "short" | "medium" | "long";

const DATE_PATTERNS: Record<DateStyle, string> = {
  short: "dd/MM/yyyy",
  medium: "d MMM yyyy",
  long: "d MMMM yyyy",
};

function dateLocale(p: FormatPrefs) {
  return p.locale === "bn" ? bnLocale : enUS;
}

/** A calendar day: "১২ নভেম্বর ২০২৬" / "12 November 2026". */
export function formatDate(date: ShopDate | Date | string, p: FormatPrefs, style: DateStyle = "medium"): string {
  const instant =
    date instanceof ShopDate ? date.toDate() : typeof date === "string" ? ShopDate.of(date).toDate() : date;
  const text = formatInTimeZone(instant, SHOP_TIME_ZONE, DATE_PATTERNS[style], { locale: dateLocale(p) });
  return digits(text, p);
}

/** An instant in shop time: "১২ নভেম্বর ২০২৬, ৩:০৫ PM". */
export function formatDateTime(instant: Date, p: FormatPrefs): string {
  const text = formatInTimeZone(instant, SHOP_TIME_ZONE, "d MMM yyyy, h:mm a", { locale: dateLocale(p) });
  return digits(text, p);
}

/** All helpers bound to one set of prefs (used by useFormat() and getFormat()). */
export function bindFormat(prefs: FormatPrefs) {
  return {
    prefs,
    money: (minor: number, opts?: { alwaysShowPaisa?: boolean }) => formatMoney(minor, prefs, opts),
    number: (n: number, maxFractionDigits?: number) => formatNumber(n, prefs, maxFractionDigits),
    date: (d: ShopDate | Date | string, style?: DateStyle) => formatDate(d, prefs, style),
    dateTime: (d: Date) => formatDateTime(d, prefs),
    phone: (e164: string) => formatPhone(e164, prefs),
  };
}

/** "+8801712345678" → "01712-345678" (digits localized). */
export function formatPhone(e164: string, p: FormatPrefs): string {
  const r = PhoneNumber.parse(e164);
  if (!r.ok) return e164;
  const n = r.value.national;
  return digits(`${n.slice(0, 5)}-${n.slice(5)}`, p);
}
