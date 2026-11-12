"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { SettingsRecord } from "@/application/ports/records";
import { updateSettingsAction } from "../../actions/settings";
import { TextField } from "../../components/form-fields";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Form } from "../../components/ui/form";
import { useAction } from "../../hooks/use-action";
import { useZodErrorMap } from "../../hooks/use-zod-error-map";
import { shopSettingsSchema, type ShopSettingsInput, type ShopSettingsValues } from "../../schemas/settings";
import { PhotoUpload, type UploadedPhoto } from "../photos/photo-upload";

export function ShopSettingsForm({ settings, logoUrl }: { settings: SettingsRecord; logoUrl: string | null }) {
  const t = useTranslations("settings.shop");
  const tc = useTranslations("common");
  const errorMap = useZodErrorMap();
  const { pending, run } = useAction();
  const [logo, setLogo] = useState<UploadedPhoto[]>(
    settings.logoKey && logoUrl ? [{ fileKey: settings.logoKey, thumbKey: settings.logoKey, previewUrl: logoUrl }] : [],
  );

  const form = useForm<ShopSettingsInput, unknown, ShopSettingsValues>({
    mode: "onTouched",
    resolver: zodResolver(shopSettingsSchema, { error: errorMap }),
    defaultValues: {
      shopNameBn: settings.shopNameBn ?? "",
      shopNameEn: settings.shopNameEn ?? "",
      phone: settings.phone ?? "",
      addressBn: settings.addressBn ?? "",
      addressEn: settings.addressEn ?? "",
      receiptFooterBn: settings.receiptFooterBn ?? "",
      receiptFooterEn: settings.receiptFooterEn ?? "",
      defaultCreditDays: String(settings.defaultCreditDays),
      salePrefix: settings.salePrefix,
      receiptPrefix: settings.receiptPrefix,
    },
  });

  const onSubmit = form.handleSubmit((v) =>
    run(() => updateSettingsAction({ ...v, logoKey: logo[0]?.fileKey ?? null }), { success: tc("saved") }),
  );
  const c = form.control;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>{t("identity")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={c} name="shopNameBn" label={t("nameBn")} optional />
            <TextField control={c} name="shopNameEn" label={t("nameEn")} optional />
            <TextField control={c} name="phone" label={t("phone")} optional numeric="phone" />
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">{t("logo")}</p>
              <PhotoUpload purpose="logo" value={logo} onChange={setLogo} max={1} />
            </div>
            <TextField control={c} name="addressBn" label={t("addressBn")} optional multiline />
            <TextField control={c} name="addressEn" label={t("addressEn")} optional multiline />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("receipts")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={c} name="receiptFooterBn" label={t("footerBn")} optional multiline />
            <TextField control={c} name="receiptFooterEn" label={t("footerEn")} optional multiline />
            <TextField control={c} name="salePrefix" label={t("salePrefix")} description={t("prefixHint")} />
            <TextField control={c} name="receiptPrefix" label={t("receiptPrefix")} description={t("prefixHint")} />
            <TextField
              control={c}
              name="defaultCreditDays"
              label={t("creditDays")}
              description={t("creditDaysHint")}
              numeric="integer"
            />
          </CardContent>
        </Card>

        <Button type="submit" className="h-12 w-full sm:w-auto" disabled={pending}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </form>
    </Form>
  );
}
