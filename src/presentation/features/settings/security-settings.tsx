"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "@/presentation/components/icons";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { changePasswordAction, signOutEverywhereAction } from "../../actions/account";
import { updateSettingsAction } from "../../actions/settings";
import { TextField } from "../../components/form-fields";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Form } from "../../components/ui/form";
import { useAction } from "../../hooks/use-action";
import { useZodErrorMap } from "../../hooks/use-zod-error-map";
import { changePasswordSchema, securitySettingsSchema } from "../../schemas/settings";
import type { z } from "zod";

export function ChangePasswordCard() {
  const t = useTranslations("settings.security");
  const errorMap = useZodErrorMap();
  const { pending, run } = useAction();
  const form = useForm<z.input<typeof changePasswordSchema>>({
    mode: "onTouched",
    resolver: zodResolver(changePasswordSchema, { error: errorMap }),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const onSubmit = form.handleSubmit((v) =>
    run(() => changePasswordAction({ currentPassword: v.currentPassword, newPassword: v.newPassword }), {
      success: t("passwordChanged"),
      onSuccess: () => form.reset(),
    }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("changePassword")}</CardTitle>
        <CardDescription>{t("changePasswordHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <TextField control={form.control} name="currentPassword" label={t("currentPassword")} type="password" autoComplete="current-password" />
            <TextField control={form.control} name="newPassword" label={t("newPassword")} type="password" autoComplete="new-password" />
            <TextField control={form.control} name="confirmPassword" label={t("confirmPassword")} type="password" autoComplete="new-password" />
            <Button type="submit" className="h-12" disabled={pending}>
              {t("changePassword")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function AutoLogoutCard({ minutes }: { minutes: number }) {
  const t = useTranslations("settings.security");
  const tc = useTranslations("common");
  const errorMap = useZodErrorMap();
  const { pending, run } = useAction();
  const form = useForm<z.input<typeof securitySettingsSchema>, unknown, z.output<typeof securitySettingsSchema>>({
    mode: "onTouched",
    resolver: zodResolver(securitySettingsSchema, { error: errorMap }),
    defaultValues: { autoLogoutMinutes: String(minutes) },
  });
  const onSubmit = form.handleSubmit((v) => run(() => updateSettingsAction(v), { success: tc("saved") }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("autoLogout")}</CardTitle>
        <CardDescription>{t("autoLogoutHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
            <TextField control={form.control} name="autoLogoutMinutes" label={t("minutes")} numeric="integer" className="w-40" />
            <Button type="submit" className="h-12" disabled={pending}>
              {tc("save")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function SignOutEverywhereCard() {
  const t = useTranslations("settings.security");
  const { pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signOutAll")}</CardTitle>
        <CardDescription>{t("signOutAllHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="h-12 text-destructive" disabled={pending} onClick={() => run(() => signOutEverywhereAction())}>
          <LogOut className="size-5" aria-hidden /> {t("signOutAll")}
        </Button>
      </CardContent>
    </Card>
  );
}
