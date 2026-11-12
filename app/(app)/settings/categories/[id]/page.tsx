import { FieldsScreen } from "@/presentation/features/settings/settings-screens";

export default async function CategoryFieldsPage({ params }: PageProps<"/settings/categories/[id]">) {
  const { id } = await params;
  return <FieldsScreen id={id} />;
}
