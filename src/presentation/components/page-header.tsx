import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "./ui/button";

/** Screen title with an optional back link and actions; aligned on one baseline, wraps on narrow screens. */
export function PageHeader({
  title,
  description,
  backHref,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-3">
      {backHref && (
        <Button asChild variant="outline" size="icon" className="size-10 shrink-0 rounded-full">
          <Link href={backHref} aria-label={t("back")}>
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.375rem] leading-tight font-bold break-words sm:text-[1.625rem]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
