"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "../../lib/utils";
import { Illustration } from "../illustration";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Mobile bottom navigation (hidden on md+ where the sidebar takes over). */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur md:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ key, href, icon: Icon, illustration, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none font-medium transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {primary ? (
                  <span className="-mt-7 flex size-14 items-center justify-center rounded-2xl bg-brand-gold text-brand-gold-foreground shadow-float ring-4 ring-card transition-transform duration-150 active:scale-95">
                    <Icon className="size-7" aria-hidden />
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150",
                      active && "bg-primary/10 dark:bg-primary/15",
                    )}
                  >
                    <Illustration
                      name={illustration}
                      size={26}
                      eager
                      className={cn(
                        "transition-[filter,opacity,transform] duration-150 motion-reduce:transition-none",
                        active ? "scale-110" : "opacity-80 grayscale-[40%]",
                      )}
                    />
                  </span>
                )}
                <span className={cn("line-clamp-1 text-center", active && "font-semibold")}>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
