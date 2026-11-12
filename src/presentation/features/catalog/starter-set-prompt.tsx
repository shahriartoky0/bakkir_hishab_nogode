"use client";

import { Gem } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { applyStarterSetAction } from "../../actions/settings";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAction } from "../../hooks/use-action";

/** First-run offer of the jewelry starter set (spec 6.1). Shown until accepted or declined. */
export function StarterSetPrompt() {
  const t = useTranslations("settings.starter");
  const { pending, run } = useAction();
  return (
    <Card className="border-gold/40 bg-gold-soft/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gem className="size-5 text-gold" aria-hidden /> {t("title")}
        </CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button className="h-11" disabled={pending} onClick={() => run(() => applyStarterSetAction({ apply: true }), { success: t("applied") })}>
          {t("apply")}
        </Button>
        <Button variant="outline" className="h-11" disabled={pending} onClick={() => run(() => applyStarterSetAction({ apply: false }))}>
          {t("skip")}
        </Button>
      </CardContent>
    </Card>
  );
}
