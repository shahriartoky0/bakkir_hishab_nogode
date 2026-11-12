"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "../../components/ui/button";
import { chipClass } from "../../components/chip";

/** Screen-only controls above a printable page: back, language, paper size, print. */
export function PrintToolbar({ backHref, lang, size, children }: { backHref: string; lang: "bn" | "en"; size: "a4" | "80"; children?: React.ReactNode }) {
  const t = useTranslations("print");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    return `${pathname}?${p.toString()}`;
  };
  const chip = (active: boolean) =>
    chipClass(active);

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="size-11">
        <Link href={backHref} aria-label={tc("back")}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">{tc("printIn")}:</span>
      {/* i18n-ignore: language names are shown in their own script */}
      <Link href={href({ lang: "bn" })} className={chip(lang === "bn")} replace>
        {/* i18n-ignore */}
        বাংলা
      </Link>
      {/* i18n-ignore */}
      <Link href={href({ lang: "en" })} className={chip(lang === "en")} replace>
        {/* i18n-ignore */}
        English
      </Link>
      <span className="ml-2 text-sm text-muted-foreground">{t("paper")}:</span>
      <Link href={href({ size: "a4" })} className={chip(size === "a4")} replace>
        {t("a4")}
      </Link>
      <Link href={href({ size: "80" })} className={chip(size === "80")} replace>
        {t("thermal")}
      </Link>
      {children}
      <Button className="ml-auto h-11" onClick={() => window.print()}>
        <Printer className="size-5" aria-hidden /> {tc("print")}
      </Button>
    </div>
  );
}
