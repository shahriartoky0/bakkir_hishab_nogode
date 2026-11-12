import { SaleDetailScreen } from "@/presentation/features/sales/sale-screens";

export default async function SalePage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  return <SaleDetailScreen id={id} />;
}
