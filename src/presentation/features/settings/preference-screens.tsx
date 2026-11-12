import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { PageHeader } from "../../components/page-header";
import { defaultMessages } from "../../i18n/messages";
import { LanguagePrefsForm, WordingEditor, type WordingEntry } from "./language-settings";
import { AutoLogoutCard, ChangePasswordCard, SignOutEverywhereCard } from "./security-settings";

export async function LanguageScreen() {
  const t = await getTranslations("settings.language");
  const [settings, overrides] = await Promise.all([container.settings(), container.translationOverrides()]);
  const find = (locale: "bn" | "en", key: string) => overrides.find((o) => o.locale === locale && o.key === key)?.value ?? null;
  const entries: WordingEntry[] = defaultMessages().map((m) => ({ ...m, bnOverride: find("bn", m.key), enOverride: find("en", m.key) }));
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} backHref="/more" />
      <LanguagePrefsForm defaultLocale={settings.defaultLocale} useBanglaDigits={settings.useBanglaDigits} />
      <WordingEditor entries={entries} />
    </section>
  );
}

export async function SecurityScreen() {
  const t = await getTranslations("settings.security");
  const settings = await container.settings();
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} backHref="/more" />
      <ChangePasswordCard />
      <AutoLogoutCard minutes={settings.autoLogoutMinutes} />
      <SignOutEverywhereCard />
    </section>
  );
}
