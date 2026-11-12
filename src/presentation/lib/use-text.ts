"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { pickText } from "@/domain/shared/bilingual";

/** Bilingual data text (category names, field labels) in the current UI language. */
export function useText() {
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "bn";
  return useCallback((bn: string | null | undefined, en: string | null | undefined) => pickText(bn, en, lang), [lang]);
}

export function useCustomerName() {
  const locale = useLocale();
  return useCallback((c: { name: string; nameBn: string | null }) => (locale === "bn" && c.nameBn ? c.nameBn : c.name), [locale]);
}
