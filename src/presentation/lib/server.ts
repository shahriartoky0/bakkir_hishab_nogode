import "server-only";
import { getLocale } from "next-intl/server";
import { container } from "@/composition/container";
import { pickText } from "@/domain/shared/bilingual";
import { isLocale, type AppLocale } from "../i18n/config";

/** Presigned GET URLs for the given keys (nulls skipped). Missing storage config → no URLs. */
export async function signPhotos(keys: readonly (string | null | undefined)[]): Promise<Record<string, string>> {
  const list = [...new Set(keys.filter((k): k is string => Boolean(k)))];
  if (list.length === 0) return {};
  try {
    return await container.getPhotoUrls().execute(list);
  } catch (e) {
    console.error("[photos] could not sign photo URLs", e);
    return {};
  }
}

export async function currentLang(): Promise<AppLocale> {
  const l = await getLocale();
  return isLocale(l) ? l : "bn";
}

/** Bilingual data text for the current language (falls back to the other). */
export async function textPicker() {
  const lang = await currentLang();
  return (bn: string | null | undefined, en: string | null | undefined) => pickText(bn, en, lang);
}

/** Display name for a customer: Bangla name in Bangla UI when present. */
export function customerName(c: { name: string; nameBn: string | null }, lang: AppLocale): string {
  return lang === "bn" && c.nameBn ? c.nameBn : c.name;
}

/** First value of a search param. */
export function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
