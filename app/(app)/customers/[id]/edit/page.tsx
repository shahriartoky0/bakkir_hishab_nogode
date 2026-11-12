import { EditCustomerScreen } from "@/presentation/features/customers/customer-screens";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const { id } = await params;
  return <EditCustomerScreen id={id} />;
}
