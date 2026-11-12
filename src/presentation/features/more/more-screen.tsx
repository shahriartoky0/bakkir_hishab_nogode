import { ChevronRight } from "@/presentation/components/icons";
import { Illustration, type IllustrationName } from "../../components/illustration";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LanguageToggle } from "../../components/app-shell/language-toggle";
import { ThemeToggle } from "../../components/app-shell/theme-toggle";
import { SignOutButton } from "../auth/sign-out-button";

type LinkItem = { href: string; icon: IllustrationName; label: string; hint: string };

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">{children}</ul>
    </section>
  );
}

function IconTile({ icon }: { icon: IllustrationName }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft">
      <Illustration name={icon} size={30} />
    </span>
  );
}

function LinkRow({ href, icon, label, hint }: LinkItem) {
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent/60">
        <IconTile icon={icon} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{label}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function ControlRow({ icon, label, control }: { icon: IllustrationName; label: string; control: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 px-4 py-2">
      <IconTile icon={icon} />
      <span className="flex-1 font-medium">{label}</span>
      {control}
    </li>
  );
}

export async function MoreScreen() {
  const t = await getTranslations();
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[1.375rem] font-bold sm:text-[1.625rem]">{t("more.title")}</h1>

      <Group>
        <LinkRow href="/reports" icon="bar-chart" label={t("more.reports")} hint={t("more.reportsHint")} />
      </Group>

      <Group title={t("more.settings")}>
        <LinkRow href="/settings/shop" icon="store" label={t("more.shop")} hint={t("more.shopHint")} />
        <LinkRow href="/settings/categories" icon="card-box" label={t("more.categories")} hint={t("more.categoriesHint")} />
        <LinkRow href="/settings/language" icon="globe" label={t("more.language")} hint={t("more.languageHint")} />
        <LinkRow href="/settings/security" icon="lock" label={t("more.security")} hint={t("more.securityHint")} />
        <LinkRow href="/settings/activity" icon="scroll" label={t("more.activity")} hint={t("more.activityHint")} />
        <LinkRow href="/settings/export" icon="floppy" label={t("more.export")} hint={t("more.exportHint")} />
      </Group>

      <Group title={t("more.danger")}>
        <li>
          <Link href="/settings/clear-data" className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-destructive-soft/60">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive-soft">
              <Illustration name="wastebasket" size={30} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-destructive">{t("more.clearData")}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{t("more.clearDataHint")}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      </Group>

      <Group title={t("more.appearance")}>
        <ControlRow icon="globe" label={t("language.label")} control={<LanguageToggle showName />} />
        <ControlRow icon="palette" label={t("theme.toggle")} control={<ThemeToggle />} />
      </Group>

      <SignOutButton />
    </section>
  );
}
