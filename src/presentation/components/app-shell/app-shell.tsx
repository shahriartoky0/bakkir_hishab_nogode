import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import Link from "next/link";
import { container } from "@/composition/container";
import { BrandMark } from "../brand-mark";
import { BottomNav } from "./bottom-nav";
import { IdleLogout } from "./idle-logout";
import { LanguageToggle } from "./language-toggle";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: ReactNode;
}) {
  const t = await getTranslations("app");
  const autoLogoutMinutes = await container
    .settings()
    .then((s) => s.autoLogoutMinutes)
    .catch(() => 30);

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur-md md:h-16 md:px-6">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 md:invisible">
            <BrandMark className="size-8" />
            <span className="truncate font-heading text-lg font-semibold">{t("name")}</span>
          </Link>
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>
      <BottomNav />
      <IdleLogout minutes={autoLogoutMinutes} />
    </div>
  );
}
