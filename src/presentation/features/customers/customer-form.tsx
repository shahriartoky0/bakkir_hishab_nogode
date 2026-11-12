"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { CustomerRecord } from "@/application/ports/records";
import { saveCustomerAction } from "../../actions/customers";
import { TextField } from "../../components/form-fields";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Form } from "../../components/ui/form";
import { useErrorText } from "../../hooks/use-error-text";
import { useZodErrorMap } from "../../hooks/use-zod-error-map";
import { customerFormSchema, type CustomerFormInput, type CustomerFormValues } from "../../schemas/customer";
import { PhotoUpload, type UploadedPhoto } from "../photos/photo-upload";

const money = (minor: number | null) => (minor === null ? "" : String(minor / 100));
const national = (e164: string | null) => (e164 ? e164.replace(/^\+880/, "0") : "");

export function CustomerForm({
  customer,
  photoUrl,
  initialPhone,
  compact,
  onSaved,
}: {
  customer?: CustomerRecord | null;
  photoUrl?: string | null;
  initialPhone?: string;
  /** Inline use (sale wizard): fewer sections. */
  compact?: boolean;
  /** Called after save instead of navigating to the profile. */
  onSaved?: (id: string, name: string, phone: string) => void;
}) {
  const t = useTranslations("customers.form");
  const tc = useTranslations("common");
  const errorMap = useZodErrorMap();
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [photo, setPhoto] = useState<UploadedPhoto[]>(
    customer?.photoKey && photoUrl
      ? [{ fileKey: customer.photoKey, thumbKey: customer.photoThumbKey ?? customer.photoKey, previewUrl: photoUrl }]
      : [],
  );

  const form = useForm<CustomerFormInput, unknown, CustomerFormValues>({
    mode: "onTouched",
    resolver: zodResolver(customerFormSchema, { error: errorMap }),
    defaultValues: {
      name: customer?.name ?? "",
      nameBn: customer?.nameBn ?? "",
      phone: customer ? national(customer.phone) : (initialPhone ?? ""),
      altPhone: national(customer?.altPhone ?? null),
      address: customer?.address ?? "",
      nidNumber: customer?.nidNumber ?? "",
      guarantorName: customer?.guarantorName ?? "",
      guarantorPhone: national(customer?.guarantorPhone ?? null),
      guarantorRelation: customer?.guarantorRelation ?? "",
      creditLimit: money(customer?.creditLimitMinor ?? null),
      notes: customer?.notes ?? "",
    },
  });

  const onSubmit = form.handleSubmit((v) => {
    setDuplicate(null);
    const { creditLimit, ...rest } = v;
    startTransition(async () => {
      const r = await saveCustomerAction({
        ...rest,
        id: customer?.id,
        creditLimitMinor: creditLimit,
        photoKey: photo[0]?.fileKey ?? null,
        photoThumbKey: photo[0]?.thumbKey ?? null,
      });
      if (!r.ok) {
        if (r.code === "DUPLICATE_PHONE" && typeof r.details?.existingId === "string") {
          setDuplicate({ id: r.details.existingId, name: String(r.details.existingName ?? "") });
          form.setError("phone", { message: errorText(r.code, r.details) });
        } else {
          toast.error(errorText(r.code, r.details));
        }
        return;
      }
      toast.success(tc("saved"));
      if (onSaved) onSaved(r.data.id, v.nameBn ?? v.name, v.phone);
      else {
        router.push(`/customers/${r.data.id}`);
        router.refresh();
      }
    });
  });

  const c = form.control;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {duplicate && (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {t("duplicate", { name: duplicate.name })}
              <Link href={`/customers/${duplicate.id}`} className="font-semibold underline">
                {t("openExisting")}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("basics")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={c} name="phone" label={t("phone")} numeric="phone" autoComplete="tel" description={t("phoneHint")} />
            <TextField control={c} name="name" label={t("name")} autoComplete="name" />
            <TextField control={c} name="nameBn" label={t("nameBn")} optional />
            <TextField control={c} name="altPhone" label={t("altPhone")} optional numeric="phone" />
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">
                {t("photo")} <span className="text-xs font-normal text-muted-foreground">· {tc("optional")}</span>
              </p>
              <PhotoUpload purpose="customer" value={photo} onChange={setPhoto} max={1} />
            </div>
            <TextField control={c} name="address" label={t("address")} optional multiline className="sm:col-span-2" />
          </CardContent>
        </Card>

        {!compact && (
          <Card>
            <CardHeader>
              <CardTitle>{t("more")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={c} name="creditLimit" label={t("creditLimit")} optional numeric="money" description={t("creditLimitHint")} />
              <TextField control={c} name="nidNumber" label={t("nid")} optional numeric="integer" />
              <TextField control={c} name="guarantorName" label={t("guarantorName")} optional />
              <TextField control={c} name="guarantorPhone" label={t("guarantorPhone")} optional numeric="phone" />
              <TextField control={c} name="guarantorRelation" label={t("guarantorRelation")} optional />
              <TextField control={c} name="notes" label={tc("notes")} optional multiline className="sm:col-span-2" />
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="h-12 w-full sm:w-auto" disabled={pending}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </form>
    </Form>
  );
}
