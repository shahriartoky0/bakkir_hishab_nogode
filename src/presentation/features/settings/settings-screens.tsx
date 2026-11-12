import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { container } from "@/composition/container";
import { applicableFields } from "@/domain/catalog/field-definition";
import { PageHeader } from "../../components/page-header";
import { signPhotos, textPicker } from "../../lib/server";
import { CategoryManager } from "../catalog/category-manager";
import { FieldManager } from "../catalog/field-manager";
import { StarterSetPrompt } from "../catalog/starter-set-prompt";
import { StorageCheck } from "../photos/storage-check";
import { ShopSettingsForm } from "./shop-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export async function ShopSettingsScreen() {
  const t = await getTranslations("settings");
  const tm = await getTranslations("more");
  const settings = await container.settings();
  const urls = await signPhotos([settings.logoKey]);
  return (
    <section className="space-y-4">
      <PageHeader title={t("shop.title")} backHref="/more" />
      <ShopSettingsForm settings={settings} logoUrl={settings.logoKey ? (urls[settings.logoKey] ?? null) : null} />
      <Card>
        <CardHeader>
          <CardTitle>{tm("storageCheck")}</CardTitle>
          <CardDescription>{tm("storageCheckHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <StorageCheck />
        </CardContent>
      </Card>
    </section>
  );
}

export async function CategoriesScreen() {
  const t = await getTranslations("settings.categories");
  const catalog = container.catalog();
  const [categories, fields, settings] = await Promise.all([catalog.listCategories(), catalog.listFields(), container.settings()]);
  const fieldCounts: Record<string, number> = {};
  for (const f of fields) if (f.categoryId && !f.archivedAt) fieldCounts[f.categoryId] = (fieldCounts[f.categoryId] ?? 0) + 1;
  return (
    <section className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} backHref="/more" />
      {!settings.starterSetDecidedAt && <StarterSetPrompt />}
      <CategoryManager categories={categories} fieldCounts={fieldCounts} />
    </section>
  );
}

/** `id` = category id, or "global" for fields that apply to every item. */
export async function FieldsScreen({ id }: { id: string }) {
  const t = await getTranslations("settings.fields");
  const text = await textPicker();
  const catalog = container.catalog();
  const [categories, fields] = await Promise.all([catalog.listCategories(), catalog.listFields()]);
  const categoryId = id === "global" ? null : id;
  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;
  if (categoryId && !category) notFound();

  const own = fields.filter((f) => f.categoryId === categoryId);
  const inherited = categoryId ? applicableFields(categoryId, categories, fields).filter((f) => f.categoryId !== categoryId) : [];
  const title = category ? t("titleFor", { name: text(category.nameBn, category.nameEn) }) : t("globalTitle");

  return (
    <section className="space-y-4">
      <PageHeader title={title} description={category ? t("description") : t("globalDescription")} backHref="/settings/categories" />
      <FieldManager categoryId={categoryId} fields={own} inherited={inherited} />
    </section>
  );
}
