"use client";

import { Ban, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { voidPaymentAction } from "../../actions/payments";
import { cancelSaleAction } from "../../actions/sales";
import { ReasonDialog } from "../../components/reason-dialog";
import { Button } from "../../components/ui/button";

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const t = useTranslations("sales.detail");
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" className="h-11 text-destructive">
          <XCircle className="size-5" aria-hidden /> {t("cancel")}
        </Button>
      }
      title={t("cancelTitle")}
      description={t("cancelBody")}
      confirmLabel={t("cancel")}
      success={t("cancelled")}
      action={(reason) => cancelSaleAction({ saleId, reason })}
    />
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payments.detail");
  return (
    <ReasonDialog
      trigger={
        <Button variant="outline" className="h-11 text-destructive">
          <Ban className="size-5" aria-hidden /> {t("void")}
        </Button>
      }
      title={t("voidTitle")}
      description={t("voidBody")}
      confirmLabel={t("void")}
      success={t("voided")}
      action={(reason) => voidPaymentAction({ paymentId, reason })}
    />
  );
}
