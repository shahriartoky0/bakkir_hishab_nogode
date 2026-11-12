import { getTranslations } from "next-intl/server";
import { ShopDate } from "@/domain/shared/shop-date";
import { PageHeader } from "../../components/page-header";
import { ClearDataPanel } from "./clear-data-panel";

export async function ClearDataScreen() {
  const t = await getTranslations("settings.clearData");
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("title")} description={t("description")} backHref="/more" />
      <ClearDataPanel todayIso={ShopDate.fromInstant(new Date()).iso} />
    </section>
  );
}
