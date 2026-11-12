"use client";

import { Languages } from "@/presentation/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { setLocaleAction } from "../../actions/locale";
import { useErrorText } from "../../hooks/use-error-text";
import { otherLocale } from "../../i18n/config";
import { Button } from "../ui/button";

/** Switches between Bangla and English; label shows the language you'll switch to. */
export function LanguageToggle({ showName = false }: { showName?: boolean }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size={showName ? "default" : "sm"}
      aria-label={t("switch")}
      title={t("switch")}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setLocaleAction(otherLocale(locale));
          if (!r.ok) toast.error(errorText(r.code));
          router.refresh();
        })
      }
    >
      <Languages className="size-4" aria-hidden />
      <span>{showName ? t("otherName") : t("otherShort")}</span>
    </Button>
  );
}
