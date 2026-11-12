"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
      <AlertTriangle className="size-10 text-destructive" aria-hidden />
      <p className="font-medium">{t("errors.UNKNOWN")}</p>
      {onRetry && (
        <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
