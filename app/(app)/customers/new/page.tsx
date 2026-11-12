import { param } from "@/presentation/lib/server";
import { NewCustomerScreen } from "@/presentation/features/customers/customer-screens";

export default async function NewCustomerPage({ searchParams }: PageProps<"/customers/new">) {
  const sp = await searchParams;
  return <NewCustomerScreen phone={param(sp.phone)} />;
}
