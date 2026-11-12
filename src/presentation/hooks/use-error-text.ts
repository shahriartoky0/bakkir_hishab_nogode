"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { Messages } from "../i18n/messages";

type ErrorKey = keyof Messages["errors"];

/** Translate a domain/action error code (e.g. "DUPLICATE_PHONE") to UI text. */
export function useErrorText() {
  const t = useTranslations("errors");
  return useCallback(
    (code: string, details?: Record<string, string | number | boolean | null>) => {
      const key = (t.has(code as ErrorKey) ? code : "UNKNOWN") as ErrorKey;
      const values = Object.fromEntries(
        Object.entries(details ?? {}).filter((e): e is [string, string | number] => typeof e[1] !== "boolean" && e[1] !== null),
      );
      return t(key, values as never);
    },
    [t],
  );
}
