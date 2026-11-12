"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { ValidationKey } from "../schemas/zod-error-map";

/** `validation.<key>` text with values ({min}, {max}) — null passes through (no error). */
export function useValidationText() {
  const t = useTranslations("validation");
  return useCallback(
    (key: ValidationKey | null | undefined | false, values?: Record<string, string | number>): string | null =>
      key ? t(key, values as never) : null,
    [t],
  );
}
