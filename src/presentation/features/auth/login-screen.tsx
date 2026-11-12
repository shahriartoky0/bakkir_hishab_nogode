import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "../../components/app-shell/language-toggle";
import { ThemeToggle } from "../../components/app-shell/theme-toggle";
import { BrandMark } from "../../components/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { LoginForm } from "./login-form";

export async function LoginScreen() {
  const t = await getTranslations();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand-gold/15 blur-3xl" />
      <div className="relative flex justify-end gap-1 p-3">
        <LanguageToggle showName />
        <ThemeToggle />
      </div>
      <main className="relative flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center">
            <BrandMark className="mb-4 size-16 drop-shadow-md" />
            <p className="font-heading text-3xl leading-tight font-bold">{t("app.name")}</p>
            <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
          </div>
          <Card className="shadow-float">
            <CardHeader>
              <CardTitle className="text-xl">
                <h1>{t("auth.title")}</h1>
              </CardTitle>
              <CardDescription>{t("auth.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
