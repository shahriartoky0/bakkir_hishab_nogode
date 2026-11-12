import { EditSaleScreen } from "@/presentation/features/sales/sale-screens";

export default async function EditSalePage({ params }: PageProps<"/sales/[id]/edit">) {
  const { id } = await params;
  return <EditSaleScreen id={id} />;
}
