import { param } from "@/presentation/lib/server";
import { CustomersScreen } from "@/presentation/features/customers/customer-screens";

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const sp = await searchParams;
  return <CustomersScreen filter={param(sp.filter)} />;
}
