"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "../../lib/utils";
import { BrandMark } from "../brand-mark";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Desktop sidebar (md+): brand, the primary "New sale" action, then navigation. */
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const primary = NAV_ITEMS.find((i) => i.primary);
  const items = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card md:flex">
      <Link href="/" className="flex h-16 items-center gap-3 px-5">
        <BrandMark />
        <span className="min-w-0">
          <span className="block truncate font-heading text-lg leading-tight font-semibold">{t("app.name")}</span>
          <span className="block truncate text-xs text-muted-foreground">{t("app.tagline")}</span>
        </span>
      </Link>

      {primary && (
        <div className="px-4 pt-2 pb-4">
          <Link
            href={primary.href}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-gold font-semibold text-brand-gold-foreground shadow-float transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
          >
            <primary.icon className="size-5" aria-hidden />
            {t(`nav.${primary.key}`)}
          </Link>
        </div>
      )}

      <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {items.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-primary/10 text-primary dark:bg-primary/15" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-gold" aria-hidden />}
                  <Icon className="size-5" aria-hidden />
                  <span>{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
