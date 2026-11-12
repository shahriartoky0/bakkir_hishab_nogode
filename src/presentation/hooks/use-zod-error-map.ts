"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { createZodErrorMap, type ValidationTranslator } from "../schemas/zod-error-map";

/** zod error map in the current UI language, for zodResolver(schema, { error }). */
export function useZodErrorMap() {
  const t = useTranslations("validation");
  return useMemo(() => createZodErrorMap(t as unknown as ValidationTranslator), [t]);
}
