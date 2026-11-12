import { param } from "@/presentation/lib/server";
import { NewSaleScreen } from "@/presentation/features/sales/sale-screens";

export default async function NewSalePage({ searchParams }: PageProps<"/sales/new">) {
  const sp = await searchParams;
  return <NewSaleScreen customerId={param(sp.customer)} />;
}
